import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  TOUR_START_EVENT,
  TOUR_STEPS,
  findTourTarget,
  shouldOfferTour,
  wantsForcedTour,
  writeTourStatus,
  type TourStep,
} from "@/lib/tour";
import { cn } from "@/lib/utils";

type Phase = "off" | "invite" | "step" | "done";

type Box = { top: number; left: number; width: number; height: number };

export function ClickTour() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [phase, setPhase] = useState<Phase>("off");
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubblePos, setBubblePos] = useState<{ top: number; left: number }>({ top: 24, left: 24 });

  const step: TourStep | undefined = TOUR_STEPS[index];

  const closeAs = useCallback((status: "skipped" | "done") => {
    writeTourStatus(status);
    setPhase("off");
    setIndex(0);
    setBox(null);
  }, []);

  const start = useCallback(() => {
    setIndex(0);
    setPhase("step");
    void navigate({ to: "/" });
  }, [navigate]);

  useEffect(() => {
    const boot = () => {
      if (wantsForcedTour()) {
        start();
        return;
      }
      if (shouldOfferTour()) setPhase("invite");
    };
    const id = window.setTimeout(boot, 80);
    const onStart = () => start();
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener(TOUR_START_EVENT, onStart);
    };
  }, [start]);

  useEffect(() => {
    if (phase !== "step" || !step) return;
    if (pathname !== step.route) void navigate({ to: step.route });
  }, [phase, step, pathname, navigate]);

  useEffect(() => {
    if (phase !== "step" || !step) return;
    if (pathname !== step.route) return;

    let alive = true;
    let tries = 0;
    const measure = () => {
      if (!alive) return false;
      const el = findTourTarget(step.target);
      if (!el) return false;
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
      return true;
    };

    const tick = () => {
      if (measure()) return;
      tries += 1;
      if (tries < 40) window.setTimeout(tick, 50);
      else setBox(null);
    };
    const t = window.setTimeout(tick, 80);
    const onWin = () => {
      measure();
    };
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      alive = false;
      window.clearTimeout(t);
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [phase, step, pathname]);

  useLayoutEffect(() => {
    if (phase !== "step" || !box) return;
    const bubble = bubbleRef.current;
    const bw = bubble?.offsetWidth || 320;
    const bh = bubble?.offsetHeight || 200;
    const pad = 12;
    const gap = 14;
    const preferBottom = step?.place !== "top";
    let top = preferBottom ? box.top + box.height + gap : box.top - bh - gap;
    if (top + bh > window.innerHeight - pad) top = box.top - bh - gap;
    if (top < pad) top = Math.min(box.top + box.height + gap, window.innerHeight - bh - pad);
    if (top < pad) top = pad;
    let left = box.left + box.width / 2 - bw / 2;
    left = Math.min(Math.max(pad, left), window.innerWidth - bw - pad);
    setBubblePos({ top, left });
  }, [phase, box, step, index]);

  useEffect(() => {
    if (phase === "off") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAs("skipped");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, closeAs]);

  if (phase === "off") return null;

  if (phase === "invite") {
    return (
      <div className="tour-scrim" role="dialog" aria-modal="true" aria-labelledby="tour-invite-title">
        <div className="tour-invite">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">First time here?</p>
          <h2 id="tour-invite-title" className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Want a click-along?
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted">
            Parent reads the small line. Child follows the big line. Bubbles point at the real
            buttons — Shop, Jar, then Reel. No video. No document.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="h-14 rounded-lg bg-cloth px-5 text-base font-medium text-cloth-fg"
              onClick={start}
              autoFocus
            >
              Yes, show me
            </button>
            <button
              type="button"
              className="h-14 rounded-lg border border-rule bg-elevated px-5 text-base"
              onClick={() => closeAs("skipped")}
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "done" || !step) {
    return (
      <div className="tour-scrim" role="dialog" aria-modal="true">
        <div className="tour-invite">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">That is the walk-through</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">Sort a book. Count the stamp.</h2>
          <p className="mt-3 text-base leading-relaxed text-muted">
            Practice six spines. The green bin keeps a dollar. The jar is what stays after the shop,
            the envelope, and the stamp. Replay any time from Playbook.
          </p>
          <button
            type="button"
            className="mt-6 h-14 rounded-lg bg-cloth px-5 text-base font-medium text-cloth-fg"
            onClick={() => {
              closeAs("done");
              void navigate({ to: "/" });
            }}
          >
            Open the shop
          </button>
        </div>
      </div>
    );
  }

  const n = index + 1;
  const total = TOUR_STEPS.length;

  return (
    <div className="tour-layer" aria-live="polite">
      <Spotlight box={box} />
      <div
        ref={bubbleRef}
        className="tour-bubble"
        style={{ top: bubblePos.top, left: bubblePos.left }}
        role="dialog"
        aria-labelledby="tour-child"
      >
        <p className="text-xs uppercase tracking-[0.22em] text-muted">
          Step {n} of {total}
        </p>
        <p id="tour-child" className="mt-2 font-display text-2xl font-semibold leading-tight tracking-tight">
          {step.child}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{step.parent}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="h-11 rounded-md border border-rule px-3 text-sm"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            Back
          </button>
          <button
            type="button"
            className="h-11 rounded-md bg-cloth px-4 text-sm font-medium text-cloth-fg"
            onClick={() => {
              if (index + 1 >= TOUR_STEPS.length) setPhase("done");
              else setIndex((i) => i + 1);
            }}
          >
            {index + 1 >= TOUR_STEPS.length ? "Finish" : "Next"}
          </button>
          <button
            type="button"
            className="ml-auto h-11 px-2 text-sm text-muted"
            onClick={() => closeAs("skipped")}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function Spotlight({ box }: { box: Box | null }) {
  if (!box) return <div className="tour-pane bg-ink/45 inset-0" />;
  const pad = 8;
  const top = Math.max(0, box.top - pad);
  const left = Math.max(0, box.left - pad);
  const width = box.width + pad * 2;
  const height = box.height + pad * 2;
  const shade = "tour-pane bg-ink/45";
  return (
    <>
      <div className={shade} style={{ top: 0, left: 0, right: 0, height: top }} />
      <div className={shade} style={{ top, left: 0, width: left, height }} />
      <div className={shade} style={{ top, left: left + width, right: 0, height }} />
      <div className={shade} style={{ top: top + height, left: 0, right: 0, bottom: 0 }} />
      <div className={cn("tour-ring")} style={{ top, left, width, height }} />
    </>
  );
}
