import { createServerFn } from "@tanstack/react-start";
import { DESK_CATALOG } from "@/lib/desk-catalog";
import type { BookFormat, CatalogBook } from "@/lib/types";
import { isbn13To10, normalizeScannedCode } from "@/lib/isbn";
import { stripHtml } from "@/lib/channel-copy";

type OlBook = {
  title?: string;
  authors?: { name?: string }[];
  publishers?: { name?: string }[];
  publish_date?: string;
  number_of_pages?: number;
  cover?: { large?: string; medium?: string };
  subjects?: { name?: string }[];
  identifiers?: { isbn_10?: string[]; isbn_13?: string[] };
  excerpts?: { text?: string }[];
  notes?: string;
};

function guessFormat(title: string, subjects: string, pages: number | null): BookFormat {
  const blob = `${title} ${subjects}`.toLowerCase();
  if (blob.includes("textbook") || blob.includes("college")) return "textbook";
  if (blob.includes("hardcover") || blob.includes("hardback")) return "hardcover";
  if (blob.includes("mass market")) return "mass-market";
  if (pages && pages > 500) return "hardcover";
  return "paperback";
}

function yearFrom(raw?: string): string {
  if (!raw) return "";
  const m = raw.match(/(1[5-9]\d{2}|20\d{2})/);
  return m?.[1] ?? "";
}

const LOCAL: Record<string, CatalogBook> = DESK_CATALOG;

function score(book: CatalogBook): number {
  let s = 0;
  if (book.title) s += 3;
  if (book.author) s += 2;
  if (book.publisher) s += 1;
  if (book.publishedYear) s += 1;
  if (book.coverUrl) s += 1;
  if (book.description) s += 2;
  if (/^[\x00-\x7F]+$/.test(book.title)) s += 2;
  if (book.language.toLowerCase().startsWith("en")) s += 1;
  return s;
}

async function fetchJson(url: string, ms = 6000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function fromOlPayload(isbn13: string, json: unknown): CatalogBook | null {
  const book = (json as Record<string, OlBook> | null)?.[`ISBN:${isbn13}`];
  if (!book?.title) return null;
  const isbn10 = book.identifiers?.isbn_10?.[0] ?? isbn13To10(isbn13);
  const pages = book.number_of_pages ?? null;
  const subjects = (book.subjects ?? [])
    .map((s) => s.name)
    .filter(Boolean)
    .slice(0, 6)
    .join(", ");
  const excerpt = (book.excerpts ?? []).map((e) => e.text).filter(Boolean).join(" ");
  return {
    isbn13,
    isbn10,
    title: book.title,
    author: (book.authors ?? []).map((a) => a.name).filter(Boolean).join(", "),
    publisher: (book.publishers ?? []).map((p) => p.name).filter(Boolean).join(", "),
    publishedYear: yearFrom(book.publish_date),
    pages,
    format: guessFormat(book.title, subjects, pages),
    language: "English",
    coverUrl:
      book.cover?.large ||
      book.cover?.medium ||
      `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`,
    subjects,
    source: "Open Library",
    description: stripHtml(excerpt || book.notes || "").slice(0, 1800),
  };
}

type GbVolume = {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    language?: string;
    categories?: string[];
    description?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
  };
};

function fromGbPayload(isbn13: string, json: unknown): CatalogBook | null {
  const info = (json as { items?: GbVolume[] } | null)?.items?.[0]?.volumeInfo;
  if (!info?.title) return null;
  const isbn10 =
    info.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier ?? isbn13To10(isbn13);
  const pages = info.pageCount ?? null;
  const subjects = (info.categories ?? []).slice(0, 6).join(", ");
  const thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "";
  return {
    isbn13,
    isbn10,
    title: info.title,
    author: (info.authors ?? []).join(", "),
    publisher: info.publisher ?? "",
    publishedYear: yearFrom(info.publishedDate),
    pages,
    format: guessFormat(info.title, subjects, pages),
    language: info.language === "en" ? "English" : info.language || "English",
    coverUrl:
      thumb.replace("http://", "https://") ||
      `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`,
    subjects,
    source: "Google Books",
    description: stripHtml(info.description || "").slice(0, 1800),
  };
}

export const lookupIsbn = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }) => {
    const isbn13 = normalizeScannedCode(data.code);
    if (!isbn13) return { ok: false as const, error: "That code is not an ISBN." };

    if (LOCAL[isbn13]) return { ok: true as const, book: LOCAL[isbn13] };

    const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`;
    const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}`;
    const [olJson, gbJson] = await Promise.all([fetchJson(olUrl), fetchJson(gbUrl)]);
    const candidates = [fromOlPayload(isbn13, olJson), fromGbPayload(isbn13, gbJson)].filter(
      (b): b is CatalogBook => Boolean(b),
    );
    candidates.sort((a, b) => score(b) - score(a));
    if (candidates[0]) {
      const winner = { ...candidates[0] };
      if (!winner.description) {
        const other = candidates.find((c) => c.description);
        if (other) winner.description = other.description;
      }
      return { ok: true as const, book: winner };
    }

    return {
      ok: true as const,
      book: {
        isbn13,
        isbn10: isbn13To10(isbn13),
        title: "",
        author: "",
        publisher: "",
        publishedYear: "",
        pages: null,
        format: "paperback" as const,
        language: "English",
        coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`,
        subjects: "",
        source: "ISBN only",
        description: "",
      } satisfies CatalogBook,
      missing: true,
    };
  });
