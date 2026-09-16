import { lookupIsbn } from "@/lib/catalog-api";
import { writeChannelCopy } from "@/lib/ai-api";
import { estimateIsbnComp } from "@/lib/comps-api";
import { saveCopy } from "@/lib/copies-api";
import { DESK_CATALOG } from "@/lib/desk-catalog";
import { fallbackChannelCopy } from "@/lib/channel-copy";
import { kidCard, listPriceForKeep, money } from "@/lib/pricing";
import type { CatalogBook, ConditionGrade, CopyRecord } from "@/lib/types";

export type ScanDraft = {
  key: string;
  isbn: string;
  grade: ConditionGrade;
};

export type HydrateTick = {
  at: number;
  total: number;
  isbn: string;
  title: string;
  step: "lookup" | "write" | "saved";
};

function fallbackBook(isbn: string): CatalogBook {
  return {
    isbn13: isbn,
    isbn10: "",
    title: "",
    author: "",
    publisher: "",
    publishedYear: "",
    pages: null,
    format: "paperback",
    language: "English",
    coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
    subjects: "",
    source: "ISBN",
    description: "",
  };
}

async function loadBook(isbn: string): Promise<CatalogBook> {
  const local = DESK_CATALOG[isbn];
  if (local) return local;
  const res = await lookupIsbn({ data: { code: isbn } });
  if (res.ok && res.book) return res.book;
  return fallbackBook(isbn);
}

export async function hydrateStack(
  drafts: ScanDraft[],
  opts?: {
    targetKeep?: number | null;
    onTick?: (tick: HydrateTick) => void;
  },
): Promise<CopyRecord[]> {
  const keepGoal = opts?.targetKeep != null && opts.targetKeep >= 0 ? opts.targetKeep : null;
  const loaded: { draft: ScanDraft; book: CatalogBook }[] = [];

  for (let i = 0; i < drafts.length; i += 1) {
    const d = drafts[i];
    opts?.onTick?.({ at: i + 1, total: drafts.length, isbn: d.isbn, title: d.isbn, step: "lookup" });
    const book = await loadBook(d.isbn);
    loaded.push({ draft: d, book });
    opts?.onTick?.({
      at: i + 1,
      total: drafts.length,
      isbn: d.isbn,
      title: book.title || d.isbn,
      step: "lookup",
    });
  }

  opts?.onTick?.({
    at: loaded.length,
    total: drafts.length,
    isbn: "",
    title: "Writing buyer copy",
    step: "write",
  });

  let listings: Awaited<ReturnType<typeof writeChannelCopy>>["listings"] = [];
  try {
    const written = await writeChannelCopy({
      data: {
        books: loaded.map(({ draft, book }) => ({
          isbn13: book.isbn13 || draft.isbn,
          title: book.title || draft.isbn,
          author: book.author,
          publisher: book.publisher,
          publishedYear: book.publishedYear,
          format: book.format || "paperback",
          pages: book.pages,
          language: book.language,
          subjects: book.subjects,
          catalogBlurb: book.description,
          conditionGrade: draft.grade,
          defects: [],
        })),
      },
    });
    listings = written.listings;
  } catch {
    listings = loaded.map(({ draft, book }) =>
      fallbackChannelCopy({
        isbn13: book.isbn13 || draft.isbn,
        title: book.title || draft.isbn,
        author: book.author,
        publisher: book.publisher,
        publishedYear: book.publishedYear,
        format: book.format || "paperback",
        pages: book.pages,
        language: book.language,
        subjects: book.subjects,
        catalogBlurb: book.description,
        conditionGrade: draft.grade,
      }),
    );
  }

  const byIsbn = new Map(listings.map((l) => [l.isbn13, l]));
  const out: CopyRecord[] = [];

  for (let i = 0; i < loaded.length; i += 1) {
    const { draft, book } = loaded[i];
    const title = book.title || draft.isbn;
    const format = book.format || "paperback";
    opts?.onTick?.({ at: i + 1, total: drafts.length, isbn: draft.isbn, title, step: "write" });

    const words =
      byIsbn.get(book.isbn13) ||
      byIsbn.get(draft.isbn) ||
      fallbackChannelCopy({
        isbn13: book.isbn13 || draft.isbn,
        title,
        author: book.author,
        publisher: book.publisher,
        publishedYear: book.publishedYear,
        format,
        pages: book.pages,
        language: book.language,
        subjects: book.subjects,
        catalogBlurb: book.description,
        conditionGrade: draft.grade,
      });

    const comp = await estimateIsbnComp({
      data: {
        isbn13: book.isbn13,
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        publishedYear: book.publishedYear,
        format,
        pages: book.pages,
        conditionGrade: draft.grade,
        subjects: book.subjects,
      },
    });
    const floor = keepGoal != null ? listPriceForKeep({ keep: keepGoal, format, shop: "amazon" }) : 0;
    const listPrice = keepGoal != null ? Math.max(comp.listPrice, floor) : comp.listPrice;
    const card = kidCard({ listPrice, format, wePayStamp: true });
    const skip = keepGoal == null && card.choice === "GIVE IT AWAY";
    const why =
      keepGoal != null
        ? `Wait for ${money(keepGoal)} after the shop, the envelope, and the stamp. Amazon tag ${money(listPrice)}.`
        : card.why;

    const copy = await saveCopy({
      data: {
        isbn13: book.isbn13,
        isbn10: book.isbn10,
        title,
        author: book.author,
        publisher: book.publisher,
        publishedYear: book.publishedYear,
        pages: book.pages,
        format: book.format,
        language: book.language,
        coverUrl: book.coverUrl,
        subjects: book.subjects,
        conditionGrade: draft.grade,
        defects: [],
        listFormat: "bin",
        listPrice,
        auctionStart: null,
        ebayTitle: words.ebayTitle,
        ebayDescription: words.ebayDescription,
        conditionDescription: words.amazonItemNote || words.conditionDescription,
        pricingRationale:
          keepGoal != null ? `${why} Market ${money(comp.listPrice)} (${comp.source}).` : comp.rationale,
        shippingNote: "Ships from Lincoln, Nebraska via USPS Media Mail. Packed to survive the trip.",
        status: skip ? "skipped" : "ready",
        skipReason: skip ? card.why : "",
        channels: skip ? [] : ["amazon", "ebay"],
      },
    });
    out.push(copy);
    opts?.onTick?.({ at: i + 1, total: drafts.length, isbn: draft.isbn, title: copy.title, step: "saved" });
  }

  return out;
}

export async function hydrateDraft(
  draft: ScanDraft,
  opts?: { targetKeep?: number | null },
): Promise<CopyRecord> {
  const [copy] = await hydrateStack([draft], { targetKeep: opts?.targetKeep });
  return copy;
}
