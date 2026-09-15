import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ChannelPills } from "@/components/channel-pills";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listChannelBoard, pushCopyToChannels } from "@/lib/channels-api";
import type { CopyListings } from "@/lib/channels";
import { SessionPack } from "@/components/session-pack";
import { copiesToEbayCsv } from "@/lib/ebay-csv";
import { copiesToAmazonLoader, downloadText } from "@/lib/listing-files";
import { getStats, listCopies, updateStatus } from "@/lib/copies-api";
import { getMarketplaceStatus, listLiveOnAmazon, listLiveOnEbay } from "@/lib/marketplace-api";
import { todayStamp } from "@/lib/sku";
import type { CopyRecord, DeskStats } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/listings")({ component: ListingsPage });

const EBAY_UPLOAD = "https://www.ebay.com/sh/reports";
const AMAZON_UPLOAD = "https://sellercentral.amazon.com/listing/upload";

function isUnauthorized(err: unknown) {
  return err instanceof Error && (err.message === "Unauthorized" || err.name === "UnauthorizedError");
}

function ListingsPage() {
  const [rows, setRows] = useState<CopyRecord[]>([]);
  const [board, setBoard] = useState<CopyListings[]>([]);
  const [stats, setStats] = useState<DeskStats | null>(null);
  const [ebayLive, setEbayLive] = useState(false);
  const [amazonLive, setAmazonLive] = useState(false);
  const [shopsKnown, setShopsKnown] = useState(false);

  async function load() {
    const [c, s, b] = await Promise.all([
      listCopies({ data: { status: "all" } }),
      getStats(),
      listChannelBoard(),
    ]);
    setRows(c.filter((r) => r.status === "ready" || r.status === "listed"));
    setStats(s);
    setBoard(b.copies);
    try {
      const shops = await getMarketplaceStatus();
      setEbayLive(shops.ebay.connected);
      setAmazonLive(shops.amazon.connected);
    } catch {
      setEbayLive(false);
      setAmazonLive(false);
    } finally {
      setShopsKnown(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const byId = new Map(board.map((c) => [c.copyId, c]));
  const exportable = rows.filter((r) => r.status === "ready" || r.status === "listed");

  function exportEbay(copies = exportable) {
    if (copies.length === 0) {
      toast.error("Nothing to export.");
      return;
    }
    downloadText(`shelfmark_ebay_${todayStamp()}.csv`, copiesToEbayCsv(copies));
    toast.success(`eBay file · ${copies.length} rows`);
  }

  function exportAmazon() {
    if (exportable.length === 0) return toast.error("Nothing to export.");
    downloadText(`shelfmark_amazon_${todayStamp()}.txt`, copiesToAmazonLoader(exportable, "add"));
    toast.success(`Amazon Inventory Loader · ${exportable.length} rows`);
  }

  function ebayFileFallback(copies: CopyRecord[], reason?: string) {
    exportEbay(copies);
    window.open(EBAY_UPLOAD, "_blank", "noopener");
    toast.message(reason || "eBay file ready. Upload in Seller Hub — same title, ISBN, and price.");
  }

  async function liveEbay(copyId: number) {
    const copy = rows.find((r) => r.id === copyId);
    if (!copy) return;
    if (!ebayLive) {
      ebayFileFallback([copy]);
      return;
    }
    try {
      const res = await listLiveOnEbay({ data: { copyId } });
      if (!res.ok) {
        ebayFileFallback([copy], res.error);
        return;
      }
      toast.success(`Live on eBay · ${res.title}`);
      if (res.url) window.open(res.url, "_blank", "noopener");
      await load();
    } catch (err) {
      if (isUnauthorized(err)) {
        toast.message("Sign in on Connect, then list. The eBay file is ready either way.");
        ebayFileFallback([copy]);
        return;
      }
      ebayFileFallback([copy], err instanceof Error ? err.message : "eBay API missed. File is ready.");
    }
  }

  async function liveAmazon() {
    if (exportable.length === 0) return toast.error("Nothing to export.");
    if (!amazonLive) {
      exportAmazon();
      window.open(AMAZON_UPLOAD, "_blank", "noopener");
      toast.message("Amazon loader ready. Upload as Inventory Loader in Seller Central.");
      return;
    }
    try {
      const res = await listLiveOnAmazon({ data: { copyIds: exportable.map((r) => r.id) } });
      if (res.ok) {
        toast.success(`Amazon feed ${res.feedId} · ${res.count} books`);
        await load();
        return;
      }
      exportAmazon();
      window.open(AMAZON_UPLOAD, "_blank", "noopener");
      toast.message(res.error || "Loader downloaded. Upload it in Seller Central.");
    } catch (err) {
      exportAmazon();
      window.open(AMAZON_UPLOAD, "_blank", "noopener");
      toast.message(isUnauthorized(err) ? "Loader ready. Connect the shop later if you want API push." : "Loader ready.");
    }
  }

  return (
    <AppShell listedToday={stats?.listedToday} goal={stats?.goal}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">One scan · every shelf</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Listings</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void liveAmazon()} disabled={exportable.length === 0}>
            List on Amazon
          </Button>
          <Button variant="secondary" onClick={exportAmazon} disabled={exportable.length === 0}>
            <Download className="size-4" />
            Amazon loader
          </Button>
          <Button variant="secondary" onClick={() => exportEbay()} disabled={exportable.length === 0}>
            <Download className="size-4" />
            eBay CSV
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/connect">Connect shops</Link>
          </Button>
        </div>
      </div>

      {shopsKnown && (
        <Card className="mb-6 p-5 text-sm leading-relaxed text-muted">
          {ebayLive ? (
            <p>
              eBay is connected. List on eBay publishes a live Buy It Now. If eBay refuses a policy
              or token, the same copy still downloads as a Seller Hub file so the listing never dies.
            </p>
          ) : (
            <p>
              API secrets are not connected. That is fine. Use the files below — scan, hydrate, download,
              upload. Same ISBN and price as a live listing.{" "}
              <Link to="/connect" className="text-ink underline decoration-rule underline-offset-4">
                Connect the shops
              </Link>{" "}
              later if you want one-tap publish.
            </p>
          )}
        </Card>
      )}

      <div className="mb-6">
        <SessionPack copies={rows} />
      </div>

      <div className="grid gap-3">
        {rows.length === 0 && (
          <Card className="p-8 text-center text-muted">
            Nothing ready. Sort a book on Shop, or grade one on Desk.
          </Card>
        )}
        {rows.map((row) => {
          const listed = byId.get(row.id);
          return (
            <Card key={row.id} className="space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={row.status === "ready" ? "cloth" : "good"}>{row.status}</Badge>
                    <span className="font-mono text-xs text-muted">{row.sku}</span>
                    <span className="text-xs uppercase tracking-[0.16em] text-subtle">
                      {row.listFormat === "auction" ? "Auction" : row.listFormat === "offer" ? "BIN + offer" : "Buy It Now"}
                    </span>
                  </div>
                  <h2 className="mt-2 font-display text-xl font-semibold leading-tight">{row.ebayTitle || row.title}</h2>
                  <p className="text-sm text-muted">
                    Bin {row.binLocation} · {row.listPrice != null ? `$${row.listPrice.toFixed(2)}` : "—"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void liveEbay(row.id)}>
                    List on eBay
                  </Button>
                  {row.status === "ready" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        await pushCopyToChannels({ data: { copyId: row.id, slugs: ["ebay", "amazon"] } });
                        await updateStatus({ data: { id: row.id, status: "listed" } });
                        void load();
                      }}
                    >
                      Mark listed
                    </Button>
                  )}
                </div>
              </div>
              {listed && <ChannelPills listings={listed.listings} />}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {row.ebayDescription.slice(0, 280)}
                {row.ebayDescription.length > 280 ? "…" : ""}
              </p>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
