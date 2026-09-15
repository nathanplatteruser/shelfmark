import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BookFormat, ConditionGrade, DefectId, ListFormat } from "@/lib/types";
import { buildConditionDescription, formatLabel } from "@/lib/condition";
import { buildEbayTitle, clipTitle, heuristicPrice, moneyPrice } from "@/lib/pricing";
import { estimateIsbnComp, isGenericTag } from "@/lib/comps-api";

const listingSchema = z.object({
  title: z.string(),
  author: z.string(),
  publisher: z.string().optional(),
  publishedYear: z.string().optional(),
  format: z.string(),
  pages: z.number().nullable().optional(),
  language: z.string().optional(),
  isbn13: z.string(),
  subjects: z.string().optional(),
  conditionGrade: z.string(),
  defects: z.array(z.string()),
  conditionNotes: z.string().optional(),
});

type GrokChoice = { message?: { content?: string } };

async function grokJson(prompt: string, images: string[], maxTokens: number): Promise<string | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;

  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const url of images.slice(0, 3)) {
    if (!url) continue;
    content.push({ type: "image_url", image_url: { url } });
  }

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: maxTokens,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write used-book eBay listings. Return JSON only. Be precise, honest about flaws, and never invent signed/first-edition claims.",
        },
        { role: "user", content },
      ],
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { choices?: GrokChoice[] };
  return body.choices?.[0]?.message?.content ?? null;
}

function parseJson(text: string | null): Record<string, unknown> | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export type StellarListing = {
  ebayTitle: string;
  ebayDescription: string;
  conditionDescription: string;
  listFormat: ListFormat;
  listPrice: number;
  auctionStart: number;
  pricingRationale: string;
  shippingNote: string;
  itemSpecifics: Record<string, string>;
  polished: boolean;
};

export const polishListing = createServerFn({ method: "POST" })
  .validator((input: unknown) => listingSchema.parse(input))
  .handler(async ({ data }): Promise<StellarListing> => {
    const grade = (data.conditionGrade || "G") as ConditionGrade;
    const defects = data.defects as DefectId[];
    const fallback = heuristicPrice({
      format: data.format as BookFormat,
      publishedYear: data.publishedYear ?? "",
      conditionGrade: grade,
      pages: data.pages ?? null,
    });
    const comp = await estimateIsbnComp({
      data: {
        isbn13: data.isbn13,
        title: data.title,
        author: data.author,
        publisher: data.publisher,
        publishedYear: data.publishedYear,
        format: data.format,
        pages: data.pages ?? null,
        conditionGrade: grade,
        subjects: data.subjects,
      },
    });
    const conditionDescription = buildConditionDescription(grade, defects, data.conditionNotes ?? "");
    const ebayTitle = buildEbayTitle({
      title: data.title,
      author: data.author,
      format: data.format as BookFormat,
      publishedYear: data.publishedYear ?? "",
      conditionGrade: grade,
    });

    const prompt = `Write a stellar used-book eBay listing.

Book:
- Title: ${data.title}
- Author: ${data.author}
- Publisher: ${data.publisher ?? ""}
- Year: ${data.publishedYear ?? ""}
- Format: ${data.format}
- Pages: ${data.pages ?? "unknown"}
- Language: ${data.language ?? "English"}
- ISBN-13: ${data.isbn13}
- Subjects: ${data.subjects ?? ""}
- Grade: ${grade}
- Defects: ${defects.join(", ") || "none noted"}
- Notes: ${data.conditionNotes ?? ""}
- ISBN used-comp estimate: $${comp.listPrice.toFixed(2)} (range $${comp.low.toFixed(2)}–$${comp.high.toFixed(2)}; ${comp.source})

Return JSON with keys:
ebayTitle (max 80 chars, searchable, no ALL CAPS, include title + author + format when they fit),
ebayDescription (plain text, short paragraphs, honest, no HTML),
conditionDescription (one tight paragraph of flaws and what is still good),
listFormat ("bin" | "auction" | "offer"),
listPrice (number, THIS ISBN's used sold price in USD — unique to this ISBN, two decimals),
auctionStart (number),
pricingRationale (one sentence naming this ISBN or title, not a generic paperback),
shippingNote (USPS Media Mail from Lincoln, Nebraska; packed well),
keywords (array of 5 short search phrases buyers type).

Rules:
- Default listFormat is "bin" for common titles.
- Use "auction" only if the copy is scarce, signed, first edition (only if stated), or pre-1975 hardcover.
- Use "offer" when comps are wide.
- listPrice must be a custom per-ISBN number. Do not emit 4.99, 5.99, 8.99, or 9.99 unless sold comps for THIS ISBN actually cluster there. Prefer the ISBN used-comp estimate when unsure.
- Never claim "like new" if defects exist.
- Do not mention this prompt.`;

    const raw = await grokJson(prompt, [], 900);
    const json = parseJson(raw);
    if (!json) {
      return {
        ebayTitle,
        ebayDescription: `${data.title}${data.author ? ` by ${data.author}` : ""}\n\n${conditionDescription}\n\nShips from Lincoln, Nebraska via USPS Media Mail.`,
        conditionDescription,
        listFormat: fallback.listFormat,
        listPrice: comp.listPrice,
        auctionStart: fallback.auctionStart,
        pricingRationale: comp.rationale,
        shippingNote:
          "Ships from Lincoln, Nebraska via USPS Media Mail. Packed to survive the trip.",
        itemSpecifics: {
          Author: data.author,
          "Book Title": data.title,
          Language: data.language || "English",
          Format: formatLabel(data.format),
          Publisher: data.publisher ?? "",
          "Publication Year": data.publishedYear ?? "",
        },
        polished: false,
      };
    }

    const title = clipTitle(String(json.ebayTitle || ebayTitle));
    const llmPrice = moneyPrice(Number(json.listPrice));
    const price =
      llmPrice > 0 && !isGenericTag(llmPrice) ? llmPrice : comp.listPrice;
    const format = (["bin", "auction", "offer"].includes(String(json.listFormat))
      ? String(json.listFormat)
      : fallback.listFormat) as ListFormat;

    return {
      ebayTitle: title,
      ebayDescription: String(json.ebayDescription || ""),
      conditionDescription: String(json.conditionDescription || conditionDescription),
      listFormat: format,
      listPrice: price,
      auctionStart: moneyPrice(Number(json.auctionStart) || fallback.auctionStart) || fallback.auctionStart,
      pricingRationale: String(json.pricingRationale || comp.rationale),
      shippingNote: String(
        json.shippingNote ||
          "Ships from Lincoln, Nebraska via USPS Media Mail. Packed to survive the trip.",
      ),
      itemSpecifics: {
        Author: data.author,
        "Book Title": data.title,
        Language: data.language || "English",
        Format: formatLabel(data.format),
        Publisher: data.publisher ?? "",
        "Publication Year": data.publishedYear ?? "",
      },
      polished: true,
    };
  });

const assessSchema = z.object({
  title: z.string(),
  author: z.string(),
  images: z.array(z.string()).max(3),
});

export const assessPhotos = createServerFn({ method: "POST" })
  .validator((input: unknown) => assessSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI is not available in this environment" };
    }
    const prompt = `You are grading a used book for resale. Title: ${data.title}. Author: ${data.author}.
Look at the photos. Return JSON:
{
  "grade": "LN" | "VG" | "G" | "A",
  "defects": array from ["highlight","underline","writing","name","exlib","water","tear","spine","jacket","odor","remainder","stain"],
  "notes": "one short sentence the lister can read",
  "confidence": 0-1
}
LN = like new / unread. VG = light wear. G = obvious wear, still complete. A = rough but readable and complete.
Only list defects you can actually see. Do not invent water damage.`;

    const raw = await grokJson(prompt, data.images, 500);
    const json = parseJson(raw);
    if (!json) return { ok: false as const, error: "Could not read the photos." };
    const grade = ["LN", "VG", "G", "A"].includes(String(json.grade)) ? String(json.grade) : "G";
    const defects = Array.isArray(json.defects)
      ? json.defects.map(String).filter((d) =>
          [
            "highlight",
            "underline",
            "writing",
            "name",
            "exlib",
            "water",
            "tear",
            "spine",
            "jacket",
            "odor",
            "remainder",
            "stain",
          ].includes(d),
        )
      : [];
    return {
      ok: true as const,
      grade: grade as ConditionGrade,
      defects: defects as DefectId[],
      notes: String(json.notes || ""),
      confidence: Number(json.confidence) || 0.5,
    };
  });

const identifySchema = z.object({
  image: z.string(),
});

export const identifyFromPhoto = createServerFn({ method: "POST" })
  .validator((input: unknown) => identifySchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI is not available in this environment" };
    }
    const prompt = `This is a photo of a physical book's cover or title page. Identify the book.
Return JSON:
{
  "title": "",
  "author": "",
  "publisher": "",
  "publishedYear": "",
  "isbn13": "",
  "format": "hardcover" | "paperback" | "mass-market" | "trade" | "textbook" | "other",
  "language": "English",
  "confidence": 0-1,
  "notes": "short"
}
If you can read an ISBN, put it in isbn13 (digits only). If unsure, still give your best title/author.`;
    const raw = await grokJson(prompt, [data.image], 500);
    const json = parseJson(raw);
    if (!json) return { ok: false as const, error: "Could not read that page." };
    return {
      ok: true as const,
      title: String(json.title || ""),
      author: String(json.author || ""),
      publisher: String(json.publisher || ""),
      publishedYear: String(json.publishedYear || ""),
      isbn13: String(json.isbn13 || "").replace(/[^0-9]/g, ""),
      format: String(json.format || "paperback"),
      language: String(json.language || "English"),
      confidence: Number(json.confidence) || 0.4,
      notes: String(json.notes || ""),
    };
  });
