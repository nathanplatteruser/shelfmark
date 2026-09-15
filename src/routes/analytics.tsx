import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { getStats, listActivity, listCopies } from "@/lib/copies-api";
import { netProceeds } from "@/lib/pricing";
import type { ActivityRow, CopyRecord, DeskStats } from "@/lib/types";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  const [stats, setStats] = useState<DeskStats | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [copies, setCopies] = useState<CopyRecord[]>([]);

  useEffect(() => {
    void Promise.all([getStats(), listActivity(), listCopies({ data: { status: "all" } })]).then(
      ([s, a, c]) => {
        setStats(s);
        setActivity(a);
        setCopies(c);
      },
    );
  }, []);

  const listed = copies.filter((c) => c.status === "listed" || c.status === "sold" || c.status === "shipped");
  const sold = copies.filter((c) => c.status === "sold" || c.status === "shipped");
  const avg = listed.length
    ? listed.reduce((s, c) => s + (c.listPrice ?? 0), 0) / listed.length
    : 0;
  const soldRev = sold.reduce((s, c) => s + (c.soldPrice ?? c.listPrice ?? 0), 0);
  const net = sold.reduce((s, c) => s + netProceeds(c.soldPrice ?? c.listPrice ?? 0), 0);
  const goal = stats?.goal ?? 100;
  const today = stats?.listedToday ?? 0;
  const pct = Math.min(100, Math.round((today / goal) * 100));

  const tiles = [
    { label: "Today", value: String(today), hint: `Goal ${goal}` },
    { label: "Ready", value: String(stats?.readyCount ?? 0), hint: "Not pushed yet" },
    { label: "Live", value: String(stats?.listedCount ?? 0), hint: "On the shelves" },
    { label: "Sold", value: String(stats?.soldCount ?? 0), hint: "Need packing" },
    { label: "On-hand value", value: `$${(stats?.inventoryValue ?? 0).toFixed(0)}`, hint: "Ready + live" },
    { label: "Avg list", value: `$${avg.toFixed(2)}`, hint: "Per ticket" },
    { label: "Gross sold", value: `$${soldRev.toFixed(0)}`, hint: "Before fees" },
    { label: "Est. net", value: `$${net.toFixed(0)}`, hint: "15.3% + order fee" },
  ];

  return (
    <AppShell listedToday={stats?.listedToday} goal={stats?.goal}>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">The only numbers that matter</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Numbers</h1>
      </div>

      <Card className="mb-6 p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="uppercase tracking-[0.16em] text-muted">Daily goal</span>
          <span className="tabular-nums">
            {today} / {goal}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-rule/70">
          <div
            className="h-full rounded-full bg-cloth transition-[width] duration-300"
            style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
          />
        </div>
      </Card>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">{t.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums tracking-tight">{t.value}</p>
            <p className="mt-1 text-xs text-subtle">{t.hint}</p>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 font-display text-2xl font-semibold">Lane log</h2>
      <div className="grid gap-2">
        {activity.length === 0 && <p className="text-sm text-muted">No activity yet.</p>}
        {activity.map((a) => (
          <Card key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted">{a.detail || a.kind}</span>
            <span className="font-mono text-xs text-subtle">
              {new Date(a.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
