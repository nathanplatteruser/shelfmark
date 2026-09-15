import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bootstrapCrew, listCrew, setStationDuty } from "@/lib/crew-api";
import type { CrewStation } from "@/lib/types";

export const Route = createFileRoute("/crew")({ component: CrewPage });

function CrewPage() {
  const [stations, setStations] = useState<CrewStation[]>([]);

  const refresh = useCallback(async () => {
    const rows = await bootstrapCrew();
    setStations(rows);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function toggle(slug: string, onDuty: boolean) {
    await setStationDuty({ data: { slug, onDuty } });
    setStations(await listCrew());
  }

  const onDuty = stations.filter((s) => s.onDuty);
  const today = stations.reduce((n, s) => n + s.todayCount, 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Family shop</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Crew stations
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Roles, not names. Ages five to eighteen can run a lane if the work is a checklist.
            Clock a station on, do the duty, clock off. Today’s counts are the scoreboard.
          </p>
        </header>

        <div className="flex flex-wrap items-baseline gap-6 rounded-xl border border-rule bg-elevated px-5 py-4">
          <div>
            <p className="font-display text-3xl font-semibold tabular-nums">{onDuty.length}</p>
            <p className="text-xs uppercase tracking-[0.16em] text-muted">on duty</p>
          </div>
          <div>
            <p className="font-display text-3xl font-semibold tabular-nums">{today}</p>
            <p className="text-xs uppercase tracking-[0.16em] text-muted">taps today</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {stations.map((s) => (
            <Card key={s.slug} className="flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl font-semibold">{s.label}</h2>
                    <Badge tone={s.onDuty ? "good" : "default"}>{s.onDuty ? "On" : "Off"}</Badge>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">{s.ageBand}</p>
                </div>
                <p className="font-display text-3xl font-semibold tabular-nums leading-none">
                  {s.todayCount}
                </p>
              </div>
              <p className="text-sm text-muted">{s.duty}</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {s.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button
                  variant={s.onDuty ? "secondary" : "default"}
                  size="sm"
                  onClick={() => void toggle(s.slug, !s.onDuty)}
                >
                  {s.onDuty ? "Clock off" : "Clock on"}
                </Button>
                {s.slug === "reel" && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/reel">Open reel</Link>
                  </Button>
                )}
                {s.slug === "scan" && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/">Open desk</Link>
                  </Button>
                )}
                {s.slug === "pack" && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/ship">Open ship</Link>
                  </Button>
                )}
                {s.slug === "count" && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/analytics">Open numbers</Link>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        <Card className="space-y-3 p-5 text-sm leading-relaxed text-muted">
          <h2 className="font-display text-xl font-semibold text-ink">How a Saturday runs</h2>
          <p>
            Youngest on Reel: hold, beep, turn, pile. Next oldest on Grade: keys 1–4 only. Pack
            pulls bins. Count reads the sheet. Helm is the only station that writes a sentence.
          </p>
          <p>
            Stations are roles on purpose — no kid names live in the shop file. Assign who is
            Reel today on a paper card next to the laptop.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
