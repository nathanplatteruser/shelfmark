import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DESK_CATALOG } from "@/lib/desk-catalog";
import { isbn13To10, normalizeScannedCode } from "@/lib/isbn";
import {
  heuristicPrice,
  kidListPrice,
  maxAcquisition,
  moneyPrice,
  spokenHunt,
  type HuntMath,
} from "@/lib/pricing";
import type { BookFormat, CatalogBook } from "@/lib/types";

export type HuntQuote = HuntMath & {
  isbn13: string;
  title: string;
  author: string;
  format: BookFormat | string;
  coverUrl: string;
  source: "practice" | "isbn-comp" | "retail-band" | "heuristic";
  spoken: string;
};

const cache = new Map<string, HuntQuote>();

function isbnSalt(isbn: string): number {
  let h = 2166136261;
  for (let i = 0; i < isbn.length; i += 1) {
    h ^= isbn.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 173) / 100 - 0.86;
}

async function fetchJson(url: string, ms = 2200): Promise<unknown | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

type GbVolume = {
  saleInfo?: { listPrice?: { amount?: number }; retailPrice?: { amount?: number } };
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
};

function yearFrom(raw?: string): string {
  if (!raw) return "";
  const m = raw.match(/(1[5-9]\d{2}|20\d{2})/);
  return m?.[1] ?? "";
}

function guessFormat(title: string, subjects: string, pages: number | null): BookFormat {
  const blob = `${title} ${subjects}`.toLowerCase();
  if (blob.includes("textbook") || blob.includes("college")) return "textbook";
  if (blob.includes("hardcover") || blob.includes("hardback")) return "hardcover";
  if (blob.includes("mass market")) return "mass-market";
  if (pages && pages > 500) return "hardcover";
  return "paperback";
}

function fromGoogle(isbn13: string, json: unknown): { book: CatalogBook; retail: number | null } | null {
  const item = (json as { items?: GbVolume[] } | null)?.items?.[0];
  const info = item?.volumeInfo;
  if (!info?.title) return null;
  const subjects = (info.categories ?? []).join(", ");
  const pages = info.pageCount ?? null;
  const thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "";
  const amount = item?.saleInfo?.listPrice?.amount ?? item?.saleInfo?.retailPrice?.amount;
  const retail = typeof amount === "number" && amount > 0 ? amount : null;
  return {
    retail,
    book: {
      isbn13,
      isbn10: isbn13To10(isbn13),
      title: info.title,
      author: (info.authors ?? []).join(", "),
      publisher: info.publisher ?? "",
      publishedYear: yearFrom(info.publishedDate),
      pages,
      format: guessFormat(info.title, subjects, pages),
      language: "English",
      coverUrl: thumb.replace("http://", "https://") || `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`,
      subjects,
      source: "Google Books",
      description: "",
    },
  };
}

function fromOpenLibrary(isbn13: string, json: unknown): CatalogBook | null {
  const book = (json as Record<string, { title?: string; authors?: { name?: string }[]; publishers?: { name?: string }[]; publish_date?: string; number_of_pages?: number; subjects?: { name?: string }[]; cover?: { large?: string; medium?: string } }> | null)?.[`ISBN:${isbn13}`];
  if (!book?.title) return null;
  const subjects = (book.subjects ?? []).map((s) => s.name).filter(Boolean).slice(0, 6).join(", ");
  const pages = book.number_of_pages ?? null;
  return {
    isbn13,
    isbn10: isbn13To10(isbn13),
    title: book.title,
    author: (book.authors ?? []).map((a) => a.name).filter(Boolean).join(", "),
    publisher: (book.publishers ?? []).map((p) => p.name).filter(Boolean).join(", "),
    publishedYear: yearFrom(book.publish_date),
    pages,
    format: guessFormat(book.title, subjects, pages),
    language: "English",
    coverUrl: book.cover?.large || book.cover?.medium || `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`,
    subjects,
    source: "Open Library",
    description: "",
  };
}

function fallbackBook(isbn13: string): CatalogBook {
  return {
    isbn13,
    isbn10: isbn13To10(isbn13),
    title: "",
    author: "",
    publisher: "",
    publishedYear: "",
    pages: null,
    format: "paperback",
    language: "English",
    coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`,
    subjects: "",
    source: "ISBN",
    description: "",
  };
}

function pack(isbn13: string, book: CatalogBook, math: HuntMath, source: HuntQuote["source"]): HuntQuote {
  const title = book.title || isbn13;
  return {
    isbn13,
    title,
    author: book.author,
    format: book.format,
    coverUrl: book.coverUrl,
    source,
    spoken: spokenHunt(math, title),
    ...math,
  };
}

function withKeep(quote: HuntQuote, keep: number): HuntQuote {
  const math = maxAcquisition({
    expectedSale: quote.expectedSale,
    format: quote.format,
    keep,
  });
  return pack(quote.isbn13, {
    isbn13: quote.isbn13,
    isbn10: "",
    title: quote.title,
    author: quote.author,
    publisher: "",
    publishedYear: "",
    pages: null,
    format: quote.format as BookFormat,
    language: "English",
    coverUrl: quote.coverUrl,
    subjects: "",
    source: quote.source,
    description: "",
  }, math, quote.source);
}

const inputSchema = z.object({
  code: z.string(),
  targetKeep: z.number().min(0).max(500).optional(),
});

export const huntQuote = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<HuntQuote> => {
    const isbn13 = normalizeScannedCode(data.code);
    if (!isbn13) {
      throw new Error("That code is not an ISBN.");
    }
    const keep = data.targetKeep != null && Number.isFinite(data.targetKeep) ? data.targetKeep : 1;
    const hit = cache.get(isbn13);
    if (hit) return withKeep(hit, keep);

    const local = DESK_CATALOG[isbn13];
    let book: CatalogBook = local ?? fallbackBook(isbn13);
    let retail: number | null = null;

    if (!local) {
      const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}`;
      const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`;
      const [gbJson, olJson] = await Promise.all([fetchJson(gbUrl), fetchJson(olUrl)]);
      const gb = fromGoogle(isbn13, gbJson);
      const ol = fromOpenLibrary(isbn13, olJson);
      if (gb?.book.title) book = gb.book;
      else if (ol?.title) book = ol;
      retail = gb?.retail ?? null;
    }

    const practiced = kidListPrice(isbn13, 0);
    const heuristic = heuristicPrice({
      format: book.format,
      publishedYear: book.publishedYear,
      conditionGrade: "VG",
      pages: book.pages,
    });

    let expectedSale = 0;
    let source: HuntQuote["source"] = "heuristic";
    if (practiced > 0) {
      expectedSale = practiced;
      source = "practice";
    } else if (retail && retail > 0) {
      expectedSale = moneyPrice(Math.max(1.5, retail * 0.36 + isbnSalt(isbn13)));
      source = "retail-band";
    } else {
      expectedSale = moneyPrice(Math.max(1.5, heuristic.listPrice + isbnSalt(isbn13)));
      source = "heuristic";
    }

    const math = maxAcquisition({ expectedSale, format: book.format, keep });
    const quote = pack(isbn13, book, math, source);
    cache.set(isbn13, quote);
    return quote;
  });
