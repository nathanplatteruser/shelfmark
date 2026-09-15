import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import type { ActivityRow, BookFormat, ConditionGrade, CopyRecord, CopyStatus, DefectId, DeskStats, ListFormat } from "@/lib/types";
import { nextBin } from "@/lib/condition";
import { buildSku, parseSeq } from "@/lib/sku";
import { DEFAULT_CHANNEL_SLUGS } from "@/lib/channels";
import { ensureChannelState, writeListingsForCopy } from "@/lib/channels-api";

type CopyRow = {
  id: number;
  sku: string;
  isbn13: string | null;
  isbn10: string | null;
  title: string;
  author: string;
  publisher: string;
  published_year: string;
  pages: number | null;
  format: string;
  language: string;
  cover_url: string;
  subjects: string;
  condition_grade: string;
  defects: unknown;
  condition_notes: string;
  photos: unknown;
  list_format: string;
  list_price: string | number | null;
  auction_start: string | number | null;
  shipping_weight_oz: string | number | null;
  bin_location: string;
  status: string;
  ebay_title: string;
  ebay_description: string;
  condition_description: string;
  item_specifics: unknown;
  pricing_rationale: string;
  shipping_note: string;
  skip_reason: string;
  listed_at: string | null;
  sold_at: string | null;
  sold_price: string | number | null;
  created_at: string;
  updated_at: string;
};

function asNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function asArr<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? (p as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asObj(v: unknown): Record<string, string> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, string>;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, string>;
    } catch {
      return {};
    }
  }
  return {};
}

function mapCopy(row: CopyRow): CopyRecord {
  return {
    id: row.id,
    sku: row.sku,
    isbn13: row.isbn13 ?? "",
    isbn10: row.isbn10 ?? "",
    title: row.title,
    author: row.author,
    publisher: row.publisher,
    publishedYear: row.published_year,
    pages: row.pages,
    format: (row.format || "paperback") as BookFormat,
    language: row.language,
    coverUrl: row.cover_url,
    subjects: row.subjects,
    conditionGrade: (row.condition_grade || "") as ConditionGrade | "",
    defects: asArr<DefectId>(row.defects),
    conditionNotes: row.condition_notes,
    photos: asArr<string>(row.photos),
    listFormat: (row.list_format || "bin") as ListFormat,
    listPrice: asNum(row.list_price),
    auctionStart: asNum(row.auction_start),
    shippingWeightOz: asNum(row.shipping_weight_oz),
    binLocation: row.bin_location,
    status: (row.status || "draft") as CopyStatus,
    ebayTitle: row.ebay_title,
    ebayDescription: row.ebay_description,
    conditionDescription: row.condition_description,
    itemSpecifics: asObj(row.item_specifics),
    pricingRationale: row.pricing_rationale,
    shippingNote: row.shipping_note,
    skipReason: row.skip_reason,
    listedAt: row.listed_at,
    soldAt: row.sold_at,
    soldPrice: asNum(row.sold_price),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SEED: Array<{
  isbn13: string;
  isbn10: string;
  title: string;
  author: string;
  publisher: string;
  publishedYear: string;
  pages: number;
  format: BookFormat;
  coverUrl: string;
  subjects: string;
  conditionGrade: ConditionGrade;
  defects: DefectId[];
  listPrice: number;
  listFormat: ListFormat;
  status: CopyStatus;
  bin: string;
}> = [
  {
    isbn13: "9780618260300",
    isbn10: "0618260307",
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    publisher: "Houghton Mifflin",
    publishedYear: "2002",
    pages: 320,
    format: "paperback",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780618260300-L.jpg",
    subjects: "Fantasy, Adventure",
    conditionGrade: "VG",
    defects: ["spine"],
    listPrice: 8.99,
    listFormat: "bin",
    status: "ready",
    bin: "A-01",
  },
  {
    isbn13: "9780061120084",
    isbn10: "0061120081",
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    publisher: "Harper Perennial",
    publishedYear: "2006",
    pages: 336,
    format: "paperback",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg",
    subjects: "Fiction, Classic",
    conditionGrade: "G",
    defects: ["name"],
    listPrice: 6.99,
    listFormat: "bin",
    status: "listed",
    bin: "A-02",
  },
  {
    isbn13: "9780743273565",
    isbn10: "0743273567",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    publisher: "Scribner",
    publishedYear: "2004",
    pages: 180,
    format: "paperback",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg",
    subjects: "Fiction, Classic",
    conditionGrade: "LN",
    defects: [],
    listPrice: 7.99,
    listFormat: "bin",
    status: "sold",
    bin: "B-01",
  },
  {
    isbn13: "9780141439518",
    isbn10: "0141439513",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    publisher: "Penguin Classics",
    publishedYear: "2002",
    pages: 480,
    format: "paperback",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg",
    subjects: "Fiction, Romance, Classic",
    conditionGrade: "VG",
    defects: [],
    listPrice: 7.49,
    listFormat: "offer",
    status: "ready",
    bin: "A-03",
  },
  {
    isbn13: "9780439023481",
    isbn10: "0439023483",
    title: "The Hunger Games",
    author: "Suzanne Collins",
    publisher: "Scholastic",
    publishedYear: "2008",
    pages: 374,
    format: "hardcover",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780439023481-L.jpg",
    subjects: "Young Adult, Dystopia",
    conditionGrade: "G",
    defects: ["jacket", "spine"],
    listPrice: 5.99,
    listFormat: "bin",
    status: "listed",
    bin: "C-04",
  },
  {
    isbn13: "9780553380163",
    isbn10: "0553380168",
    title: "A Short History of Nearly Everything",
    author: "Bill Bryson",
    publisher: "Broadway Books",
    publishedYear: "2004",
    pages: 544,
    format: "paperback",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780553380163-L.jpg",
    subjects: "Science, History",
    conditionGrade: "VG",
    defects: ["remainder"],
    listPrice: 9.99,
    listFormat: "bin",
    status: "ready",
    bin: "D-02",
  },
  {
    isbn13: "9780807508527",
    isbn10: "0807508527",
    title: "The Boxcar Children",
    author: "Gertrude Chandler Warner",
    publisher: "Albert Whitman",
    publishedYear: "1989",
    pages: 160,
    format: "paperback",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780807508527-L.jpg",
    subjects: "Children, Mystery",
    conditionGrade: "VG",
    defects: [],
    listPrice: 8.5,
    listFormat: "bin",
    status: "listed",
    bin: "C-02",
  },
];

async function seedIfEmpty(): Promise<void> {
  const sql = await getSql();
  const count = await sql<{ n: number }>`select count(*)::int as n from copies`;
  if ((count[0]?.n ?? 0) === 0) {
    for (let i = 0; i < SEED.length; i += 1) {
      const s = SEED[i];
      const sku = buildSku(i + 1);
      const title = `${s.title} ${s.author} ${s.format === "hardcover" ? "Hardcover" : "Paperback"}`.slice(0, 80);
      const cond = `Condition: ${s.conditionGrade === "LN" ? "Like New" : s.conditionGrade === "VG" ? "Very Good" : "Good"}.`;
      await sql`
        insert into copies (
          sku, isbn13, isbn10, title, author, publisher, published_year, pages, format,
          language, cover_url, subjects, condition_grade, defects, ebay_title,
          condition_description, ebay_description, list_format, list_price, auction_start,
          bin_location, status, shipping_note, listed_at, sold_at, sold_price
        ) values (
          ${sku}, ${s.isbn13}, ${s.isbn10}, ${s.title}, ${s.author}, ${s.publisher},
          ${s.publishedYear}, ${s.pages}, ${s.format}, ${"English"}, ${s.coverUrl},
          ${s.subjects}, ${s.conditionGrade}, ${JSON.stringify(s.defects)}::jsonb,
          ${title}, ${cond}, ${`${s.title} by ${s.author}\n\n${cond}`}, ${s.listFormat},
          ${s.listPrice}, ${4.99}, ${s.bin}, ${s.status},
          ${"Ships from Lincoln, Nebraska via USPS Media Mail."},
          ${s.status === "listed" || s.status === "sold" ? new Date().toISOString() : null},
          ${s.status === "sold" ? new Date().toISOString() : null},
          ${s.status === "sold" ? s.listPrice : null}
        )
      `;
    }
    await sql`insert into activity (kind, detail) values (${"seed"}, ${"Desk opened with sample copies"})`;
  }
}

export const bootstrapDesk = createServerFn({ method: "GET" }).handler(async () => {
  await seedIfEmpty();
  await ensureChannelState();
  return { ok: true as const };
});

export const listCopies = createServerFn({ method: "GET" })
  .validator((input: { status?: CopyStatus | "all" } | undefined) => input ?? { status: "all" })
  .handler(async ({ data }) => {
    await seedIfEmpty();
    await ensureChannelState();
    const sql = await getSql();
    const status = data?.status ?? "all";
    const rows =
      status && status !== "all"
        ? await sql<CopyRow>`select * from copies where status = ${status} order by updated_at desc`
        : await sql<CopyRow>`select * from copies order by updated_at desc`;
    return rows.map(mapCopy);
  });

export const getStats = createServerFn({ method: "GET" }).handler(async (): Promise<DeskStats> => {
  await seedIfEmpty();
  await ensureChannelState();
  const sql = await getSql();
  const rows = await sql<{ status: string; n: number; value: string | number | null }>`
    select status, count(*)::int as n, coalesce(sum(list_price), 0)::float8 as value
    from copies
    group by status
  `;
  const today = await sql<{ n: number }>`
    select count(*)::int as n from copies
    where status in ('ready','listed','sold','shipped')
      and created_at::date = current_date
  `;
  const dup = await sql<{ n: number }>`
    select count(*)::int as n from (
      select isbn13 from copies where isbn13 is not null and isbn13 <> ''
      group by isbn13 having count(*) > 1
    ) d
  `;
  const by = Object.fromEntries(rows.map((r) => [r.status, r]));
  const num = (k: string) => by[k]?.n ?? 0;
  const readyVal = Number(by.ready?.value ?? 0) || 0;
  const listedVal = Number(by.listed?.value ?? 0) || 0;
  return {
    listedToday: today[0]?.n ?? 0,
    readyCount: num("ready"),
    listedCount: num("listed"),
    soldCount: num("sold"),
    shippedCount: num("shipped"),
    skippedCount: num("skipped"),
    draftCount: num("draft"),
    inventoryValue: readyVal + listedVal,
    goal: 100,
    duplicateIsbns: dup[0]?.n ?? 0,
  };
});

export const countIsbn = createServerFn({ method: "POST" })
  .validator((input: { isbn13: string }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{ n: number }>`
      select count(*)::int as n from copies where isbn13 = ${data.isbn13}
    `;
    return { count: rows[0]?.n ?? 0 };
  });

const saveSchema = z.object({
  isbn13: z.string(),
  isbn10: z.string().optional(),
  title: z.string(),
  author: z.string(),
  publisher: z.string().optional(),
  publishedYear: z.string().optional(),
  pages: z.number().nullable().optional(),
  format: z.string(),
  language: z.string().optional(),
  coverUrl: z.string().optional(),
  subjects: z.string().optional(),
  conditionGrade: z.string(),
  defects: z.array(z.string()),
  conditionNotes: z.string().optional(),
  photos: z.array(z.string()).optional(),
  listFormat: z.string(),
  listPrice: z.number().nullable(),
  auctionStart: z.number().nullable().optional(),
  shippingWeightOz: z.number().nullable().optional(),
  ebayTitle: z.string(),
  ebayDescription: z.string(),
  conditionDescription: z.string(),
  itemSpecifics: z.record(z.string(), z.string()).optional(),
  pricingRationale: z.string().optional(),
  shippingNote: z.string().optional(),
  status: z.enum(["draft", "ready", "listed", "sold", "shipped", "skipped"]),
  skipReason: z.string().optional(),
  channels: z.array(z.string()).optional(),
});

export const saveCopy = createServerFn({ method: "POST" })
  .validator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const allSkus = await sql<{ sku: string }>`select sku from copies`;
    const maxSeq = allSkus.reduce((m, r) => Math.max(m, parseSeq(r.sku)), 0);
    const sku = buildSku(maxSeq + 1);
    const bins = await sql<{ bin_location: string }>`select bin_location from copies`;
    const bin = nextBin(bins.map((b) => b.bin_location));
    const listedAt = data.status === "ready" || data.status === "listed" ? new Date().toISOString() : null;

    const inserted = await sql<CopyRow>`
      insert into copies (
        sku, isbn13, isbn10, title, author, publisher, published_year, pages, format,
        language, cover_url, subjects, condition_grade, defects, condition_notes, photos,
        list_format, list_price, auction_start, shipping_weight_oz, bin_location, status,
        ebay_title, ebay_description, condition_description, item_specifics,
        pricing_rationale, shipping_note, skip_reason, listed_at
      ) values (
        ${sku}, ${data.isbn13}, ${data.isbn10 ?? ""}, ${data.title}, ${data.author},
        ${data.publisher ?? ""}, ${data.publishedYear ?? ""}, ${data.pages ?? null},
        ${data.format}, ${data.language ?? "English"}, ${data.coverUrl ?? ""},
        ${data.subjects ?? ""}, ${data.conditionGrade}, ${JSON.stringify(data.defects)}::jsonb,
        ${data.conditionNotes ?? ""}, ${JSON.stringify(data.photos ?? [])}::jsonb,
        ${data.listFormat}, ${data.listPrice}, ${data.auctionStart ?? null},
        ${data.shippingWeightOz ?? null}, ${bin}, ${data.status},
        ${data.ebayTitle}, ${data.ebayDescription}, ${data.conditionDescription},
        ${JSON.stringify(data.itemSpecifics ?? {})}::jsonb,
        ${data.pricingRationale ?? ""}, ${data.shippingNote ?? ""}, ${data.skipReason ?? ""},
        ${listedAt}
      )
      returning *
    `;
    const copy = mapCopy(inserted[0]);
    if (data.status !== "skipped") {
      const slugs = data.channels?.length ? data.channels : DEFAULT_CHANNEL_SLUGS;
      const listings = await writeListingsForCopy({
        copyId: copy.id,
        sku: copy.sku,
        listFormat: data.listFormat,
        slugs,
        status: "live",
      });
      if (listings.length > 0 && (data.status === "ready" || data.status === "listed")) {
        const now = new Date().toISOString();
        await sql`
          update copies set status = ${"listed"}, listed_at = ${now}, updated_at = ${now}
          where id = ${copy.id}
        `;
        copy.status = "listed";
        copy.listedAt = now;
      }
    }
    await sql`
      insert into activity (kind, copy_id, detail)
      values (
        ${data.status === "skipped" ? "skipped" : "listed"},
        ${copy.id},
        ${`${copy.sku} · ${copy.title} · ${copy.binLocation}`}
      )
    `;
    return copy;
  });

export const updateStatus = createServerFn({ method: "POST" })
  .validator((input: { id: number; status: CopyStatus; soldPrice?: number }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const now = new Date().toISOString();
    if (data.status === "sold") {
      await sql`
        update copies
        set status = ${data.status}, sold_at = ${now}, sold_price = ${data.soldPrice ?? null}, updated_at = ${now}
        where id = ${data.id}
      `;
    } else if (data.status === "listed") {
      await sql`
        update copies
        set status = ${data.status}, listed_at = ${now}, updated_at = ${now}
        where id = ${data.id}
      `;
    } else {
      await sql`
        update copies
        set status = ${data.status}, updated_at = ${now}
        where id = ${data.id}
      `;
    }
    await sql`
      insert into activity (kind, copy_id, detail)
      values (${data.status}, ${data.id}, ${data.status})
    `;
    const rows = await sql<CopyRow>`select * from copies where id = ${data.id}`;
    return rows[0] ? mapCopy(rows[0]) : null;
  });

export const deleteCopy = createServerFn({ method: "POST" })
  .validator((input: { id: number }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<CopyRow>`select * from copies where id = ${data.id}`;
    const copy = rows[0] ? mapCopy(rows[0]) : null;
    if (!copy) return { ok: false as const, error: "Already gone." };

    const saleIds = await sql<{ id: number }>`select id from sales where copy_id = ${data.id}`;
    for (const sale of saleIds) {
      await sql`delete from sync_events where sale_id = ${sale.id}`;
    }
    await sql`delete from sync_events where copy_id = ${data.id}`;
    await sql`delete from sales where copy_id = ${data.id}`;
    await sql`delete from channel_listings where copy_id = ${data.id}`;
    await sql`delete from activity where copy_id = ${data.id}`;
    await sql`delete from copies where id = ${data.id}`;
    await sql`
      insert into activity (kind, detail)
      values (${"deleted"}, ${`${copy.sku} · ${copy.title} taken out of the pile`})
    `;
    return { ok: true as const, title: copy.title };
  });

export const listActivity = createServerFn({ method: "GET" }).handler(async () => {
  await seedIfEmpty();
  const sql = await getSql();
  const rows = await sql<{
    id: number;
    kind: string;
    copy_id: number | null;
    detail: string;
    created_at: string;
  }>`select * from activity order by created_at desc limit 40`;
  return rows.map(
    (r): ActivityRow => ({
      id: r.id,
      kind: r.kind,
      copyId: r.copy_id,
      detail: r.detail,
      createdAt: r.created_at,
    }),
  );
});
