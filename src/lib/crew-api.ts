import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import type { CrewStation } from "@/lib/types";

type StationRow = {
  id: number;
  slug: string;
  label: string;
  age_band: string;
  duty: string;
  checklist: unknown;
  today_count: number;
  on_duty: boolean;
};

function asArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapStation(row: StationRow): CrewStation {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    ageBand: row.age_band,
    duty: row.duty,
    checklist: asArr(row.checklist),
    todayCount: row.today_count,
    onDuty: row.on_duty,
  };
}

const SEED: Array<Omit<CrewStation, "id" | "todayCount" | "onDuty">> = [
  {
    slug: "reel",
    label: "Reel",
    ageBand: "5+",
    duty: "Hold each book to the camera. ISBN for two seconds, turn once, next book.",
    checklist: [
      "Stand the book so the barcode faces the lens",
      "Hold still until the beep",
      "Turn the book once so the cover is seen",
      "Set it in the captured pile, pick up the next",
    ],
  },
  {
    slug: "scan",
    label: "Scan",
    ageBand: "8+",
    duty: "USB gun on the desk. One book, one beep, pass to grade.",
    checklist: [
      "Point the gun at the Bookland EAN",
      "Wait for the title to speak",
      "If no beep, try the other barcode or pass to title-page photo",
    ],
  },
  {
    slug: "grade",
    label: "Grade",
    ageBand: "10+",
    duty: "Keys 1–4. Tap defects. Do not type.",
    checklist: [
      "Look at the copy, not the catalog photo",
      "1 Like New · 2 Very Good · 3 Good · 4 Acceptable",
      "Tap every defect you can see",
      "Skip if the book is incomplete",
    ],
  },
  {
    slug: "pack",
    label: "Pack",
    ageBand: "10+",
    duty: "Pick list → bin → wrap → Media Mail.",
    checklist: [
      "Read the SKU on the pick list",
      "Pull the matching book from that bin",
      "Wrap so corners cannot crush",
      "Media Mail, same from-address, mark shipped",
    ],
  },
  {
    slug: "count",
    label: "Count",
    ageBand: "12+",
    duty: "Saturday numbers: listed, sold, skipped, net.",
    checklist: [
      "Read listed vs sold vs skipped",
      "Check that bins match the sheet",
      "Flag any copy that sat more than 45 days",
    ],
  },
  {
    slug: "helm",
    label: "Helm",
    ageBand: "14–18",
    duty: "Price overrides, auctions, buyer replies, skip calls.",
    checklist: [
      "Override price only when the copy is special",
      "Auctions are the exception",
      "Answer buyers from the short template",
      "Do not list into a dead bin",
    ],
  },
];

export const bootstrapCrew = createServerFn({ method: "POST" }).handler(async () => {
  const sql = await getSql();
  const existing = await sql<StationRow>`select * from crew_stations order by id`;
  if (existing.length === 0) {
    for (const s of SEED) {
      await sql`
        insert into crew_stations (slug, label, age_band, duty, checklist)
        values (
          ${s.slug}, ${s.label}, ${s.ageBand}, ${s.duty}, ${JSON.stringify(s.checklist)}::jsonb
        )
      `;
    }
    const rows = await sql<StationRow>`select * from crew_stations order by id`;
    return rows.map(mapStation);
  }
  return existing.map(mapStation);
});

export const listCrew = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql<StationRow>`select * from crew_stations order by id`;
  return rows.map(mapStation);
});

export const setStationDuty = createServerFn({ method: "POST" })
  .validator((input: { slug: string; onDuty: boolean }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const now = new Date().toISOString();
    const rows = await sql<StationRow>`
      update crew_stations
      set on_duty = ${data.onDuty}, updated_at = ${now}
      where slug = ${data.slug}
      returning *
    `;
    return rows[0] ? mapStation(rows[0]) : null;
  });

export const bumpStation = createServerFn({ method: "POST" })
  .validator((input: { slug: string; by?: number }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const now = new Date().toISOString();
    const rows = await sql<StationRow>`
      update crew_stations
      set today_count = today_count + ${data.by ?? 1}, updated_at = ${now}
      where slug = ${data.slug}
      returning *
    `;
    return rows[0] ? mapStation(rows[0]) : null;
  });
