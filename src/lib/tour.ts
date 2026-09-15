import { readJar } from "@/lib/kid-jar";

export const TOUR_STORAGE_KEY = "shelfmark.tour.v1";
export const TOUR_KNOWN_KEY = "shelfmark.known";
export const TOUR_START_EVENT = "shelfmark:start-tour";

export type TourStatus = "unseen" | "skipped" | "done";

export type TourStep = {
  id: string;
  route: "/" | "/jar" | "/reel";
  target: string;
  parent: string;
  child: string;
  place: "top" | "bottom";
};

type StoredTour = { status: TourStatus };

export const TOUR_STEPS: TourStep[] = [
  {
    id: "shop-practice",
    route: "/",
    target: "shop-practice",
    parent: "Six real books. No typing. The child taps a spine, then a bin.",
    child: "Start practice is this button.",
    place: "bottom",
  },
  {
    id: "shop-camera",
    route: "/",
    target: "shop-camera",
    parent: "When the pile is real, the camera or a grocery gun reads the barcode.",
    child: "Camera lives here.",
    place: "bottom",
  },
  {
    id: "shop-stamp",
    route: "/",
    target: "shop-stamp",
    parent: "Leave this on. An eight-dollar paperback can leave less than a dollar after the stamp.",
    child: "Count the stamp.",
    place: "bottom",
  },
  {
    id: "nav-jar",
    route: "/",
    target: "nav-jar",
    parent: "Every sort writes a line. Buyer paid is not we keep.",
    child: "Tap Jar next.",
    place: "bottom",
  },
  {
    id: "jar-keep",
    route: "/jar",
    target: "jar-keep",
    parent: "The cloth card is the money that actually stays after the shop, the envelope, and the stamp.",
    child: "This number is the jar.",
    place: "bottom",
  },
  {
    id: "nav-reel",
    route: "/jar",
    target: "nav-reel",
    parent: "When a pile is ready, the reel is the packing-line cadence.",
    child: "Reel is this tab.",
    place: "bottom",
  },
  {
    id: "reel-drill",
    route: "/reel",
    target: "reel-drill",
    parent: "Eight books, one-second beats. Learn the motion without a camera.",
    child: "Quick drill is this card.",
    place: "top",
  },
  {
    id: "reel-minute",
    route: "/reel",
    target: "reel-minute",
    parent: "Twenty books in sixty seconds. That is the takt.",
    child: "One minute is this card.",
    place: "top",
  },
  {
    id: "reel-camera",
    route: "/reel",
    target: "reel-camera",
    parent: "Live listing: back camera on a phone, webcam on a laptop, or a USB gun. A still is grabbed when the ISBN lands.",
    child: "Camera and gun.",
    place: "top",
  },
];

function readStored(): StoredTour {
  if (typeof window === "undefined") return { status: "unseen" };
  try {
    const raw = window.localStorage.getItem(TOUR_STORAGE_KEY);
    if (!raw) return { status: "unseen" };
    const parsed = JSON.parse(raw) as Partial<StoredTour>;
    if (parsed.status === "skipped" || parsed.status === "done") return { status: parsed.status };
    return { status: "unseen" };
  } catch {
    return { status: "unseen" };
  }
}

export function writeTourStatus(status: TourStatus) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify({ status }));
  if (status === "skipped" || status === "done") markKnownVisitor();
}

export function markKnownVisitor() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOUR_KNOWN_KEY, "1");
}

/**
 * True only when we can prove this browser already used Shelfmark.
 * A bare first paint is not enough — the invite must still be allowed.
 */
export function isKnownVisitor(): boolean {
  if (typeof window === "undefined") return false;
  const stored = readStored();
  if (stored.status === "skipped" || stored.status === "done") return true;
  if (window.localStorage.getItem(TOUR_KNOWN_KEY) === "1") return true;
  try {
    if (readJar().log.length > 0) return true;
  } catch {
    /* jar unread */
  }
  return false;
}

export function shouldOfferTour(): boolean {
  return !isKnownVisitor();
}

export function wantsForcedTour(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("tour") === "1";
}

export function requestTour() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TOUR_START_EVENT));
}

export function findTourTarget(id: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`));
  const visible = nodes.find((n) => {
    const r = n.getBoundingClientRect();
    const style = window.getComputedStyle(n);
    return r.width > 2 && r.height > 2 && style.visibility !== "hidden" && style.display !== "none";
  });
  return visible ?? nodes[0] ?? null;
}
