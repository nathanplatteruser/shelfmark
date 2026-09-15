import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { copiesToEbayCsv, downloadText } from "@/lib/ebay-csv";
import { copiesToAmazonLoader, copiesToShelfmarkCsv } from "@/lib/listing-files";
import { todayStamp } from "@/lib/sku";
import { copiesPricedToKeep, money } from "@/lib/pricing";
import { TargetKeepField, useTargetKeep } from "@/components/target-keep-field";
import type { CopyRecord } from "@/lib/types";

const EBAY_UPLOAD = "https://www.ebay.com/sh/reports";
const AMAZON_UPLOAD = "https://sellercentral.amazon.com/listing/upload";

export function SessionPack({ copies }: { copies: CopyRecord[] }) {
  const sellable = copies.filter((c) => c.status === "ready" || c.status === "listed");
  const waiting = copies.filter((c) => c.status === "listed" && !c.soldAt);
  const [targetKeep, setTargetKeep] = useTargetKeep();

  function pullEbay() {
    if (sellable.length === 0) return toast.error("Nothing ready to upload.");
    const rows = copiesPricedToKeep(sellable, targetKeep, "ebay");
    downloadText(`shelfmark_ebay_${todayStamp()}.csv`, copiesToEbayCsv(rows));
    toast.success(`eBay bulk file · ${rows.length} books`);
  }

  function pullAmazon() {
    if (sellable.length === 0) return toast.error("Nothing ready to upload.");
    const rows = copiesPricedToKeep(sellable, targetKeep, "amazon");
    downloadText(`shelfmark_amazon_${todayStamp()}.txt`, copiesToAmazonLoader(rows, "add"), "text/tab-separated-values");
    toast.success(`Amazon Inventory Loader · ${rows.length} books`);
  }

  function pullLedger() {
    if (copies.length === 0) return toast.error("No scanned copies yet.");
    downloadText(`shelfmark_session_${todayStamp()}.csv`, copiesToShelfmarkCsv(copies));
    toast.success(`Session ledger · ${copies.length} rows`);
  }

  return (
    <Card className="space-y-5 p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted">No keys required</p>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">After the scan, take the files</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Scan hydrates title, author, ISBN, grade, and price here. Getting that onto a shop has three
          speeds. Tonight, without API secrets, use the middle one.
        </p>
      </div>

      <ol className="grid gap-3 md:grid-cols-3">
        <li className="border border-rule p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Hands</p>
          <p className="mt-1 font-display text-xl font-semibold">Type it</p>
          <p className="mt-2 text-sm text-muted">Open Seller Hub and type each title. That is the skip. The scan already did this work.</p>
        </li>
        <li className="border border-cloth bg-elevated p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">File</p>
          <p className="mt-1 font-display text-xl font-semibold">Download, then upload</p>
          <p className="mt-2 text-sm text-muted">
            One CSV for eBay File Exchange. One Inventory Loader for Amazon. Same SKU on both so a
            later sale can close the other shelf.
          </p>
        </li>
        <li className="border border-rule p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Wire</p>
          <p className="mt-1 font-display text-xl font-semibold">Connect, then one tap</p>
          <p className="mt-2 text-sm text-muted">When App ID and LWA keys exist, List on eBay / Amazon fires the same payload without a file.</p>
        </li>
      </ol>

      <TargetKeepField value={targetKeep} onChange={setTargetKeep} />

      <div className="flex flex-wrap gap-2">
        <Button onClick={pullEbay} disabled={sellable.length === 0}>
          eBay CSV · {sellable.length}
        </Button>
        <Button variant="secondary" onClick={pullAmazon} disabled={sellable.length === 0}>
          Amazon loader · {sellable.length}
        </Button>
        <Button variant="ghost" onClick={pullLedger} disabled={copies.length === 0}>
          Session ledger
        </Button>
        <Button variant="ghost" onClick={() => window.open(EBAY_UPLOAD, "_blank", "noopener")}>
          Open eBay upload
        </Button>
        <Button variant="ghost" onClick={() => window.open(AMAZON_UPLOAD, "_blank", "noopener")}>
          Open Amazon upload
        </Button>
      </div>

      {sellable.length === 0 ? (
        <p className="text-sm text-muted">Sort a book on Shop or Reel first. Give-aways stay out of the upload files.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-rule text-xs uppercase tracking-[0.14em] text-muted">
                <th className="py-2 pr-3 font-medium">SKU</th>
                <th className="py-2 pr-3 font-medium">ISBN</th>
                <th className="py-2 pr-3 font-medium">Title</th>
                <th className="py-2 pr-3 font-medium">Price</th>
                <th className="py-2 font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {sellable.map((c) => (
                <tr key={c.id} className="border-b border-rule/60">
                  <td className="py-2 pr-3 font-mono text-xs">{c.sku}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{c.isbn13 || c.isbn10}</td>
                  <td className="py-2 pr-3">
                    {c.title}
                    <span className="block text-xs text-muted">{c.author}</span>
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{c.listPrice == null ? "—" : money(c.listPrice)}</td>
                  <td className="py-2 text-muted">
                    {c.status === "listed" ? "Waiting for a buyer" : "Ready to upload"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm leading-relaxed text-muted">
        Listed is not sold. Media Mail is slow. A book can sit for days and still be the right price.
        {waiting.length ? ` ${waiting.length} ${waiting.length === 1 ? "copy is" : "copies are"} already waiting.` : ""}{" "}
        Patience is part of the shop.
      </p>
    </Card>
  );
}
