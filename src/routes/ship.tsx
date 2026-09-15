import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listChannelBoard } from "@/lib/channels-api";
import { channelBySlug, type CopyListings } from "@/lib/channels";
import { getStats, listCopies, updateStatus } from "@/lib/copies-api";
import type { CopyRecord, DeskStats } from "@/lib/types";

export const Route = createFileRoute("/ship")({ component: ShipPage });

function ShipPage() {
  const [rows, setRows] = useState<CopyRecord[]>([]);
  const [board, setBoard] = useState<CopyListings[]>([]);
  const [stats, setStats] = useState<DeskStats | null>(null);

  async function load() {
    const [c, s, b] = await Promise.all([
      listCopies({ data: { status: "all" } }),
      getStats(),
      listChannelBoard(),
    ]);
    setRows(c.filter((r) => r.status === "sold" || r.status === "shipped"));
    setStats(s);
    setBoard(b.copies);
  }

  useEffect(() => {
    void load();
  }, []);

  const sold = rows.filter((r) => r.status === "sold");
  const shipped = rows.filter((r) => r.status === "shipped");
  const byId = new Map(board.map((c) => [c.copyId, c]));

  return (
    <AppShell listedToday={stats?.listedToday} goal={stats?.goal}>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Pick · pack · Media Mail</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Ship</h1>
      </div>

      <Card className="mb-6 p-5 text-sm leading-relaxed text-muted">
        The ticket names the channel that sold it, the order, and the ship-to city. Scan the SKU,
        walk to the bin, wrap, weigh, buy the label, photograph the closed pack. Buyer name and
        street wait for a signed-in shop — city is enough to pack today.
      </Card>

      <h2 className="mb-3 font-display text-2xl font-semibold">Pick list</h2>
      <div className="mb-8 grid gap-3">
        {sold.length === 0 && <Card className="p-6 text-muted">No sold books waiting. Good.</Card>}
        {sold.map((row) => {
          const extra = byId.get(row.id);
          const sale = extra?.sale;
          return (
            <Card key={row.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="warn">Pick</Badge>
                  <span className="text-xs uppercase tracking-[0.16em] text-subtle">Bin {row.binLocation}</span>
                  <span className="font-mono text-xs text-muted">{row.sku}</span>
                </div>
                <p className="mt-1 font-display text-lg font-semibold">{row.title}</p>
                <p className="text-sm text-muted">{row.author}</p>
                {sale && (
                  <p className="mt-1 text-sm text-muted">
                    {channelBySlug(sale.channelSlug)?.name} · {sale.orderRef} · {sale.shipCity},{" "}
                    {sale.shipRegion} · {sale.shipService} · ${sale.soldPrice.toFixed(2)}
                  </p>
                )}
              </div>
              <Button
                onClick={async () => {
                  await updateStatus({ data: { id: row.id, status: "shipped" } });
                  void load();
                }}
              >
                Packed & shipped
              </Button>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-3 font-display text-2xl font-semibold">Already out</h2>
      <div className="grid gap-3">
        {shipped.length === 0 && <p className="text-sm text-muted">Nothing shipped yet.</p>}
        {shipped.map((row) => {
          const sale = byId.get(row.id)?.sale;
          return (
            <Card key={row.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-display font-semibold">{row.title}</p>
                <p className="text-sm text-muted">
                  {row.sku}
                  {sale ? ` · ${channelBySlug(sale.channelSlug)?.name} · ${sale.orderRef}` : ""}
                </p>
              </div>
              <Badge tone="good">Shipped</Badge>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
