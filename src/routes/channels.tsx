import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ChannelMark, ChannelPills } from "@/components/channel-pills";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ingestSale, listChannelBoard } from "@/lib/channels-api";
import { channelBySlug, type ChannelListing, type CopyListings, type SyncEvent } from "@/lib/channels";
import { getStats } from "@/lib/copies-api";
import type { DeskStats } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/channels")({ component: ChannelsPage });

type Board = Awaited<ReturnType<typeof listChannelBoard>>;

function ChannelsPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [stats, setStats] = useState<DeskStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [tape, setTape] = useState<SyncEvent[] | null>(null);
  const [winnerSlug, setWinnerSlug] = useState("abebooks");
  const [pickedId, setPickedId] = useState<number | null>(null);

  async function load() {
    const [b, s] = await Promise.all([listChannelBoard(), getStats()]);
    setBoard(b);
    setStats(s);
    return b;
  }

  useEffect(() => {
    void load().then((b) => {
      const boxcar = b.copies.find((c) => c.isbn13 === "9780807508527") ?? b.copies.find((c) => c.status === "listed");
      if (boxcar) setPickedId(boxcar.copyId);
    });
  }, []);

  const picked = board?.copies.find((c) => c.copyId === pickedId) ?? null;
  const liveOnPicked = picked?.listings.filter((l) => l.status === "live" || l.status === "queued") ?? [];

  useEffect(() => {
    if (!picked) return;
    if (!liveOnPicked.some((l) => l.channelSlug === winnerSlug)) {
      const first = liveOnPicked[0]?.channelSlug;
      if (first) setWinnerSlug(first);
    }
  }, [picked, liveOnPicked, winnerSlug]);

  const listedLive = board?.copies.filter((c) => c.status === "listed") ?? [];

  async function runSale() {
    if (!picked) {
      toast.error("Pick a live copy first.");
      return;
    }
    setBusy(true);
    setTape([]);
    try {
      const res = await ingestSale({
        data: { copyId: picked.copyId, channelSlug: winnerSlug },
      });
      if (!res.ok) {
        toast.error(res.error);
        setTape(null);
        return;
      }
      toast.success(`Sold on ${channelBySlug(res.winner)?.name}. Other shelves pulled.`);
      setTape(res.events);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const recentSaleTape = useMemo(() => {
    if (tape && tape.length) return tape;
    if (!board || !picked?.sale) return null;
    return board.events.filter((e) => e.saleId === picked.sale?.id).reverse();
  }, [tape, board, picked]);

  return (
    <AppShell listedToday={stats?.listedToday} goal={stats?.goal}>
      <div className="mb-8 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">The homebase</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          One copy. Every shelf it can stand on.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Scan a book once. Push it to every channel that will take a used copy. The first sale
          closes the rest, so the same spine cannot sell twice.
        </p>
      </div>

      <div className="mb-10 grid gap-3 md:grid-cols-3">
        {[
          { n: "1", t: "Scan once", d: "ISBN, grade, price, SKU, bin. The desk already does this." },
          { n: "2", t: "List everywhere", d: "eBay, Amazon, AbeBooks in seconds. Biblio and Alibris on the next file drop." },
          { n: "3", t: "Sell once", d: "A sale lands. Shelfmark records it, then pulls every other listing down." },
        ].map((s) => (
          <Card key={s.n} className="p-5">
            <p className="font-mono text-xs text-subtle">{s.n}</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">{s.t}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
          </Card>
        ))}
      </div>

      <section className="mb-12">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">A sale just landed</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight">The dataflow</h2>
          </div>
          {picked && liveOnPicked.length > 0 && (
            <Button size="lg" onClick={() => void runSale()} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {channelBySlug(winnerSlug)?.name} sold {picked.title}
            </Button>
          )}
        </div>

        <Card className="overflow-hidden p-0">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            <div className="space-y-4 border-b border-rule p-5 lg:border-b-0 lg:border-r">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Which copy</p>
              <div className="space-y-2">
                {listedLive.length === 0 && (
                  <p className="text-sm text-muted">Nothing live. List a book from the desk.</p>
                )}
                {listedLive.map((c) => (
                  <button
                    key={c.copyId}
                    type="button"
                    onClick={() => {
                      setPickedId(c.copyId);
                      setTape(null);
                    }}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left transition-colors duration-150",
                      pickedId === c.copyId
                        ? "border-cloth bg-cloth text-cloth-fg"
                        : "border-rule bg-paper hover:border-rule-strong",
                    )}
                  >
                    <span className="block truncate font-display font-semibold">{c.title}</span>
                    <span className="block font-mono text-[11px] opacity-70">
                      {c.sku} · bin {c.binLocation}
                    </span>
                  </button>
                ))}
              </div>
              {picked && liveOnPicked.length > 0 && (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">Who bought it</p>
                  <div className="flex flex-wrap gap-2">
                    {liveOnPicked.map((l) => {
                      const ch = channelBySlug(l.channelSlug);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setWinnerSlug(l.channelSlug)}
                          className={cn(
                            "h-10 rounded-md border px-3 text-sm",
                            winnerSlug === l.channelSlug
                              ? "border-cloth bg-cloth text-cloth-fg"
                              : "border-rule bg-paper",
                          )}
                        >
                          {ch?.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-paper p-5 md:p-6">
              {picked ? (
                <SaleTape
                  copy={picked}
                  events={recentSaleTape}
                  pending={busy}
                  winnerSlug={winnerSlug}
                />
              ) : (
                <p className="text-muted">Pick a live copy. This is the moment the other shelves go dark.</p>
              )}
            </div>
          </div>
        </Card>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
          Barnes & Noble Marketplace closed in 2020 — it used to be fed by Alibris. The flow you
          described (sold on one shelf, every other listing pulled) is exactly what runs here on
          AbeBooks, Amazon, and eBay.
        </p>
      </section>

      <section className="mb-12">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Where each copy stands</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight">The board</h2>
        </div>
        <div className="grid gap-3">
          {(board?.copies ?? []).map((c) => (
            <Card key={c.copyId} className="grid gap-4 p-4 md:grid-cols-[4.5rem_minmax(0,1fr)] md:items-center">
              {c.coverUrl ? (
                <img src={c.coverUrl} alt="" className="h-20 w-[4.5rem] rounded-sm object-cover" crossOrigin="anonymous" />
              ) : (
                <div className="grid h-20 w-[4.5rem] place-items-center rounded-sm bg-paper text-xs text-subtle">—</div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={c.status === "listed" ? "good" : c.status === "sold" || c.status === "shipped" ? "warn" : "cloth"}>
                    {c.status}
                  </Badge>
                  <span className="font-mono text-xs text-muted">{c.sku}</span>
                  <span className="text-xs uppercase tracking-[0.16em] text-subtle">Bin {c.binLocation}</span>
                  {c.listPrice != null && (
                    <span className="font-display text-lg font-semibold tabular-nums">${c.listPrice.toFixed(2)}</span>
                  )}
                </div>
                <p className="mt-1 truncate font-display text-lg font-semibold">{c.title}</p>
                <p className="truncate text-sm text-muted">{c.author}</p>
                <ChannelPills listings={c.listings} className="mt-2" />
                {c.sale && (
                  <p className="mt-2 text-sm text-muted">
                    Sold on {channelBySlug(c.sale.channelSlug)?.name} · {c.sale.orderRef} · ship{" "}
                    {c.sale.shipCity}, {c.sale.shipRegion}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Do they actually have APIs</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight">The shelves</h2>
        </div>
        <div className="grid gap-3">
          {(board?.channels ?? []).map((ch) => (
            <Card key={ch.slug} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ChannelMark slug={ch.slug} dim={ch.kind === "closed"} />
                  <div>
                    <h3 className="font-display text-xl font-semibold">{ch.name}</h3>
                    <p className="text-sm text-muted">{ch.blurb}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={ch.kind === "closed" ? "stamp" : ch.kind === "rest" ? "good" : "cloth"}>
                    {ch.kind === "rest" ? "REST API" : ch.kind === "file" ? "File / FTP" : "Closed"}
                  </Badge>
                  {ch.kind !== "closed" && (
                    <Badge tone={ch.account.connected ? "good" : "default"}>
                      {ch.account.connected ? "Demo connected" : "Off"}
                    </Badge>
                  )}
                </div>
              </div>
              {ch.kind !== "closed" && (
                <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-subtle">List</dt>
                    <dd className="mt-1 text-muted">{ch.outboundList}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-subtle">Sale in</dt>
                    <dd className="mt-1 text-muted">{ch.inbound}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-subtle">Take down</dt>
                    <dd className="mt-1 text-muted">{ch.outboundDelist}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-subtle">Cadence · SKU</dt>
                    <dd className="mt-1 text-muted">
                      {ch.cadence} · {ch.skuField}
                    </dd>
                  </div>
                </dl>
              )}
            </Card>
          ))}
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
          Real OAuth to Amazon and eBay needs a selling-partner app and an eBay developer key —
          this desk runs the same dataflow in demo so you can watch a sale land and the other
          listings die. Buyer name and street stay off the desk until the shop is signed in;
          ship-to city is enough to pack.
        </p>
      </section>
    </AppShell>
  );
}

function SaleTape({
  copy,
  events,
  pending,
  winnerSlug,
}: {
  copy: CopyListings;
  events: SyncEvent[] | null;
  pending: boolean;
  winnerSlug: string;
}) {
  if (pending && (!events || events.length === 0)) {
    return (
      <div className="flex items-center gap-3 text-muted">
        <Loader2 className="size-4 animate-spin" />
        Waiting on {channelBySlug(winnerSlug)?.name}…
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="space-y-4">
        <p className="font-display text-2xl font-semibold leading-tight">{copy.title}</p>
        <p className="text-sm text-muted">
          Live on {copy.listings.filter((l) => l.status === "live").length} shelves. When one of
          them completes a sale, Shelfmark closes the copy and pushes a one-time take-down to
          every other listing for this SKU.
        </p>
        <FlowPreview listings={copy.listings} winnerSlug={winnerSlug} />
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {events.map((ev, i) => (
        <li
          key={ev.id}
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-rule/70 py-3 last:border-0"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <ChannelMark slug={ev.channelSlug || ""} dim={!ev.channelSlug} />
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">{labelForKind(ev.kind)}</p>
            <p className="text-sm leading-relaxed">{ev.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function labelForKind(kind: string): string {
  if (kind === "inbound_sale") return "Inbound";
  if (kind === "copy_closed") return "Homebase";
  if (kind === "delist_push") return "Push";
  if (kind === "delist_ack") return "Confirmed";
  if (kind === "safe") return "Safe";
  return kind;
}

function FlowPreview({ listings, winnerSlug }: { listings: ChannelListing[]; winnerSlug: string }) {
  const live = listings.filter((l) => l.status === "live" || l.status === "queued");
  if (live.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">If {channelBySlug(winnerSlug)?.name} wins</span>
      <ArrowRight className="size-4 text-subtle" />
      {live.map((l) => {
        const win = l.channelSlug === winnerSlug;
        return (
          <span
            key={l.id}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.12em]",
              win ? "border-good/40 bg-good text-good-fg" : "border-rule bg-elevated text-muted line-through",
            )}
          >
            {channelBySlug(l.channelSlug)?.mark} {win ? "keeps the sale" : "comes down"}
          </span>
        );
      })}
    </div>
  );
}
