import type { BookFormat, ConditionGrade, CopyRecord, ListFormat } from "@/lib/types";

/** eBay Books & Magazines FVF from official seller-center table, 2026. */
export const EBAY_BOOKS_FVF = 0.153;
export const EBAY_ORDER_FEE_UNDER_10 = 0.3;
export const EBAY_ORDER_FEE_OVER_10 = 0.4;

/** Amazon US Media (Books) — sell.amazon.com/pricing, 2026. */
export const AMAZON_REFERRAL = 0.15;
export const AMAZON_CLOSING = 1.8;
export const AMAZON_INDIVIDUAL = 0.99;

/** Conservative USPS Media Mail first pound retail, 2026. */
export const STAMP_FIRST_LB = 4.47;
export const STAMP_EXTRA_LB = 0.75;
export const MAILER = 0.4;
export const MIN_KEEP = 1;

export type KidChoice = "SELL IT" | "TRY THE OTHER SHOP" | "GIVE IT AWAY";

const GRADE_MULT: Record<ConditionGrade, number> = {
  LN: 0.62,
  VG: 0.48,
  G: 0.34,
  A: 0.2,
};

function baseByFormat(format: BookFormat | string, year: string): number {
  const y = Number(year);
  const vintage = Number.isFinite(y) && y > 0 && y < 1980;
  if (format === "textbook") return vintage ? 28 : 24;
  if (format === "hardcover") return vintage ? 14 : 11;
  if (format === "mass-market") return 5.5;
  if (vintage) return 12;
  return 8.5;
}

export function heuristicPrice(input: {
  format: BookFormat | string;
  publishedYear: string;
  conditionGrade: ConditionGrade | "";
  pages: number | null;
}): { listPrice: number; auctionStart: number; listFormat: ListFormat; rationale: string } {
  const grade: ConditionGrade = input.conditionGrade || "G";
  const raw = baseByFormat(input.format, input.publishedYear) * GRADE_MULT[grade];
  const year = Number(input.publishedYear);
  const vintage = Number.isFinite(year) && year > 0 && year < 1975;
  const collectible = vintage && (input.format === "hardcover" || grade === "LN");

  const listPrice = moneyPrice(Math.max(1.5, raw));
  const listFormat: ListFormat = collectible ? "auction" : "bin";
  const auctionStart = collectible ? 9.99 : round99(Math.max(3.99, listPrice * 0.55));

  const rationale = collectible
    ? "Older hardcover with unclear comps — auction finds the price. Start low enough to attract a first bid."
    : "Common used book: Buy It Now keeps control. Price in the used-copy band so it sells without a race to the bottom.";

  return { listPrice, auctionStart, listFormat, rationale };
}

export function round99(n: number): number {
  const x = Math.round(n);
  if (x < 5) return 4.99;
  return x - 0.01;
}

/** Two-decimal money. Does not collapse every cheap book to $4.99. */
export function moneyPrice(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

/** Always round up a cent so net keep never undershoots the goal. */
export function ceilCent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.ceil(n * 100 - 1e-9) / 100;
}

/** Always round down a cent so a hunt max-pay never overshoots the keep. */
export function floorCent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n * 100 + 1e-9) / 100;
}

/** "$5.00", "5", "5.5", "1.00" → dollars. Empty or junk → null. */
export function parseMoneyInput(raw: string): number | null {
  const t = raw.trim().replace(/[$,\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Reverse the shop + envelope + stamp so the tag leaves `keep` in the jar.
 * We wait as long as it takes — this is not a competitive-market guess.
 */
export function listPriceForKeep(input: {
  keep: number;
  format: BookFormat | string;
  shop: "amazon" | "ebay";
  wePayStamp?: boolean;
  pro?: boolean;
}): number {
  const stamp = input.wePayStamp === false ? 0 : stampForWeight(weightForFormat(input.format));
  const mailer = MAILER;
  if (input.shop === "amazon") {
    const individual = input.pro === false ? AMAZON_INDIVIDUAL : 0;
    const fixed = AMAZON_CLOSING + individual + mailer + stamp;
    return ceilCent((Math.max(0, input.keep) + fixed) / (1 - AMAZON_REFERRAL));
  }
  const rate = 1 - EBAY_BOOKS_FVF;
  const high = ceilCent((Math.max(0, input.keep) + EBAY_ORDER_FEE_OVER_10 + mailer + stamp) / rate);
  if (high > 10) return high;
  const low = ceilCent((Math.max(0, input.keep) + EBAY_ORDER_FEE_UNDER_10 + mailer + stamp) / rate);
  if (low <= 10) return low;
  return high;
}

export function copiesPricedToKeep(
  copies: CopyRecord[],
  keep: number | null,
  shop: "amazon" | "ebay",
): CopyRecord[] {
  if (keep == null) return copies;
  return copies.map((c) => ({
    ...c,
    listFormat: "bin" as const,
    listPrice: listPriceForKeep({ keep, format: c.format, shop }),
  }));
}

export function netProceeds(listPrice: number): number {
  const orderFee = listPrice <= 10 ? EBAY_ORDER_FEE_UNDER_10 : EBAY_ORDER_FEE_OVER_10;
  return Math.max(0, listPrice * (1 - EBAY_BOOKS_FVF) - orderFee);
}

export function shouldSkip(listPrice: number): boolean {
  return netProceeds(listPrice) < 2.75;
}

export function money(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export function spokenMoney(n: number): string {
  const abs = Math.abs(n);
  const dollars = Math.floor(abs);
  const cents = Math.round((abs - dollars) * 100);
  const body = cents === 0 ? `${dollars} dollars` : `${dollars} ${String(cents).padStart(2, "0")}`;
  return n < 0 ? `negative ${body}` : body;
}

export function stampForWeight(weightLb: number): number {
  const lb = Math.max(1, Math.ceil(weightLb));
  return STAMP_FIRST_LB + Math.max(0, lb - 1) * STAMP_EXTRA_LB;
}

export function weightForFormat(format: BookFormat | string): number {
  if (format === "textbook") return 3.2;
  if (format === "hardcover") return 1.1;
  if (format === "mass-market") return 0.4;
  return 0.5;
}

export type KidCard = {
  buyerPays: number;
  shopTakes: number;
  stamp: number;
  mailer: number;
  takeShown: number;
  keepAmazon: number;
  keepEbay: number;
  choice: KidChoice;
  why: string;
};

export function kidCard(input: {
  listPrice: number;
  format: BookFormat | string;
  wePayStamp: boolean;
  pro?: boolean;
}): KidCard {
  const price = input.listPrice;
  const stamp = stampForWeight(weightForFormat(input.format));
  const shop = price * AMAZON_REFERRAL + AMAZON_CLOSING + (input.pro === false ? AMAZON_INDIVIDUAL : 0);
  const takeShown = shop + MAILER + (input.wePayStamp ? stamp : 0);
  const keepAmazon = price - takeShown;
  const ebayTotal = price + (input.wePayStamp ? 0 : stamp);
  const ebayFee = ebayTotal * EBAY_BOOKS_FVF + (ebayTotal <= 10 ? EBAY_ORDER_FEE_UNDER_10 : EBAY_ORDER_FEE_OVER_10);
  const keepEbay = price - ebayFee - MAILER - (input.wePayStamp ? stamp : 0);

  let choice: KidChoice;
  let why: string;
  if (keepAmazon >= MIN_KEEP) {
    choice = "SELL IT";
    why = "We keep at least a dollar after the shop, the envelope, and the stamp.";
  } else if (keepEbay >= MIN_KEEP) {
    choice = "TRY THE OTHER SHOP";
    why = "This first shop would leave us too little. The other shop still leaves a dollar.";
  } else {
    choice = "GIVE IT AWAY";
    why = "After the shop and the stamp we keep less than a dollar. Giving it away is the smart shop choice.";
  }

  return {
    buyerPays: price,
    shopTakes: shop,
    stamp,
    mailer: MAILER,
    takeShown,
    keepAmazon,
    keepEbay,
    choice,
    why,
  };
}

export type HuntVerdict = "buy" | "free" | "pass";

export type HuntMath = {
  expectedSale: number;
  netAfterFees: number;
  shop: "amazon" | "ebay";
  stamp: number;
  costs: number;
  keep: number;
  maxPay: number;
  verdict: HuntVerdict;
};

/**
 * Flip the listing math: given what the book will sell for, the most we can
 * pay at the sale and still leave `keep` after shop, envelope, and stamp.
 * Uses the better of Amazon vs eBay net. Rounds max-pay down.
 */
export function maxAcquisition(input: {
  expectedSale: number;
  format: BookFormat | string;
  keep: number;
  wePayStamp?: boolean;
  pro?: boolean;
}): HuntMath {
  const sale = moneyPrice(input.expectedSale);
  const card = kidCard({
    listPrice: sale,
    format: input.format,
    wePayStamp: input.wePayStamp !== false,
    pro: input.pro,
  });
  const shop: "amazon" | "ebay" = card.keepAmazon >= card.keepEbay ? "amazon" : "ebay";
  const net = shop === "amazon" ? card.keepAmazon : card.keepEbay;
  const keep = Math.max(0, input.keep);
  const raw = floorCent(net - keep);
  const verdict: HuntVerdict = raw > 0 ? "buy" : raw === 0 ? "free" : "pass";
  return {
    expectedSale: sale,
    netAfterFees: moneyPrice(net),
    shop,
    stamp: card.stamp,
    costs: moneyPrice(sale - net),
    keep,
    maxPay: raw,
    verdict,
  };
}

/** First few words so the aisle voice stays short. */
export function spokenTitle(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  if (!t || /^\d{10,13}$/.test(t)) return "";
  const head = t.split(/[:(/]/)[0]?.trim() ?? t;
  return head.split(/\s+/).slice(0, 4).join(" ");
}

export function spokenHunt(math: HuntMath, title?: string): string {
  const head = spokenTitle(title ?? "");
  const prefix = head ? `${head}. ` : "";
  if (math.verdict === "pass") return `${prefix}Pass.`;
  if (math.verdict === "free") return `${prefix}Only if it's free.`;
  return `${prefix}Pay up to ${spokenMoney(math.maxPay)}.`;
}

/** Teaching comps so practice hits green, yellow, and red when the stamp is counted. */
export const KID_COMPS: Record<string, number> = {
  "9781285741550": 24.99,
  "9781451673319": 9.25,
  "9780743273565": 8.99,
  "9780618260300": 8.5,
  "9780807508527": 6.5,
  "9780553212679": 2.49,
  "9780451524935": 3.25,
  "9780439023481": 4.99,
};

/** Calculus → Gatsby → Boxcar → F451 → Hobbit → Huck. Two of each color with stamp on. */
export const PRACTICE_ISBNS = [
  "9781285741550",
  "9780743273565",
  "9780807508527",
  "9781451673319",
  "9780618260300",
  "9780553212679",
] as const;

export function kidListPrice(isbn13: string, fallback: number): number {
  return KID_COMPS[isbn13] ?? fallback;
}

export function clipTitle(title: string, max = 80): string {
  const t = title.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

export function buildEbayTitle(input: {
  title: string;
  author: string;
  format: BookFormat | string;
  publishedYear: string;
  conditionGrade: ConditionGrade | "";
}): string {
  const fmt = input.format === "hardcover" ? "Hardcover" : "Paperback";
  const grade = input.conditionGrade ? input.conditionGrade : "";
  const attempts = [
    `${input.title} ${input.author} ${fmt} ${input.publishedYear} ${grade}`.trim(),
    `${input.title} ${input.author} ${fmt} ${input.publishedYear}`.trim(),
    `${input.title} ${input.author} ${fmt}`.trim(),
    `${input.title} ${fmt}`.trim(),
    input.title,
  ];
  return clipTitle(attempts.find((t) => t.length <= 80) ?? input.title);
}

export function buildTemplateDescription(input: {
  title: string;
  author: string;
  publisher: string;
  publishedYear: string;
  format: BookFormat | string;
  pages: number | null;
  language: string;
  isbn13: string;
  conditionDescription: string;
  shippingNote: string;
}): string {
  const lines = [
    `${input.title}`,
    input.author ? `by ${input.author}` : "",
    "",
    [
      input.format ? input.format.replace("-", " ") : "",
      input.publisher,
      input.publishedYear,
      input.pages ? `${input.pages} pages` : "",
      input.language,
    ]
      .filter(Boolean)
      .join(" · "),
    input.isbn13 ? `ISBN ${input.isbn13}` : "",
    "",
    input.conditionDescription,
    "",
    input.shippingNote ||
      "Ships from Lincoln, Nebraska via USPS Media Mail. Packed to survive the trip. Combined shipping on multiple books when the cart allows.",
  ];
  return lines.filter((l, i) => !(l === "" && lines[i - 1] === "")).join("\n");
}
