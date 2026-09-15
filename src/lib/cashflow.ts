import {
  AMAZON_CLOSING,
  AMAZON_REFERRAL,
  EBAY_BOOKS_FVF,
  EBAY_ORDER_FEE_OVER_10,
  EBAY_ORDER_FEE_UNDER_10,
  MAILER,
  money,
  stampForWeight,
  weightForFormat,
} from "@/lib/pricing";
export { money };
import { LISTABLE_CHANNELS, type ChannelDef } from "@/lib/channels";
import type { BookFormat, ConditionGrade } from "@/lib/types";

/** Opportunity cost used for the tiny present-value check. Not a bank model. */
export const DISCOUNT_RATE = 0.1;

export type FeeNote = "confirmed" | "estimate";

export type ChannelLine = {
  slug: string;
  name: string;
  mark: string;
  gross: number;
  fees: number;
  feeRateLabel: string;
  feeNote: FeeNote;
  shipping: number;
  mailer: number;
  net: number;
  days: number;
  daysNote: "estimate";
  netPerDay: number;
  presentValue: number;
};

export type JewelKind = "perDay" | "mostMoney" | "fastest";

export type BookTicket = {
  gross: number;
  shipping: number;
  mailer: number;
  stampLb: number;
  lines: ChannelLine[];
  jewels: {
    perDay: ChannelLine;
    mostMoney: ChannelLine;
    fastest: ChannelLine;
  };
  summary: string;
};

export type ScoreInput = {
  format: BookFormat | string;
  publishedYear: string;
  conditionGrade: ConditionGrade | "";
  listPrice: number;
  pages?: number | null;
  subjects?: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ebayFees(gross: number): number {
  const order = gross <= 10 ? EBAY_ORDER_FEE_UNDER_10 : EBAY_ORDER_FEE_OVER_10;
  return gross * EBAY_BOOKS_FVF + order;
}

function amazonFees(gross: number): number {
  return gross * AMAZON_REFERRAL + AMAZON_CLOSING;
}

/** AbeBooks Premium: 8% commission (min $0.50, max $40) + 5.5% payment processing. */
function abebooksFees(gross: number): number {
  const commission = Math.min(40, Math.max(0.5, gross * 0.08));
  return commission + gross * 0.055;
}

/** Biblio Option A: 12% (max $40) + $0.25 closing + 5.5% processing + $0.20. */
function biblioFees(gross: number): number {
  const commission = Math.min(40, gross * 0.12);
  return commission + 0.25 + gross * 0.055 + 0.2;
}

/** Alibris marketplace 15% (min $0.50). Closing fee is variable — $0.99 is an estimate. */
function alibrisFees(gross: number): number {
  return Math.max(0.5, gross * 0.15) + 0.99;
}

const FEE_FNS: Record<string, (gross: number) => { fees: number; label: string; note: FeeNote }> = {
  ebay: (g) => ({
    fees: ebayFees(g),
    label: "15.3% + $0.30/$0.40",
    note: "confirmed",
  }),
  amazon: (g) => ({
    fees: amazonFees(g),
    label: "15% + $1.80 closing",
    note: "confirmed",
  }),
  abebooks: (g) => ({
    fees: abebooksFees(g),
    label: "8% + 5.5% processing",
    note: "confirmed",
  }),
  biblio: (g) => ({
    fees: biblioFees(g),
    label: "12% + $0.25 + processing",
    note: "confirmed",
  }),
  alibris: (g) => ({
    fees: alibrisFees(g),
    label: "15% + ~$0.99 closing",
    note: "estimate",
  }),
};

/** Median days-to-sale for a common used copy. Estimates, not comps. */
const BASE_DAYS: Record<string, number> = {
  ebay: 18,
  amazon: 11,
  abebooks: 32,
  biblio: 48,
  alibris: 38,
};

function estimateDays(input: ScoreInput, slug: string): number {
  let days = BASE_DAYS[slug] ?? 30;
  const format = input.format;
  const year = Number(input.publishedYear);
  const vintage = Number.isFinite(year) && year > 0 && year < 1980;
  const subjects = (input.subjects ?? "").toLowerCase();
  const textbookish = format === "textbook" || subjects.includes("textbook") || subjects.includes("college");

  if (textbookish) {
    if (slug === "amazon") days *= 0.55;
    else if (slug === "ebay") days *= 0.85;
    else days *= 1.1;
  } else if (format === "mass-market") {
    days *= slug === "amazon" || slug === "ebay" ? 1.05 : 1.2;
  } else if (vintage && (format === "hardcover" || format === "other")) {
    if (slug === "abebooks" || slug === "biblio") days *= 0.72;
    if (slug === "amazon") days *= 1.25;
  }

  const grade = input.conditionGrade || "G";
  if (grade === "LN") days *= 0.85;
  else if (grade === "VG") days *= 0.95;
  else if (grade === "A") days *= 1.35;

  if (input.listPrice >= 24) days *= 1.2;
  else if (input.listPrice < 6 && (slug === "amazon" || slug === "ebay")) days *= 0.9;

  return Math.max(4, Math.min(120, Math.round(days)));
}

function presentValue(net: number, days: number): number {
  return round2(net / (1 + DISCOUNT_RATE * (days / 365)));
}

function lineFor(ch: ChannelDef, input: ScoreInput, shipping: number, mailer: number): ChannelLine {
  const gross = round2(input.listPrice);
  const fn = FEE_FNS[ch.slug];
  const fee = fn ? fn(gross) : { fees: gross * 0.15, label: "15% stand-in", note: "estimate" as const };
  const fees = round2(fee.fees);
  const net = round2(gross - fees - shipping - mailer);
  const days = estimateDays(input, ch.slug);
  return {
    slug: ch.slug,
    name: ch.name,
    mark: ch.mark,
    gross,
    fees,
    feeRateLabel: fee.label,
    feeNote: fee.note,
    shipping,
    mailer,
    net,
    days,
    daysNote: "estimate",
    netPerDay: round2(net / days),
    presentValue: presentValue(net, days),
  };
}

function pickBest(lines: ChannelLine[], key: (l: ChannelLine) => number, preferMax: boolean): ChannelLine {
  return lines.reduce((best, line) => {
    const a = key(line);
    const b = key(best);
    if (preferMax ? a > b : a < b) return line;
    if (a === b) {
      const order = ["amazon", "ebay", "abebooks", "biblio", "alibris"];
      return order.indexOf(line.slug) < order.indexOf(best.slug) ? line : best;
    }
    return best;
  });
}

export function scoreBook(input: ScoreInput): BookTicket {
  const weightLb = weightForFormat(input.format);
  const stamp = stampForWeight(weightLb);
  const shipping = round2(stamp);
  const mailer = MAILER;
  const lines = LISTABLE_CHANNELS.map((ch) => lineFor(ch, input, shipping, mailer));
  const perDay = pickBest(lines, (l) => l.netPerDay, true);
  const mostMoney = pickBest(lines, (l) => l.net, true);
  const fastest = pickBest(lines, (l) => l.days, false);
  return {
    gross: round2(input.listPrice),
    shipping,
    mailer,
    stampLb: Math.max(1, Math.ceil(weightLb)),
    lines,
    jewels: { perDay, mostMoney, fastest },
    summary: jewelSummary({ perDay, mostMoney, fastest }),
  };
}

export function jewelSummary(jewels: BookTicket["jewels"]): string {
  return [
    `Jewel ${jewels.perDay.name} ${money(jewels.perDay.netPerDay)}/day`,
    `Most ${jewels.mostMoney.name} ${money(jewels.mostMoney.net)}`,
    `Fastest ${jewels.fastest.name} ~${jewels.fastest.days}d`,
  ].join(" · ");
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sequential scoring so a pile over 10 books can show a progress bar. */
export async function scoreQueue<T>(
  items: T[],
  scoreOne: (item: T, index: number) => BookTicket,
  onProgress: (done: number, total: number, item: T) => void,
  delayMs = 110,
): Promise<BookTicket[]> {
  const tickets: BookTicket[] = [];
  const showBar = items.length > 10;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    tickets.push(scoreOne(item, i));
    onProgress(i + 1, items.length, item);
    if (showBar) await wait(delayMs);
  }
  return tickets;
}
