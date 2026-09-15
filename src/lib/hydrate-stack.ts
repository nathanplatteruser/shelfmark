import { lookupIsbn } from "@/lib/catalog-api";
import { polishListing } from "@/lib/ai-api";
import { estimateIsbnComp } from "@/lib/comps-api";
import { saveCopy } from "@/lib/copies-api";
import { DESK_CATALOG } from "@/lib/desk-catalog";
import { buildConditionDescription } from "@/lib/condition";
import {
  buildEbayTitle,
  buildTemplateDescription,
  kidCard,
  listPriceForKeep,
  money,
} from "@/lib/pricing";
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
  };
}

export async function hydrateDraft(
  draft: ScanDraft,
  opts?: { targetKeep?: number | null },
): Promise<CopyRecord> {
  const local = DESK_CATALOG[draft.isbn];
  let book: CatalogBook = local ?? fallbackBook(draft.isbn);
  if (!local) {
    const res = await lookupIsbn({ data: { code: draft.isbn } });
    if (res.ok && res.book) book = res.book;
  }

  const title = book.title || draft.isbn;
  const format = book.format || "paperback";
  const keepGoal = opts?.targetKeep != null && opts.targetKeep >= 0 ? opts.targetKeep : null;
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
  const marketPrice = comp.listPrice;
  const listPrice = keepGoal != null ? Math.max(marketPrice, floor) : marketPrice;
  const card = kidCard({ listPrice, format, wePayStamp: true });
  const cond = buildConditionDescription(draft.grade, [], "");
  const templateTitle = buildEbayTitle({
    title,
    author: book.author,
    format: book.format,
    publishedYear: book.publishedYear,
    conditionGrade: draft.grade,
  });
  const templateDesc = buildTemplateDescription({
    title,
    author: book.author,
    publisher: book.publisher,
    publishedYear: book.publishedYear,
    format: book.format,
    pages: book.pages,
    language: book.language,
    isbn13: book.isbn13,
    conditionDescription: cond,
    shippingNote: "Ships from Lincoln, Nebraska via USPS Media Mail.",
  });

  let polished;
  try {
    polished = await polishListing({
      data: {
        title,
        author: book.author,
        publisher: book.publisher,
        publishedYear: book.publishedYear,
        format: book.format,
        pages: book.pages,
        language: book.language,
        isbn13: book.isbn13,
        subjects: book.subjects,
        conditionGrade: draft.grade,
        defects: [],
      },
    });
  } catch {
    polished = null;
  }

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
      listFormat: keepGoal != null ? "bin" : polished?.listFormat ?? "bin",
      listPrice:
        keepGoal != null
          ? Math.max(polished?.listPrice && polished.listPrice > 0 ? polished.listPrice : listPrice, floor)
          : polished?.listPrice && polished.listPrice > 0
            ? polished.listPrice
            : listPrice,
      auctionStart: polished?.auctionStart ?? null,
      ebayTitle: polished?.ebayTitle || templateTitle,
      ebayDescription: polished?.ebayDescription || templateDesc,
      conditionDescription: polished?.conditionDescription || cond,
      pricingRationale:
        keepGoal != null
          ? `${why} Market ${money(marketPrice)} (${comp.source}).`
          : polished?.pricingRationale || comp.rationale,
      shippingNote: polished?.shippingNote || "Ships from Lincoln, Nebraska via USPS Media Mail.",
      itemSpecifics: polished?.itemSpecifics,
      status: skip ? "skipped" : "ready",
      skipReason: skip ? card.why : "",
      channels: skip ? [] : ["amazon", "ebay"],
    },
  });
  return copy;
}
