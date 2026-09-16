import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TargetKeepField, useTargetKeep } from "@/components/target-keep-field";
import { listCopies, deleteCopy } from "@/lib/copies-api";
import { extractIsbns } from "@/lib/isbn";
import { copiesPricedToKeep, listPriceForKeep } from "@/lib/pricing";
import { hydrateDraft } from "@/lib/hydrate-stack";
import { copiesToEbayCsv, downloadText } from "@/lib/ebay-csv";
import { copiesToAmazonLoader, copiesToShelfmarkCsv } from "@/lib/listing-files";
import { todayStamp } from "@/lib/sku";
import { beep, speak } from "@/lib/speech";
import type { CopyRecord } from "@/lib/types";
import { money } from "@/lib/pricing";

const EBAY_UPLOAD = "https://www.ebay.com/sh/reports";
const AMAZON_UPLOAD = "https://sellercentral.amazon.com/listing/upload";

export function PileStation() {
  const [copies, setCopies] = useState<CopyRecord[]>([]);
  const [paste, setPaste] = useState("");
  const [progress, setProgress] = useState<{ at: number; total: number; title: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [removing, setRemoving] = useState<number | null>(null);
  const [targetKeep, setTargetKeep] = useTargetKeep();

  async function load() {
    const rows = await listCopies({ data: { status: "all" } });
    setCopies(rows.filter((c) => c.status === "ready" || c.status === "listed"));
  }

  useEffect(() => {
    void load();
  }, []);

  const sellable = copies.filter((c) => c.status === "ready" || c.status === "listed");

  function pullEbay() {
    if (sellable.length === 0) return toast.error("Nothing in the pile yet.");
    const rows = copiesPricedToKeep(sellable, targetKeep, "ebay");
    downloadText(`shelfmark_ebay_${todayStamp()}.csv`, copiesToEbayCsv(rows));
    toast.success(`eBay file · ${rows.length} books`);
  }

  function pullAmazon() {
    if (sellable.length === 0) return toast.error("Nothing in the pile yet.");
    const rows = copiesPricedToKeep(sellable, targetKeep, "amazon");
    downloadText(`shelfmark_amazon_${todayStamp()}.txt`, copiesToAmazonLoader(rows, "add"), "text/tab-separated-values");
    toast.success(`Amazon file · ${rows.length} books`);
  }

  function pullLedger() {
    if (copies.length === 0) return toast.error("Pile is empty.");
    downloadText(`shelfmark_session_${todayStamp()}.csv`, copiesToShelfmarkCsv(copies));
    toast.success(`Session ledger · ${copies.length} books`);
  }

  async function removeOne(copy: CopyRecord) {
    if (removing != null) return;
    setRemoving(copy.id);
    try {
      const res = await deleteCopy({ data: { id: copy.id } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCopies((rows) => rows.filter((r) => r.id !== copy.id));
      toast.success(`Removed · ${res.title}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove that book.");
    } finally {
      setRemoving(null);
    }
  }

  async function loadPaste() {
    const isbns = extractIsbns(paste);
    if (isbns.length === 0) {
      toast.error("No ISBNs in that paste.");
      return;
    }
    setBusy(true);
    let added = 0;
    for (let i = 0; i < isbns.length; i += 1) {
      const isbn = isbns[i];
      setProgress({ at: i + 1, total: isbns.length, title: isbn });
      try {
        const copy = await hydrateDraft(
          { key: `${isbn}-${Date.now()}`, isbn, grade: "VG" },
          { targetKeep },
        );
        setCopies((rows) => [copy, ...rows.filter((r) => r.id !== copy.id)]);
        added += 1;
        beep(true);
        speak(`${copy.title || isbn}. In the pile.`);
      } catch {
        beep(false);
      }
    }
    setProgress(null);
    setBusy(false);
    setPaste("");
    toast.success(`${added} books hydrated into the pile.`);
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted">The pile</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">Beep, then take the files</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">
          Nobody types titles. Scan on Shop, or paste a pallet of ISBNs here. Take dummy copies out
          one by one before you download. Then one file for eBay and one for Amazon.
        </p>
      </div>

      <TargetKeepField value={targetKeep} onChange={setTargetKeep} />

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={pullEbay}
          disabled={sellable.length === 0}
          className="min-h-32 rounded-xl bg-good px-6 py-6 text-left text-good-fg disabled:opacity-50"
        >
          <span className="block text-xs uppercase tracking-[0.18em] opacity-80">File · somewhat manual</span>
          <span className="mt-1 block font-display text-3xl font-semibold">eBay file</span>
          <span className="mt-2 block text-sm opacity-80">{sellable.length} books. Upload in Seller Hub.</span>
        </button>
        <button
          type="button"
          onClick={pullAmazon}
          disabled={sellable.length === 0}
          className="min-h-32 rounded-xl bg-cloth px-6 py-6 text-left text-cloth-fg disabled:opacity-50"
        >
          <span className="block text-xs uppercase tracking-[0.18em] opacity-80">File · somewhat manual</span>
          <span className="mt-1 block font-display text-3xl font-semibold">Amazon file</span>
          <span className="mt-2 block text-sm opacity-80">{sellable.length} books. Inventory Loader.</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={pullLedger} disabled={copies.length === 0}>
          Session ledger
        </Button>
        <a
          href={EBAY_UPLOAD}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center rounded-md border-2 border-ink bg-elevated px-4 text-sm font-medium text-ink no-underline"
        >
          Click to eBay Upload
        </a>
        <Button variant="ghost" onClick={() => window.open(AMAZON_UPLOAD, "_blank", "noopener")}>
          Open Amazon upload
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/">Back to scan</Link>
        </Button>
      </div>

      {progress && (
        <Card className="p-5">
          <p className="text-sm text-muted">
            Hydrating {progress.at} of {progress.total}
          </p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-rule">
            <div className="h-full bg-cloth" style={{ width: `${Math.round((progress.at / progress.total) * 100)}%` }} />
          </div>
          <p className="mt-2 font-display text-xl">{progress.title}</p>
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">This pile</p>
            <p className="font-display text-xl font-semibold">Remove extras before the ledger</p>
          </div>
          <p className="text-sm text-muted">{sellable.length} ready to upload</p>
        </div>
        {sellable.length === 0 ? (
          <p className="text-muted">
            Pile is empty.{" "}
            <Link to="/" className="text-ink underline decoration-rule underline-offset-4">
              Scan on Shop
            </Link>{" "}
            until the beep, tap a bin, then come back.
          </p>
        ) : (
          <ul className="divide-y divide-rule">
            {sellable.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold leading-tight">{c.title}</p>
                  <p className="text-sm text-muted">
                    {c.author} · {c.isbn13 || c.isbn10} · {c.sku}
                  </p>
                </div>
                <p className="text-right font-display text-xl tabular-nums">
                  {targetKeep == null
                    ? c.listPrice == null
                      ? "—"
                      : money(c.listPrice)
                    : money(listPriceForKeep({ keep: targetKeep, format: c.format, shop: "amazon" }))}
                </p>
                {targetKeep != null && (
                  <p className="w-full text-right text-xs text-muted">
                    Amazon {money(listPriceForKeep({ keep: targetKeep, format: c.format, shop: "amazon" }))}
                    {" · "}
                    eBay {money(listPriceForKeep({ keep: targetKeep, format: c.format, shop: "ebay" }))}
                  </p>
                )}
                <button
                  type="button"
                  disabled={removing === c.id}
                  onClick={() => void removeOne(c)}
                  className="h-11 shrink-0 rounded-md border border-stamp px-4 text-sm text-stamp"
                >
                  {removing === c.id ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Pallet list · still no titles to type</p>
        <p className="text-sm leading-relaxed text-muted">
          If you already have 20 ISBNs from a pallet, paste them. We look up each one, beep, and add it to the
          pile. Faster than an agent clicking 20 eBay forms, and it will not flag a 200-review account.
        </p>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={5}
          className="w-full rounded-md border border-rule bg-elevated p-3 font-mono text-sm"
          placeholder="9780618260300&#10;9780743273565&#10;9780807508527"
        />
        <Button disabled={busy || !paste.trim()} onClick={() => void loadPaste()}>
          {busy ? "Hydrating…" : "Load the pile"}
        </Button>
      </Card>
    </div>
  );
}
