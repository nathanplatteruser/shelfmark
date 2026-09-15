import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import type {
  BookFormat,
  ClipStatus,
  ConditionGrade,
  DefectId,
  ReelClipRecord,
  ReelKind,
  ReelRecord,
} from "@/lib/types";
import { heuristicPrice } from "@/lib/pricing";
import { estimateIsbnComp } from "@/lib/comps-api";

type ReelRow = {
  id: number;
  kind: string;
  status: string;
  takt_ms: number;
  started_at: string;
  ended_at: string | null;
  duration_sec: number;
  books_captured: number;
  books_listed: number;
  notes: string;
};

type ClipRow = {
  id: number;
  reel_id: number;
  seq: number;
  isbn13: string;
  detected_at_ms: number;
  title: string;
  author: string;
  publisher: string;
  published_year: string;
  pages: number | null;
  format: string;
  language: string;
  cover_url: string;
  subjects: string;
  catalog_source: string;
  stills: unknown;
  suggested_grade: string;
  suggested_price: string | number | null;
  condition_grade: string;
  defects: unknown;
  ebay_title: string;
  ebay_description: string;
  copy_id: number | null;
  status: string;
  created_at: string;
};

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

function asNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapReel(row: ReelRow): ReelRecord {
  return {
    id: row.id,
    kind: (row.kind || "practice") as ReelKind,
    status: row.status,
    taktMs: row.takt_ms,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSec: row.duration_sec,
    booksCaptured: row.books_captured,
    booksListed: row.books_listed,
    notes: row.notes,
  };
}

function mapClip(row: ClipRow): ReelClipRecord {
  return {
    id: row.id,
    reelId: row.reel_id,
    seq: row.seq,
    isbn13: row.isbn13,
    detectedAtMs: row.detected_at_ms,
    title: row.title,
    author: row.author,
    publisher: row.publisher,
    publishedYear: row.published_year,
    pages: row.pages,
    format: (row.format || "paperback") as BookFormat,
    language: row.language,
    coverUrl: row.cover_url,
    subjects: row.subjects,
    catalogSource: row.catalog_source,
    stills: asArr<string>(row.stills).slice(0, 3),
    suggestedGrade: (row.suggested_grade || "") as ConditionGrade | "",
    suggestedPrice: asNum(row.suggested_price),
    conditionGrade: (row.condition_grade || "") as ConditionGrade | "",
    defects: asArr<DefectId>(row.defects),
    ebayTitle: row.ebay_title,
    ebayDescription: row.ebay_description,
    copyId: row.copy_id,
    status: (row.status || "captured") as ClipStatus,
    createdAt: row.created_at,
  };
}

export const startReel = createServerFn({ method: "POST" })
  .validator((input: { kind: ReelKind; taktMs?: number }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<ReelRow>`
      insert into reels (kind, status, takt_ms)
      values (${data.kind}, ${"recording"}, ${data.taktMs ?? 3000})
      returning *
    `;
    return mapReel(rows[0]);
  });

const clipIn = z.object({
  reelId: z.number(),
  seq: z.number(),
  isbn13: z.string(),
  detectedAtMs: z.number(),
  title: z.string(),
  author: z.string(),
  publisher: z.string().optional(),
  publishedYear: z.string().optional(),
  pages: z.number().nullable().optional(),
  format: z.string(),
  language: z.string().optional(),
  coverUrl: z.string().optional(),
  subjects: z.string().optional(),
  catalogSource: z.string().optional(),
  stills: z.array(z.string()).optional(),
});

export const addClip = createServerFn({ method: "POST" })
  .validator((input: unknown) => clipIn.parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const price = heuristicPrice({
      format: data.format,
      publishedYear: data.publishedYear ?? "",
      conditionGrade: "G",
      pages: data.pages ?? null,
    });
    let suggested = price.listPrice;
    try {
      const comp = await estimateIsbnComp({
        data: {
          isbn13: data.isbn13,
          title: data.title,
          author: data.author,
          publishedYear: data.publishedYear,
          format: data.format,
          pages: data.pages ?? null,
          conditionGrade: "G",
          subjects: data.subjects,
        },
      });
      suggested = comp.listPrice;
    } catch {
      /* keep heuristic */
    }
    // Cover URLs only — never persist webcam data URLs (too large for the row).
    const stills = (data.stills ?? []).filter((s) => s.startsWith("http")).slice(0, 3);
    const rows = await sql<ClipRow>`
      insert into reel_clips (
        reel_id, seq, isbn13, detected_at_ms, title, author, publisher, published_year,
        pages, format, language, cover_url, subjects, catalog_source, stills,
        suggested_grade, suggested_price, status
      ) values (
        ${data.reelId}, ${data.seq}, ${data.isbn13}, ${data.detectedAtMs}, ${data.title},
        ${data.author}, ${data.publisher ?? ""}, ${data.publishedYear ?? ""}, ${data.pages ?? null},
        ${data.format}, ${data.language ?? "English"}, ${data.coverUrl ?? ""},
        ${data.subjects ?? ""}, ${data.catalogSource ?? ""}, ${JSON.stringify(stills)}::jsonb,
        ${"G"}, ${suggested}, ${"looked_up"}
      )
      returning *
    `;
    await sql`
      update reels
      set books_captured = books_captured + 1
      where id = ${data.reelId}
    `;
    return mapClip(rows[0]);
  });

export const finishReel = createServerFn({ method: "POST" })
  .validator((input: { id: number; durationSec: number }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const now = new Date().toISOString();
    const rows = await sql<ReelRow>`
      update reels
      set status = ${"review"}, ended_at = ${now}, duration_sec = ${data.durationSec}
      where id = ${data.id}
      returning *
    `;
    return rows[0] ? mapReel(rows[0]) : null;
  });

export const listClips = createServerFn({ method: "GET" })
  .validator((input: { reelId: number }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<ClipRow>`
      select * from reel_clips where reel_id = ${data.reelId} order by seq asc
    `;
    return rows.map(mapClip);
  });

export const updateClip = createServerFn({ method: "POST" })
  .validator(
    (input: {
      id: number;
      conditionGrade?: ConditionGrade | "";
      defects?: DefectId[];
      status?: ClipStatus;
      copyId?: number | null;
      ebayTitle?: string;
      ebayDescription?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const existing = await sql<ClipRow>`select * from reel_clips where id = ${data.id}`;
    if (!existing[0]) return null;
    const grade = data.conditionGrade ?? existing[0].condition_grade;
    const defects = data.defects ? JSON.stringify(data.defects) : JSON.stringify(asArr(existing[0].defects));
    const status = data.status ?? existing[0].status;
    const copyId = data.copyId === undefined ? existing[0].copy_id : data.copyId;
    const title = data.ebayTitle ?? existing[0].ebay_title;
    const desc = data.ebayDescription ?? existing[0].ebay_description;
    const rows = await sql<ClipRow>`
      update reel_clips
      set condition_grade = ${grade},
          defects = ${defects}::jsonb,
          status = ${status},
          copy_id = ${copyId},
          ebay_title = ${title},
          ebay_description = ${desc}
      where id = ${data.id}
      returning *
    `;
    if (status === "listed") {
      await sql`
        update reels set books_listed = books_listed + 1 where id = ${existing[0].reel_id}
      `;
    }
    return rows[0] ? mapClip(rows[0]) : null;
  });

export const recentReels = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql<ReelRow>`select * from reels order by started_at desc limit 8`;
  return rows.map(mapReel);
});
