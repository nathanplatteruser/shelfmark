import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Page = {
  kicker: string;
  child: string;
  parent: string;
  art: "shop" | "gun" | "tag" | "stamp" | "bins" | "six" | "house" | "desk";
};

const PAGES: Page[] = [
  {
    kicker: "The shop",
    child: "We run a book shop.",
    parent:
      "This is our book shop. We find books, we decide if they earn a dollar, and we put them in a bin. You do not have to type a title. The gun and the three bins do the work.",
    art: "shop",
  },
  {
    kicker: "The stripe",
    child: "Point. Beep. That's the book.",
    parent:
      "Every book has a stripe of numbers on the back. Point the gun. The shop reads the stripe. You can also tap a practice book if the gun is charging.",
    art: "gun",
  },
  {
    kicker: "The trap",
    child: "The tag is not the jar.",
    parent:
      "The number on the tag is what a buyer pays. It is not what we keep. The shop takes a cut. The envelope costs money. The stamp costs money. Eight dollars on the spine can be ninety-seven cents in the jar.",
    art: "tag",
  },
  {
    kicker: "The stamp",
    child: "Count the stamp.",
    parent:
      "Leave Count the stamp on. A cheap paperback looks like a sale until the stamp sits on the card. That is the whole lesson. Turn the stamp off only to see the trap, then turn it back on.",
    art: "stamp",
  },
  {
    kicker: "Three bins",
    child: "Green. Ochre. Oxblood.",
    parent:
      "Green: we keep a dollar after the shop, the envelope, and the stamp — sell it. Ochre: this shop is too expensive — try the other shop. Oxblood: we would keep less than a dollar — give it away. Giving it away is a smart shop choice, not a failure.",
    art: "bins",
  },
  {
    kicker: "Practice",
    child: "Six books. Three bins.",
    parent:
      "Practice six books: Calculus, Gatsby, Boxcar, Fahrenheit 451, Hobbit, Huck. With the stamp on, two should be green, two ochre, two oxblood. Tap what the money card says. The ring around a bin is a hint, not a lock.",
    art: "six",
  },
  {
    kicker: "Our house",
    child: "Our house. Our bins.",
    parent:
      "Sold books live in dining-room bins until they ship. We pack them. We do not send the book to a warehouse we cannot see. She gets the factory speed without losing the business lesson.",
    art: "house",
  },
  {
    kicker: "Next door",
    child: "The desk is next door.",
    parent:
      "When you are ready for grades, titles, and the listing files, the grown-up desk is next door. Same shop. More knobs. The jar still counts what we keep.",
    art: "desk",
  },
];

export function StoryBook() {
  const [page, setPage] = useState(0);
  const current = PAGES[page];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Picture book · parent reads</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">The tag is not the jar</h1>
        <p className="mt-2 max-w-xl text-muted">
          Sit together. You read the smaller paragraph. The child follows the picture and the huge line. Tap next when
          they nod.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="story-spread bg-cloth p-6 text-cloth-fg md:p-8">
            <StoryArt kind={current.art} />
          </div>
          <div className="flex flex-col justify-between p-6 md:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted">
                Page {page + 1} of {PAGES.length} · {current.kicker}
              </p>
              <p className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
                {current.child}
              </p>
              <p className="mt-6 text-sm uppercase tracking-[0.18em] text-subtle">Parent, read this</p>
              <p className="mt-2 text-base leading-relaxed text-ink">{current.parent}</p>
            </div>
            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                className="h-12 min-w-24 rounded-md border border-rule px-4 text-sm disabled:opacity-40"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Back
              </button>
              <div className="flex gap-1.5">
                {PAGES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Page ${i + 1}`}
                    onClick={() => setPage(i)}
                    className={cn("size-2.5 rounded-full", i === page ? "bg-ink" : "bg-rule")}
                  />
                ))}
              </div>
              {page < PAGES.length - 1 ? (
                <button
                  type="button"
                  className="h-12 min-w-24 rounded-md bg-cloth px-4 text-sm font-medium text-cloth-fg"
                  onClick={() => setPage((p) => Math.min(PAGES.length - 1, p + 1))}
                >
                  Next
                </button>
              ) : (
                <Link
                  to="/"
                  className="inline-flex h-12 min-w-24 items-center justify-center rounded-md bg-cloth px-4 text-sm font-medium text-cloth-fg no-underline"
                >
                  Open shop
                </Link>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StoryArt({ kind }: { kind: Page["art"] }) {
  return (
    <svg viewBox="0 0 320 240" className="size-full" aria-hidden>
      {kind === "shop" && (
        <>
          <rect x="24" y="48" width="272" height="160" rx="8" fill="#F3EEE4" />
          <rect x="40" y="64" width="48" height="128" fill="#2F463C" />
          <rect x="96" y="80" width="40" height="112" fill="#1C1916" />
          <rect x="144" y="56" width="52" height="136" fill="#8B3A2A" />
          <rect x="204" y="72" width="44" height="120" fill="#3F6B4A" />
          <rect x="256" y="88" width="24" height="104" fill="#8A5A2B" />
          <rect x="40" y="64" width="48" height="10" fill="#8B3A2A" />
        </>
      )}
      {kind === "gun" && (
        <>
          <rect x="36" y="70" width="160" height="110" rx="6" fill="#F3EEE4" />
          <rect x="52" y="150" width="128" height="10" fill="#1C1916" />
          <rect x="52" y="166" width="96" height="6" fill="#1C1916" opacity="0.45" />
          <rect x="220" y="88" width="64" height="28" rx="4" fill="#F3EEE4" />
          <rect x="236" y="116" width="24" height="48" fill="#F3EEE4" />
          <circle cx="200" cy="102" r="6" fill="#8B3A2A" />
        </>
      )}
      {kind === "tag" && (
        <>
          <rect x="48" y="56" width="140" height="140" rx="6" fill="#F3EEE4" />
          <text x="70" y="128" fill="#1C1916" fontFamily="Georgia, serif" fontSize="28">
            $8.00
          </text>
          <line x1="64" y1="116" x2="172" y2="140" stroke="#8B3A2A" strokeWidth="4" />
          <rect x="204" y="88" width="84" height="84" rx="42" fill="#F3EEE4" />
          <text x="218" y="138" fill="#2F463C" fontFamily="Georgia, serif" fontSize="18">
            $0.97
          </text>
        </>
      )}
      {kind === "stamp" && (
        <>
          <rect x="70" y="70" width="180" height="110" rx="8" fill="#F3EEE4" />
          <rect x="92" y="92" width="136" height="66" rx="4" fill="#2F463C" />
          <rect x="108" y="108" width="48" height="34" fill="#F3EEE4" />
          <rect x="164" y="114" width="48" height="8" fill="#F3EEE4" />
          <rect x="164" y="130" width="32" height="8" fill="#F3EEE4" opacity="0.7" />
        </>
      )}
      {kind === "bins" && (
        <>
          <rect x="28" y="80" width="80" height="100" rx="8" fill="#3F6B4A" />
          <rect x="120" y="80" width="80" height="100" rx="8" fill="#8A5A2B" />
          <rect x="212" y="80" width="80" height="100" rx="8" fill="#8B3A2A" />
          <text x="44" y="138" fill="#F3EEE4" fontFamily="Georgia, serif" fontSize="16">
            Sell
          </text>
          <text x="136" y="138" fill="#F3EEE4" fontFamily="Georgia, serif" fontSize="16">
            Other
          </text>
          <text x="234" y="138" fill="#F3EEE4" fontFamily="Georgia, serif" fontSize="16">
            Give
          </text>
        </>
      )}
      {kind === "six" && (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x={36 + i * 44}
              y={70 + (i % 2) * 12}
              width="36"
              height="110"
              fill={i % 3 === 0 ? "#3F6B4A" : i % 3 === 1 ? "#8A5A2B" : "#8B3A2A"}
            />
          ))}
        </>
      )}
      {kind === "house" && (
        <>
          <polygon points="160,36 280,100 40,100" fill="#F3EEE4" />
          <rect x="64" y="100" width="192" height="108" fill="#F3EEE4" />
          <rect x="88" y="140" width="48" height="68" fill="#2F463C" />
          <rect x="152" y="148" width="36" height="36" fill="#8B3A2A" />
          <rect x="200" y="148" width="36" height="36" fill="#3F6B4A" />
        </>
      )}
      {kind === "desk" && (
        <>
          <rect x="40" y="120" width="240" height="16" fill="#F3EEE4" />
          <rect x="56" y="136" width="12" height="56" fill="#F3EEE4" />
          <rect x="252" y="136" width="12" height="56" fill="#F3EEE4" />
          <rect x="72" y="64" width="72" height="56" fill="#2F463C" />
          <rect x="160" y="80" width="100" height="40" rx="4" fill="#F3EEE4" />
          <rect x="172" y="92" width="76" height="8" fill="#1C1916" opacity="0.35" />
        </>
      )}
    </svg>
  );
}
