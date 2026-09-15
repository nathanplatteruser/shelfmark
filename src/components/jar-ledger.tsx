import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { SessionPack } from "@/components/session-pack";
import { EMPTY_JAR, readJar, resetJar, type JarState } from "@/lib/kid-jar";
import { listCopies } from "@/lib/copies-api";
import { money, type KidChoice } from "@/lib/pricing";
import type { CopyRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHOICE_TONE: Record<KidChoice, string> = {
  "SELL IT": "bg-good text-good-fg",
  "TRY THE OTHER SHOP": "bg-warn text-elevated",
  "GIVE IT AWAY": "bg-stamp text-stamp-fg",
};

export function JarLedger() {
  const [jar, setJar] = useState<JarState>(() => (typeof window === "undefined" ? EMPTY_JAR : readJar()));
  const [copies, setCopies] = useState<CopyRecord[]>([]);
  const gap = useMemo(() => jar.buyerPaid - jar.weKeep, [jar]);

  useEffect(() => {
    void listCopies({ data: { status: "all" } }).then((rows) => setCopies(rows));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted">The jar</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Buyer paid is not we keep</h1>
        <p className="mt-2 max-w-xl text-muted">
          Every tap in the shop writes a line here. The left number is the tag. The right number is the jar.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Buyer paid</p>
          <p className="mt-2 font-display text-5xl font-semibold tabular-nums tracking-tight">{money(jar.buyerPaid)}</p>
          <p className="mt-3 text-sm text-muted">What the tag said, added up.</p>
        </Card>
        <Card data-tour="jar-keep" className="border-cloth bg-cloth p-6 text-cloth-fg">
          <p className="text-xs uppercase tracking-[0.22em] text-cloth-fg/70">We keep</p>
          <p className="mt-2 font-display text-5xl font-semibold tabular-nums tracking-tight">{money(jar.weKeep)}</p>
          <p className="mt-3 text-sm text-cloth-fg/80">
            After the shop, the envelope, and the stamp. Gap {money(gap)}.
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Sell it" value={jar.sold} tone="bg-good text-good-fg" />
        <Stat label="Other shop" value={jar.other} tone="bg-warn text-elevated" />
        <Stat label="Give away" value={jar.given} tone="bg-stamp text-stamp-fg" />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold">Today's line</h2>
          <button
            type="button"
            className="h-11 rounded-md border border-rule px-4 text-sm"
            onClick={() => setJar(resetJar())}
          >
            Empty the jar
          </button>
        </div>
        {jar.log.length === 0 ? (
          <p className="text-muted">
            Nothing in the jar yet.{" "}
            <Link to="/" className="text-ink underline decoration-rule underline-offset-4">
              Open the shop
            </Link>{" "}
            and sort a practice book.
          </p>
        ) : (
          <ul className="divide-y divide-rule">
            {jar.log.map((row, i) => (
              <li key={`${row.at}-${i}`} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
                <div>
                  <p className="font-display text-lg font-semibold leading-tight">{row.title}</p>
                  <span className={cn("mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs", CHOICE_TONE[row.choice])}>
                    {row.choice}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted">tag {money(row.buyerPays)}</p>
                  <p className="font-display text-xl tabular-nums">keep {money(row.keep)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SessionPack copies={copies} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={cn("rounded-xl p-4", tone)}>
      <p className="text-xs uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="font-display text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
