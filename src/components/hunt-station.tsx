import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { detectIsbnFromFile, detectIsbnFromVideo, nativeBarcodeSupported } from "@/lib/barcode-detect";
import { explainCameraError, openCamera, stopStream, useBindCamera } from "@/lib/camera";
import { huntQuote, type HuntQuote } from "@/lib/hunt-api";
import { pushHuntLog, readHuntLog, type HuntLogRow } from "@/lib/hunt-log";
import { looksLikeScanBurst, normalizeScannedCode } from "@/lib/isbn";
import { maxAcquisition, money, parseMoneyInput, spokenHunt } from "@/lib/pricing";
import { beep, speak } from "@/lib/speech";
import { readTargetKeep, writeTargetKeep } from "@/lib/target-keep";
import { cn } from "@/lib/utils";

function applyKeep(quote: HuntQuote, keep: number): HuntQuote {
  const math = maxAcquisition({
    expectedSale: quote.expectedSale,
    format: quote.format,
    keep,
  });
  return {
    ...quote,
    ...math,
    spoken: spokenHunt(math, quote.title),
  };
}

export function HuntStation({
  onClose,
}: {
  onClose?: () => void;
}) {
  const [voice, setVoice] = useState(true);
  const [keep, setKeep] = useState(1);
  const [keepText, setKeepText] = useState("1.00");
  const [camOn, setCamOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<HuntQuote | null>(null);
  const [log, setLog] = useState<HuntLogRow[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef({ code: "", t: 0 });
  const burstRef = useRef({ buf: "", t: 0 });
  const seqRef = useRef(0);
  const keepRef = useRef(keep);
  const voiceRef = useRef(voice);
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);

  keepRef.current = keep;
  voiceRef.current = voice;

  const say = useCallback((text: string) => {
    if (voiceRef.current) speak(text, { interrupt: true });
  }, []);

  useEffect(() => {
    const stored = readTargetKeep();
    const next = stored != null && stored >= 0 ? stored : 1;
    setKeep(next);
    setKeepText(next.toFixed(2));
    keepRef.current = next;
    setLog(readHuntLog());
  }, []);

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
    say("Hunt. Scan a barcode. I will say the most you can pay.");
    const lock = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (lock?.request) {
      void lock.request("screen").then((sent) => {
        wakeRef.current = sent;
      }).catch(() => {
        /* optional */
      });
    }
    return () => {
      stopStream(streamRef.current);
      void wakeRef.current?.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runQuote = useCallback(
    async (isbn: string) => {
      const seq = ++seqRef.current;
      setBusy(true);
      try {
        const next = await huntQuote({ data: { code: isbn, targetKeep: keepRef.current } });
        if (seq !== seqRef.current) return;
        setQuote(next);
        setLog(
          pushHuntLog({
            isbn13: next.isbn13,
            title: next.title,
            maxPay: next.maxPay,
            verdict: next.verdict,
            expectedSale: next.expectedSale,
            keep: next.keep,
            t: Date.now(),
          }),
        );
        beep(next.verdict === "buy");
        say(next.spoken);
      } catch (err) {
        if (seq !== seqRef.current) return;
        beep(false);
        toast.error(err instanceof Error ? err.message : "Could not price that ISBN.");
        say("Could not price that. Scan again.");
      } finally {
        if (seq === seqRef.current) setBusy(false);
      }
    },
    [say],
  );

  const addIsbn = useCallback(
    (raw: string) => {
      const isbn = normalizeScannedCode(raw);
      if (!isbn) return;
      const now = Date.now();
      if (lastScanRef.current.code === isbn && now - lastScanRef.current.t < 1400) return;
      lastScanRef.current = { code: isbn, t: now };
      beep(true);
      void runQuote(isbn);
    },
    [runQuote],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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
  }, [addIsbn]);

  useEffect(() => {
    if (!camOn || !stream) return;
    let stop = false;
    const tickLoop = async () => {
      const video = videoRef.current;
      if (!stop && video && video.readyState >= 2) {
        const isbn = await detectIsbnFromVideo(video);
        if (isbn) addIsbn(isbn);
      }
      if (!stop) window.setTimeout(() => void tickLoop(), nativeBarcodeSupported() ? 280 : 700);
    };
    void tickLoop();
    return () => {
      stop = true;
    };
  }, [camOn, stream, addIsbn]);

  async function onSnap(file: File | null) {
    if (!file) return;
    const isbn = await detectIsbnFromFile(file);
    if (isbn) addIsbn(isbn);
    else {
      beep(false);
      toast.error("Could not read that barcode.");
    }
  }

  function commitKeep(raw: string) {
    const parsed = parseMoneyInput(raw);
    const next = parsed == null ? 1 : parsed;
    setKeep(next);
    keepRef.current = next;
    setKeepText(next.toFixed(2));
    writeTargetKeep(next);
    if (quote) {
      const updated = applyKeep(quote, next);
      setQuote(updated);
    }
  }

  const verdict = quote?.verdict;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Hunt</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Scan. Hear the max. Next book.</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setVoice((v) => {
                const next = !v;
                voiceRef.current = next;
                return next;
              });
            }}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-rule bg-elevated px-3 text-sm"
          >
            {voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            {voice ? "Voice on" : "Voice off"}
          </button>
          {onClose && (
            <button type="button" className="h-11 rounded-md border border-rule px-4 text-sm" onClick={() => {
              stopCamera();
              onClose();
            }}>
              Back to shop
            </button>
          )}
        </div>
      </div>

      <p className="max-w-xl text-sm leading-relaxed text-muted">
        Out buying — thrift, library sale, a stack in the aisle. One ISBN, then the most you can pay and still keep your number after the shop, the envelope, and the stamp. Do not wait for a pile.
      </p>

      <Card className="flex flex-wrap items-end gap-3 border-cloth p-4">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.18em] text-muted">I want to keep</span>
          <span className="mt-1 flex items-center gap-2">
            <span className="font-display text-2xl">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={keepText}
              onChange={(e) => setKeepText(e.target.value)}
              onBlur={(e) => commitKeep(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="h-12 w-28 rounded-md border border-rule bg-elevated px-3 font-display text-2xl tabular-nums"
              aria-label="Target net profit per book"
            />
            <span className="text-sm text-muted">per book</span>
          </span>
        </label>
        <p className="max-w-sm text-sm text-muted">
          Max pay is sale minus fees minus this keep. Blank becomes $1.00 so you do not buy at a loss.
        </p>
      </Card>

      <div className="relative overflow-hidden rounded-xl border border-rule bg-ink">
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full object-cover sm:aspect-video"
          muted
          playsInline
          autoPlay
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[12%] top-[38%] h-[22%] rounded-md border-2 border-paper/80"
        />
        {!camOn && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70">
            <button
              type="button"
              onClick={() => void startCamera()}
              className="h-12 rounded-md bg-cloth px-5 text-sm font-medium text-cloth-fg"
            >
              Turn camera on
            </button>
          </div>
        )}
      </div>

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
        <p className="self-center text-sm text-muted">Phone camera, laptop webcam, or the USB gun.</p>
      </div>

      <Card
        className={cn(
          "min-h-36 p-5 transition-colors duration-150",
          verdict === "buy" && "bg-good text-good-fg",
          verdict === "pass" && "bg-stamp text-stamp-fg",
          verdict === "free" && "bg-warn text-paper",
          !quote && "bg-elevated",
        )}
      >
        {!quote && (
          <p className={cn("font-display text-2xl font-semibold", busy ? "text-ink" : "text-muted")}>
            {busy ? "Checking comps…" : "Hold the barcode in the box."}
          </p>
        )}
        {quote && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] opacity-80">
              {quote.verdict === "buy" ? "Pay up to" : quote.verdict === "free" ? "Only if free" : "Pass"}
            </p>
            <p className="font-display text-6xl font-semibold tabular-nums leading-none tracking-tight sm:text-7xl">
              {quote.verdict === "buy" ? money(quote.maxPay) : quote.verdict === "free" ? "$0.00" : "Pass"}
            </p>
            <p className="font-display text-2xl font-semibold leading-tight">{quote.title}</p>
            <p className="text-sm opacity-85">
              Sells about {money(quote.expectedSale)} · after shop, envelope, and stamp {money(quote.netAfterFees)} left · keep {money(quote.keep)}
            </p>
            {busy && <p className="text-sm opacity-80">Checking the next scan…</p>}
          </div>
        )}
      </Card>

      {log.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-muted">This hunt</p>
          <ul className="divide-y divide-rule rounded-xl border border-rule bg-elevated">
            {log.slice(0, 12).map((row) => (
              <li key={`${row.isbn13}-${row.t}`} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-display text-lg font-semibold">{row.title}</span>
                  <span className="font-mono text-xs text-muted">{row.isbn13}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 font-display text-xl tabular-nums",
                    row.verdict === "pass" && "text-stamp",
                    row.verdict === "buy" && "text-good",
                  )}
                >
                  {row.verdict === "buy" ? money(row.maxPay) : row.verdict === "free" ? "Free" : "Pass"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
