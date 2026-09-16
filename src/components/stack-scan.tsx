import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { detectIsbnFromFile, detectIsbnFromVideo, nativeBarcodeSupported } from "@/lib/barcode-detect";
import { explainCameraError, openCamera, stopStream, useBindCamera } from "@/lib/camera";
import { hydrateStack, type ScanDraft } from "@/lib/hydrate-stack";
import { TargetKeepField, useTargetKeep } from "@/components/target-keep-field";
import { looksLikeScanBurst, normalizeScannedCode } from "@/lib/isbn";
import { DESK_CATALOG } from "@/lib/desk-catalog";
import { copiesToEbayCsv, downloadText } from "@/lib/ebay-csv";
import { copiesToAmazonLoader, copiesToShelfmarkCsv } from "@/lib/listing-files";
import { todayStamp } from "@/lib/sku";
import { gradeLabel } from "@/lib/condition";
import { copiesPricedToKeep, money } from "@/lib/pricing";
import { beep, speak } from "@/lib/speech";
import type { ConditionGrade, CopyRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const EBAY_UPLOAD = "https://www.ebay.com/sh/reports";
const AMAZON_UPLOAD = "https://sellercentral.amazon.com/listing/upload";

const GRADES: { id: ConditionGrade; word: string; hint: string }[] = [
  { id: "LN", word: "Excellent", hint: "Looks unread" },
  { id: "VG", word: "Very Good", hint: "Light wear" },
  { id: "G", word: "Good", hint: "Reads well" },
  { id: "A", word: "Poor", hint: "Worn but complete" },
];

type Phase = "pick" | "scan" | "grade" | "hydrate" | "files";
type Mode = "single" | "stack";

function shortName(isbn: string) {
  const b = DESK_CATALOG[isbn];
  return b?.title ?? isbn;
}

export function StackScan({
  voice = true,
  onClose,
  onFinished,
}: {
  voice?: boolean;
  onClose: () => void;
  onFinished?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [mode, setMode] = useState<Mode>("stack");
  const [camOn, setCamOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [drafts, setDrafts] = useState<ScanDraft[]>([]);
  const [hydrated, setHydrated] = useState<CopyRecord[]>([]);
  const [tick, setTick] = useState<{ at: number; total: number; title: string; step: string } | null>(null);
  const [targetKeep, setTargetKeep] = useTargetKeep();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef({ code: "", t: 0 });
  const burstRef = useRef({ buf: "", t: 0 });
  const handlingRef = useRef(false);
  const draftsRef = useRef<ScanDraft[]>([]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const say = useCallback(
    (text: string) => {
      if (voice) speak(text, { interrupt: true });
    },
    [voice],
  );

  async function startCamera() {
    try {
      const next = await openCamera();
      setStream(next);
      setCamOn(true);
    } catch (err) {
      toast.error(explainCameraError(err));
    }
  }

  function stopCamera() {
    stopStream(streamRef.current);
    setStream(null);
    setCamOn(false);
  }

  useBindCamera(videoRef, stream, camOn);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    void startCamera();
    return () => stopStream(streamRef.current);
  }, []);

  const addIsbn = useCallback(
    (raw: string) => {
      const isbn = normalizeScannedCode(raw);
      if (!isbn) return;
      const now = Date.now();
      if (lastScanRef.current.code === isbn && now - lastScanRef.current.t < 1400) return;
      lastScanRef.current = { code: isbn, t: now };
      const next: ScanDraft = { key: `${isbn}-${now}`, isbn, grade: "VG" };
      const pile = [...draftsRef.current, next];
      setDrafts(pile);
      draftsRef.current = pile;
      beep(true);
      const n = pile.length;
      say(`${shortName(isbn)}. ${n} in the stack.`);
      if (mode === "single") {
        stopCamera();
        setPhase("grade");
      }
    },
    [mode, say],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== "scan" && phase !== "pick") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const burst = burstRef.current;
      const now = Date.now();
      if (now - burst.t > 80) burst.buf = "";
      burst.t = now;
      if (e.key === "Enter") {
        const code = burst.buf;
        burst.buf = "";
        if (looksLikeScanBurst(code)) addIsbn(code);
        return;
      }
      if (e.key.length === 1) burst.buf += e.key;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addIsbn, phase]);

  useEffect(() => {
    if (!camOn || !stream || phase !== "scan") return;
    let stop = false;
    const tickLoop = async () => {
      const video = videoRef.current;
      if (!stop && video && video.readyState >= 2 && !handlingRef.current) {
        handlingRef.current = true;
        try {
          const isbn = await detectIsbnFromVideo(video);
          if (isbn) addIsbn(isbn);
        } finally {
          handlingRef.current = false;
        }
      }
      if (!stop) window.setTimeout(() => void tickLoop(), nativeBarcodeSupported() ? 280 : 700);
    };
    void tickLoop();
    return () => {
      stop = true;
    };
  }, [camOn, stream, phase, addIsbn]);

  async function onSnap(file: File | null) {
    if (!file) return;
    const isbn = await detectIsbnFromFile(file);
    if (isbn) addIsbn(isbn);
    else {
      beep(false);
      toast.error("Could not read that barcode.");
    }
  }

  function pickMode(next: Mode) {
    setMode(next);
    setPhase("scan");
    say(next === "stack" ? "Stack. Keep scanning. Beep means it counted." : "Single. One book.");
  }

  function doneScanning() {
    if (draftsRef.current.length === 0) {
      toast.error("Scan at least one book first.");
      return;
    }
    stopCamera();
    setPhase("grade");
    say("Very good on all. Tap a word if one is better or worse.");
  }

  function setGrade(key: string, grade: ConditionGrade) {
    setDrafts((rows) => rows.map((r) => (r.key === key ? { ...r, grade } : r)));
  }

  async function runHydrate() {
    setPhase("hydrate");
    const rows = draftsRef.current.length ? draftsRef.current : drafts;
    try {
      const out = await hydrateStack(rows, {
        targetKeep,
        onTick: (t) => {
          setTick({ at: t.at, total: t.total, title: t.title || shortName(t.isbn), step: t.step });
        },
      });
      setHydrated(out);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not write the listings.");
    }
    setPhase("files");
    say("Descriptions are on the sheets.");
    onFinished?.();
  }

  function sellableCopies() {
    return hydrated.filter((c) => c.status === "ready" || c.status === "listed");
  }

  function pullEbay() {
    const sellable = copiesPricedToKeep(sellableCopies(), targetKeep, "ebay");
    if (!sellable.length) return toast.error("Nothing to upload.");
    downloadText(`shelfmark_ebay_${todayStamp()}.csv`, copiesToEbayCsv(sellable));
    toast.success(`eBay file · ${sellable.length}`);
  }

  function pullAmazon() {
    const sellable = copiesPricedToKeep(sellableCopies(), targetKeep, "amazon");
    if (!sellable.length) return toast.error("Nothing to upload.");
    downloadText(
      `shelfmark_amazon_${todayStamp()}.txt`,
      copiesToAmazonLoader(sellable, "add"),
      "text/tab-separated-values",
    );
    toast.success(`Amazon file · ${sellable.length}`);
  }

  function goEbayUpload() {
    pullEbay();
    window.open(EBAY_UPLOAD, "_blank", "noopener,noreferrer");
    toast.message("eBay file downloaded. Seller Hub Reports is open — choose Upload, then your CSV.");
  }

  const pct = tick ? Math.round((tick.at / tick.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Camera lane</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            {phase === "pick" && "Stack or single"}
            {phase === "scan" && (mode === "stack" ? "Keep scanning" : "One book")}
            {phase === "grade" && "Tap a word if it is not very good"}
            {phase === "hydrate" && "Writing the sheets"}
            {phase === "files" && "Sheets are ready"}
          </h1>
        </div>
        <button type="button" className="h-11 rounded-md border border-rule px-4 text-sm" onClick={onClose}>
          Back to shop
        </button>
      </div>

      <video
        ref={videoRef}
        className={cn(
          "aspect-video w-full rounded-xl border border-rule bg-ink object-cover",
          (phase === "hydrate" || phase === "files" || phase === "grade") && "hidden",
        )}
        muted
        playsInline
        autoPlay
      />

      {phase === "pick" && (
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => pickMode("stack")}
            className="min-h-32 rounded-xl bg-cloth px-6 py-6 text-left text-cloth-fg"
          >
            <span className="block font-display text-3xl font-semibold">Stack</span>
            <span className="mt-2 block text-sm opacity-80">Keep showing barcodes. Beep means it counted. Tap Done when the pile is through.</span>
          </button>
          <button
            type="button"
            onClick={() => pickMode("single")}
            className="min-h-32 rounded-xl bg-good px-6 py-6 text-left text-good-fg"
          >
            <span className="block font-display text-3xl font-semibold">Single</span>
            <span className="mt-2 block text-sm opacity-80">One book. Beep, then we stop and you check the grade.</span>
          </button>
        </div>
      )}

      {phase === "scan" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-2xl font-semibold tabular-nums">{drafts.length} in the stack</p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-12 cursor-pointer items-center rounded-md border border-rule bg-elevated px-4 text-sm">
                Snap barcode
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    void onSnap(file);
                  }}
                />
              </label>
              {mode === "stack" && (
                <button
                  type="button"
                  onClick={doneScanning}
                  className="h-12 rounded-md bg-cloth px-6 text-sm font-medium text-cloth-fg"
                >
                  Done
                </button>
              )}
            </div>
          </div>
          {drafts.length === 0 ? (
            <Card className="grid min-h-32 place-items-center p-6 text-center text-muted">
              Hold the barcode to the camera. Grocery gun works too. Wait for the beep.
            </Card>
          ) : (
            <ul className="divide-y divide-rule rounded-xl border border-rule bg-elevated">
              {drafts.map((d, i) => (
                <li key={d.key} className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <span className="font-display text-lg font-semibold">
                    {i + 1}. {shortName(d.isbn)}
                  </span>
                  <span className="font-mono text-xs text-muted">{d.isbn}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {phase === "grade" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Every book starts at Very Good. Tap another word only if this copy is better or worse.</p>
          <TargetKeepField value={targetKeep} onChange={setTargetKeep} />
          {drafts.map((d) => (
            <Card key={d.key} className="space-y-3 p-4">
              <p className="font-display text-xl font-semibold leading-tight">{shortName(d.isbn)}</p>
              <p className="font-mono text-xs text-muted">{d.isbn}</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {GRADES.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGrade(d.key, g.id)}
                    className={cn(
                      "min-h-16 rounded-xl px-3 py-3 text-left",
                      d.grade === g.id ? "bg-cloth text-cloth-fg" : "border border-rule bg-elevated",
                    )}
                  >
                    <span className="block font-display text-lg font-semibold leading-tight">{g.word}</span>
                    <span className="block text-xs opacity-80">{g.hint}</span>
                  </button>
                ))}
              </div>
            </Card>
          ))}
          <button
            type="button"
            onClick={() => void runHydrate()}
            className="h-14 w-full rounded-xl bg-cloth text-lg font-medium text-cloth-fg"
          >
            Looks right — write descriptions
          </button>
        </div>
      )}

      {phase === "hydrate" && tick && (
        <Card className="space-y-4 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-muted">
            {tick.step === "lookup" && "Looking up the book"}
            {tick.step === "write" && "Writing buyer copy — eBay listing and Amazon copy note"}
            {tick.step === "saved" && "On the sheet"}
          </p>
          <p className="font-display text-3xl font-semibold">{tick.title}</p>
          <p className="text-muted">
            Book {tick.at} of {tick.total}
          </p>
          <div className="h-4 overflow-hidden rounded-full bg-rule">
            <div className="h-full bg-cloth transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="tabular-nums text-sm text-muted">{pct}%</p>
          {hydrated.length > 0 && (
            <ul className="divide-y divide-rule text-sm">
              {hydrated.map((c) => (
                <li key={c.id} className="flex justify-between gap-3 py-2">
                  <span>{c.title}</span>
                  <span className="tabular-nums text-muted">{c.listPrice == null ? "" : money(c.listPrice)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {phase === "files" && (
        <div className="space-y-4">
          <TargetKeepField value={targetKeep} onChange={setTargetKeep} />
          <p className="text-sm text-muted">
            {hydrated.length} {hydrated.length === 1 ? "book" : "books"} with descriptions. eBay gets the full listing (what the book is + this copy). Amazon already has the catalog blurb — we send this copy’s condition as the item note. Download, then upload. Nothing is live until you do.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={pullEbay}
              className="min-h-32 rounded-xl bg-good px-6 py-6 text-left text-good-fg"
            >
              <span className="block font-display text-3xl font-semibold">eBay file</span>
              <span className="mt-2 block text-sm opacity-80">CSV for Seller Hub bulk upload.</span>
            </button>
            <button
              type="button"
              onClick={pullAmazon}
              className="min-h-32 rounded-xl bg-cloth px-6 py-6 text-left text-cloth-fg"
            >
              <span className="block font-display text-3xl font-semibold">Amazon file</span>
              <span className="mt-2 block text-sm opacity-80">Inventory Loader for Seller Central.</span>
            </button>
          </div>
          <a
            href={EBAY_UPLOAD}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              goEbayUpload();
            }}
            className="flex min-h-20 items-center justify-center rounded-xl border-2 border-ink bg-elevated px-6 py-5 text-center no-underline"
          >
            <span className="font-display text-2xl font-semibold text-ink">Click to eBay Upload</span>
          </a>
          <p className="text-sm text-muted">
            That link opens Seller Hub Reports. Stay signed in. Choose Upload, then the CSV we just saved.
            Same for{" "}
            <a href={AMAZON_UPLOAD} target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-rule underline-offset-4">
              Amazon upload
            </a>
            .
          </p>
          <button
            type="button"
            className="h-11 text-sm text-muted underline decoration-rule underline-offset-4"
            onClick={() =>
              downloadText(`shelfmark_session_${todayStamp()}.csv`, copiesToShelfmarkCsv(hydrated))
            }
          >
            Session ledger
          </button>
          <ul className="divide-y divide-rule rounded-xl border border-rule bg-elevated">
            {hydrated.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <p className="font-display text-lg font-semibold leading-tight">{c.ebayTitle || c.title}</p>
                <p className="text-sm text-muted">
                  {gradeLabel(c.conditionGrade)} · {c.isbn13} · {c.listPrice == null ? "" : money(c.listPrice)}
                </p>
                {c.ebayDescription ? (
                  <p className="mt-1 line-clamp-3 text-sm text-muted">{c.ebayDescription}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
