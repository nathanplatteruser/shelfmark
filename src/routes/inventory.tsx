import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ChannelPills } from "@/components/channel-pills";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ingestSale, listChannelBoard } from "@/lib/channels-api";
import { channelBySlug, type CopyListings } from "@/lib/channels";
import { getStats, listCopies } from "@/lib/copies-api";
import { formatIsbnDisplay } from "@/lib/isbn";
import { gradeLabel } from "@/lib/condition";
import type { CopyRecord, CopyStatus, DeskStats } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/inventory")({ component: InventoryPage });

const FILTERS: { id: CopyStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "listed", label: "Live" },
  { id: "sold", label: "Sold" },
  { id: "shipped", label: "Shipped" },
  { id: "skipped", label: "Skipped" },
];

function toneFor(status: CopyStatus): "default" | "cloth" | "good" | "stamp" | "warn" {
  if (status === "ready") return "cloth";
  if (status === "listed") return "good";
  if (status === "sold") return "warn";
  if (status === "skipped") return "stamp";
  return "default";
}

function InventoryPage() {
  const [rows, setRows] = useState<CopyRecord[]>([]);
  const [board, setBoard] = useState<CopyListings[]>([]);
  const [stats, setStats] = useState<DeskStats | null>(null);
  const [filter, setFilter] = useState<CopyStatus | "all">("all");
  const [q, setQ] = useState("");
  const [sellingId, setSellingId] = useState<number | null>(null);

  async function load() {
    const [c, s, b] = await Promise.all([
      listCopies({ data: { status: "all" } }),
      getStats(),
      listChannelBoard(),
    ]);
    setRows(c);
    setStats(s);
    setBoard(b.copies);
  }

  useEffect(() => {
    void load();
  }, []);

  const byId = useMemo(() => new Map(board.map((c) => [c.copyId, c])), [board]);

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!query) return true;
      return `${r.title} ${r.author} ${r.sku} ${r.isbn13} ${r.binLocation}`.toLowerCase().includes(query);
    });
  }, [rows, filter, q]);

  return (
    <AppShell listedToday={stats?.listedToday} goal={stats?.goal}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Where the copies live</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Inventory</h1>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, SKU, bin, ISBN"
          className="max-w-sm"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "h-10 rounded-full border px-4 text-sm",
              filter === f.id ? "border-cloth bg-cloth text-cloth-fg" : "border-rule bg-elevated",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {shown.length === 0 && (
          <Card className="p-8 text-center text-muted">Nothing in this bin yet. Scan from the desk.</Card>
        )}
        {shown.map((row) => {
          const listed = byId.get(row.id);
          const live = listed?.listings.filter((l) => l.status === "live" || l.status === "queued") ?? [];
          return (
            <Card key={row.id} className="grid gap-4 p-4 md:grid-cols-[4.5rem_minmax(0,1fr)_auto] md:items-center">
              {row.coverUrl ? (
                <img src={row.coverUrl} alt="" className="h-20 w-[4.5rem] rounded-sm object-cover" />
              ) : (
                <div className="grid h-20 w-[4.5rem] place-items-center rounded-sm bg-paper text-xs text-subtle">
                  —
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={toneFor(row.status)}>{row.status}</Badge>
                  <span className="font-mono text-xs text-muted">{row.sku}</span>
                  <span className="text-xs uppercase tracking-[0.16em] text-subtle">Bin {row.binLocation || "—"}</span>
                </div>
                <p className="mt-1 truncate font-display text-lg font-semibold">{row.title}</p>
                <p className="truncate text-sm text-muted">
                  {row.author}
                  {row.conditionGrade ? ` · ${gradeLabel(row.conditionGrade)}` : ""}
                  {row.isbn13 ? ` · ${formatIsbnDisplay(row.isbn13)}` : ""}
                </p>
                {listed && <ChannelPills listings={listed.listings} className="mt-2" />}
                {listed?.sale && (
                  <p className="mt-2 text-sm text-muted">
                    Sold on {channelBySlug(listed.sale.channelSlug)?.name} · {listed.sale.orderRef}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="font-display text-xl font-semibold tabular-nums">
                  {row.listPrice != null ? `$${row.listPrice.toFixed(2)}` : "—"}
                </p>
                {row.status === "listed" && live.length > 0 && (
                  <div className="flex flex-col items-end gap-2">
                    {sellingId === row.id ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {live.map((l) => (
                          <Button
                            key={l.id}
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              const res = await ingestSale({
                                data: { copyId: row.id, channelSlug: l.channelSlug },
                              });
                              if (!res.ok) toast.error(res.error);
                              else toast.success(`Sold on ${channelBySlug(l.channelSlug)?.name}. Other shelves pulled.`);
                              setSellingId(null);
                              void load();
                            }}
                          >
                            {channelBySlug(l.channelSlug)?.name}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setSellingId(row.id)}>
                        Sale arrived
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
