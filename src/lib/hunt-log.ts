const KEY = "shelfmark.huntLog";
const MAX = 50;

export type HuntLogRow = {
  isbn13: string;
  title: string;
  maxPay: number;
  verdict: "buy" | "free" | "pass";
  expectedSale: number;
  keep: number;
  t: number;
};

export function readHuntLog(): HuntLogRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HuntLogRow[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushHuntLog(row: HuntLogRow): HuntLogRow[] {
  const next = [row, ...readHuntLog().filter((r) => r.isbn13 !== row.isbn13)].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

export function clearHuntLog() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
