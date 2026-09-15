import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BookFormat, ConditionGrade } from "@/lib/types";
import { heuristicPrice, moneyPrice } from "@/lib/pricing";

export type IsbnComp = {
  listPrice: number;
  low: number;
  high: number;
  rationale: string;
  source: "isbn-comp" | "retail-band" | "command" | "heuristic";
  isbn13: string;
};

const cache = new Map<string, IsbnComp>();

const GENERIC = new Set([4.99, 5.99, 6.99, 7.99, 8.99, 9.99, 10.99, 11.99, 12.99, 14.99, 19.99]);

function cacheKey(isbn: string, grade: string) {
  return `${isbn}|${grade || "VG"}`;
}

/** Tiny ISBN salt so two failed lookups never share a tag. Last resort only. */
function isbnSalt(isbn: string): number {
  let h = 2166136261;
  for (let i = 0; i < isbn.length; i += 1) {
    h ^= isbn.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 173) / 100 - 0.86;
}

async function fetchJson(url: string, ms = 5000): Promise<unknown | null> {
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

async function googleRetail(isbn: string): Promise<number | null> {
  const json = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
  const info = (json as { items?: { saleInfo?: { listPrice?: { amount?: number }; retailPrice?: { amount?: number } } }[] } | null)
    ?.items?.[0]?.saleInfo;
  const amount = info?.listPrice?.amount ?? info?.retailPrice?.amount;
  return typeof amount === "number" && amount > 0 ? amount : null;
}

type GrokChoice = { message?: { content?: string } };

async function grokComp(prompt: string): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 280,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You price one used book by ISBN for Amazon and eBay sold comps. Return JSON only. Never default to 4.99, 5.99, 8.99, or 9.99 unless that exact ISBN actually sells there.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: GrokChoice[] };
    const text = body.choices?.[0]?.message?.content ?? "";
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      return m ? (JSON.parse(m[0]) as Record<string, unknown>) : null;
    }
  } catch {
    return null;
  }
}

function bandFromRetail(retail: number, grade: ConditionGrade | ""): number {
  const g = grade || "VG";
  const mult = g === "LN" ? 0.48 : g === "VG" ? 0.36 : g === "G" ? 0.24 : 0.16;
  return retail * mult;
}

const inputSchema = z.object({
  isbn13: z.string(),
  title: z.string().optional(),
  author: z.string().optional(),
  publisher: z.string().optional(),
  publishedYear: z.string().optional(),
  format: z.string().optional(),
  pages: z.number().nullable().optional(),
  conditionGrade: z.string().optional(),
  subjects: z.string().optional(),
});

export const estimateIsbnComp = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<IsbnComp> => {
    const isbn = data.isbn13.replace(/[^0-9Xx]/g, "");
    const grade = (data.conditionGrade || "VG") as ConditionGrade;
    const key = cacheKey(isbn, grade);
    const hit = cache.get(key);
    if (hit) return hit;

    const format = (data.format || "paperback") as BookFormat;
    const retail = isbn ? await googleRetail(isbn) : null;
    const heuristic = heuristicPrice({
      format,
      publishedYear: data.publishedYear ?? "",
      conditionGrade: grade,
      pages: data.pages ?? null,
    });

    const prompt = `Price THIS used ISBN. Unique to this title — not a generic paperback.

ISBN-13: ${isbn}
Title: ${data.title || "unknown"}
Author: ${data.author || "unknown"}
Publisher: ${data.publisher || "unknown"}
Year: ${data.publishedYear || "unknown"}
Format: ${format}
Pages: ${data.pages ?? "unknown"}
Subjects: ${data.subjects || "unknown"}
Condition: ${grade}
New/retail hint: ${retail != null ? `$${retail.toFixed(2)}` : "unknown"}

Estimate typical 2026 USD sold price for this ISBN in this grade on Amazon used and eBay.

Rules:
- listPrice is what we should ask. Two decimals. Unique to this ISBN.
- Do NOT output 4.99, 5.99, 8.99, or 9.99 unless sold comps for THIS ISBN really cluster there.
- A mass-market classic, a current trade paperback, a hardcover novel, and a STEM textbook must not share a tag.
- low / high are the tight sold range for this ISBN, not the whole category.

Return JSON: { "listPrice": number, "low": number, "high": number, "rationale": string }`;

    const json = await grokComp(prompt);
    const raw = json ? Number(json.listPrice) : NaN;
    const generic = GENERIC.has(Math.round(raw * 100) / 100);

    let listPrice = 0;
    let source: IsbnComp["source"] = "heuristic";
    let rationale = heuristic.rationale;

    if (Number.isFinite(raw) && raw > 0 && !generic) {
      listPrice = moneyPrice(raw);
      source = "isbn-comp";
      rationale = String(json?.rationale || `ISBN ${isbn} used-comp estimate.`);
    } else if (retail && retail > 0) {
      listPrice = moneyPrice(bandFromRetail(retail, grade) + isbnSalt(isbn));
      source = "retail-band";
      rationale = `Used band from listed retail $${retail.toFixed(2)} for ISBN ${isbn}.`;
    } else {
      listPrice = moneyPrice(heuristic.listPrice + isbnSalt(isbn));
      source = "heuristic";
      rationale = `${heuristic.rationale} Salted to ISBN ${isbn} so it is not a shared $4.99.`;
    }

    if (listPrice < 1.5) listPrice = 1.5;

    const low = moneyPrice(Number(json?.low) || listPrice * 0.82);
    const high = moneyPrice(Number(json?.high) || listPrice * 1.18);
    const result: IsbnComp = {
      listPrice,
      low: Math.min(low, listPrice),
      high: Math.max(high, listPrice),
      rationale,
      source,
      isbn13: isbn,
    };
    cache.set(key, result);
    return result;
  });

export function isGenericTag(n: number): boolean {
  return GENERIC.has(Math.round(n * 100) / 100);
}
