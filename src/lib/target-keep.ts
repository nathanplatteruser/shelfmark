const KEY = "shelfmark.targetKeep";

export function readTargetKeep(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  } catch {
    return null;
  }
}

export function writeTargetKeep(keep: number | null) {
  if (typeof window === "undefined") return;
  try {
    if (keep == null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, String(keep));
  } catch {
    /* ignore quota */
  }
}
