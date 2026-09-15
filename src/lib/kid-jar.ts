import type { KidChoice } from "@/lib/pricing";

const KEY = "shelfmark-jar-v1";

export type JarEntry = {
  title: string;
  choice: KidChoice;
  buyerPays: number;
  keep: number;
  at: string;
};

export type JarState = {
  buyerPaid: number;
  weKeep: number;
  sold: number;
  other: number;
  given: number;
  log: JarEntry[];
};

export const EMPTY_JAR: JarState = {
  buyerPaid: 0,
  weKeep: 0,
  sold: 0,
  other: 0,
  given: 0,
  log: [],
};

export function readJar(): JarState {
  if (typeof window === "undefined") return EMPTY_JAR;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_JAR;
    const parsed = JSON.parse(raw) as Partial<JarState>;
    return {
      buyerPaid: Number(parsed.buyerPaid) || 0,
      weKeep: Number(parsed.weKeep) || 0,
      sold: Number(parsed.sold) || 0,
      other: Number(parsed.other) || 0,
      given: Number(parsed.given) || 0,
      log: Array.isArray(parsed.log) ? parsed.log.slice(0, 40) : [],
    };
  } catch {
    return EMPTY_JAR;
  }
}

export function writeJar(state: JarState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function addToJar(input: {
  title: string;
  choice: KidChoice;
  buyerPays: number;
  keep: number;
}): JarState {
  const prev = readJar();
  const keep = input.choice === "GIVE IT AWAY" ? 0 : input.keep;
  const buyer = input.choice === "GIVE IT AWAY" ? 0 : input.buyerPays;
  const next: JarState = {
    buyerPaid: prev.buyerPaid + buyer,
    weKeep: prev.weKeep + Math.max(0, keep),
    sold: prev.sold + (input.choice === "SELL IT" ? 1 : 0),
    other: prev.other + (input.choice === "TRY THE OTHER SHOP" ? 1 : 0),
    given: prev.given + (input.choice === "GIVE IT AWAY" ? 1 : 0),
    log: [
      {
        title: input.title,
        choice: input.choice,
        buyerPays: buyer,
        keep,
        at: new Date().toISOString(),
      },
      ...prev.log,
    ].slice(0, 40),
  };
  writeJar(next);
  return next;
}

export function resetJar(): JarState {
  writeJar(EMPTY_JAR);
  return EMPTY_JAR;
}
