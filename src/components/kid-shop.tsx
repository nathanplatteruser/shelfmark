import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { StackScan } from "@/components/stack-scan";
import { lookupIsbn } from "@/lib/catalog-api";
import { estimateIsbnComp } from "@/lib/comps-api";
import { saveCopy } from "@/lib/copies-api";
import { DESK_CATALOG } from "@/lib/desk-catalog";
import { detectIsbnFromFile, detectIsbnFromVideo, nativeBarcodeSupported } from "@/lib/barcode-detect";
import { explainCameraError, openCamera, stopStream, useBindCamera } from "@/lib/camera";
import { buildConditionDescription } from "@/lib/condition";
import { requestTour } from "@/lib/tour";
import { looksLikeScanBurst, normalizeScannedCode } from "@/lib/isbn";
import { addToJar } from "@/lib/kid-jar";
import {
  buildEbayTitle,
  buildTemplateDescription,
  kidCard,
  kidListPrice,
  money,
  PRACTICE_ISBNS,
  type KidCard,
  type KidChoice,
} from "@/lib/pricing";
import { beep, speak } from "@/lib/speech";
import type { CatalogBook } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRACTICE_SHORT: Record<string, string> = {
  "9781285741550": "Calculus",
  "9780743273565": "Gatsby",
  "9780807508527": "Boxcar",
  "9781451673319": "F451",
  "9780618260300": "Hobbit",
  "9780553212679": "Huck",
};

type Flash = { choice: KidChoice; title: string } | null;

export function KidShop({ onSaved }: { onSaved?: () => void }) {
  const [voice, setVoice] = useState(true);
  const [countStamp, setCountStamp] = useState(true);
  const [book, setBook] = useState<CatalogBook | null>(null);
  const [card, setCard] = useState<KidCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [practiceAt, setPracticeAt] = useState<number | null>(null);
  const [practiceHits, setPracticeHits] = useState<KidChoice[]>([]);
  const [lane, setLane] = useState<"shop" | "stack">("shop");
  const [camOn, setCamOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [pileCount, setPileCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const burstRef = useRef({ buf: "", t: 0 });
  const lastScanRef = useRef({ code: "", t: 0 });
  const handlingRef = useRef(false);

  const say = useCallback(
    (text: string) => {
      if (voice) speak(text, { interrupt: true });
    },
    [voice],
  );

  const present = useCallback(
    (found: CatalogBook, announce = true, asked?: number) => {
      const listPrice =
        asked != null
          ? asked
          : kidListPrice(
              found.isbn13,
              found.format === "textbook" ? 24.99 : found.format === "hardcover" ? 11.99 : 8.99,
            );
      const next = kidCard({
        listPrice,
        format: found.format,
        wePayStamp: countStamp,
      });
      setBook(found);
      setCard(next);
      beep(true);
      if (announce) {
        say(`${found.title}. Buyer pays ${listPrice.toFixed(2)}. We keep ${next.keepAmazon.toFixed(2)}. ${next.choice}.`);
      }
    },
    [countStamp, say],
  );

  const handleCode = useCallback(
    async (raw: string) => {
      const isbn = normalizeScannedCode(raw);
      if (!isbn) return;
      const now = Date.now();
      if (lastScanRef.current.code === isbn && now - lastScanRef.current.t < 1200) return;
      lastScanRef.current = { code: isbn, t: now };
      if (handlingRef.current) return;
      handlingRef.current = true;
      try {
        const local = DESK_CATALOG[isbn];
        if (local) {
          present(local, true);
          return;
        }
        const found = await lookupIsbn({ data: { code: isbn } });
        if (found.ok && found.book?.title) {
          let asked: number | undefined;
          try {
            const comp = await estimateIsbnComp({
              data: {
                isbn13: found.book.isbn13,
                title: found.book.title,
                author: found.book.author,
                publisher: found.book.publisher,
                publishedYear: found.book.publishedYear,
                format: found.book.format,
                pages: found.book.pages,
                conditionGrade: "VG",
                subjects: found.book.subjects,
              },
            });
            asked = comp.listPrice;
          } catch {
            /* kidListPrice fallback inside present */
          }
          present(found.book, true, asked);
        } else {
          beep(false);
          toast.error("No book for that ISBN. Try again.");
        }
      } finally {
        handlingRef.current = false;
      }
    },
    [present],
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
        if (looksLikeScanBurst(code)) void handleCode(code);
        return;
      }
      if (e.key.length === 1) burst.buf += e.key;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleCode]);

  useBindCamera(videoRef, stream, camOn);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    return () => stopStream(streamRef.current);
  }, []);

  useEffect(() => {
    if (!camOn || !stream) return;
    let stop = false;
    const tick = async () => {
      const video = videoRef.current;
      if (!stop && video && video.readyState >= 2) {
        const isbn = await detectIsbnFromVideo(video);
        if (isbn) void handleCode(isbn);
      }
      if (!stop) window.setTimeout(() => void tick(), nativeBarcodeSupported() ? 280 : 700);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [camOn, stream, handleCode]);

  async function toggleCamera() {
    if (camOn) {
      stopStream(stream);
      setStream(null);
      setCamOn(false);
      return;
    }
    try {
      const next = await openCamera();
      setStream(next);
      setCamOn(true);
    } catch (err) {
      toast.error(explainCameraError(err));
    }
  }

  async function onSnapBarcode(file: File | null) {
    if (!file) return;
    const isbn = await detectIsbnFromFile(file);
    if (isbn) void handleCode(isbn);
    else toast.error("Could not read that barcode. Fill the frame with the ISBN and try again.");
  }

  function startPractice() {
    setPracticeAt(0);
    setPracticeHits([]);
    setFlash(null);
    const first = DESK_CATALOG[PRACTICE_ISBNS[0]];
    if (first) present(first, true);
    say("Practice. Six books. Count the stamp.");
  }

  async function choose(choice: KidChoice) {
    if (!book || !card || busy) return;
    setBusy(true);
    const keep = choice === "SELL IT" ? card.keepAmazon : choice === "TRY THE OTHER SHOP" ? card.keepEbay : 0;
    addToJar({ title: book.title, choice, buyerPays: card.buyerPays, keep });
    const channels = choice === "SELL IT" ? ["amazon"] : choice === "TRY THE OTHER SHOP" ? ["ebay"] : [];
    const grade = "VG" as const;
    const cond = buildConditionDescription(grade, [], "");
    const ebayTitle = buildEbayTitle({
      title: book.title,
      author: book.author,
      format: book.format,
      publishedYear: book.publishedYear,
      conditionGrade: grade,
    });
    const ebayDescription = buildTemplateDescription({
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      publishedYear: book.publishedYear,
      format: book.format,
      pages: book.pages,
      language: book.language,
      isbn13: book.isbn13,
      conditionDescription: cond,
      shippingNote: "Ships from Lincoln, Nebraska via USPS Media Mail.",
    });
    try {
      await saveCopy({
        data: {
          isbn13: book.isbn13,
          isbn10: book.isbn10,
          title: book.title,
          author: book.author,
          publisher: book.publisher,
          publishedYear: book.publishedYear,
          pages: book.pages,
          format: book.format,
          language: book.language,
          coverUrl: book.coverUrl,
          subjects: book.subjects,
          conditionGrade: grade,
          defects: [],
          listFormat: "bin",
          listPrice: card.buyerPays,
          auctionStart: null,
          ebayTitle,
          ebayDescription,
          conditionDescription: cond,
          pricingRationale: card.why,
          shippingNote: "Ships from Lincoln, Nebraska via USPS Media Mail.",
          status: choice === "GIVE IT AWAY" ? "skipped" : "ready",
          skipReason: choice === "GIVE IT AWAY" ? card.why : "",
          channels,
        },
      });
      if (choice !== "GIVE IT AWAY") setPileCount((n) => n + 1);
      onSaved?.();
    } catch {
      /* jar still recorded */
    }

    beep(choice !== "GIVE IT AWAY");
    say(choice === "SELL IT" ? "Green bin." : choice === "TRY THE OTHER SHOP" ? "Other shop." : "Give it away.");
    setFlash({ choice, title: book.title });
    setBusy(false);

    const nextHits = [...practiceHits, choice];
    if (practiceAt != null) setPracticeHits(nextHits);

    window.setTimeout(() => {
      setFlash(null);
      if (practiceAt != null) {
        const nxt = practiceAt + 1;
        if (nxt < PRACTICE_ISBNS.length) {
          setPracticeAt(nxt);
          const nextBook = DESK_CATALOG[PRACTICE_ISBNS[nxt]];
          if (nextBook) present(nextBook, true);
        } else {
          setPracticeAt(null);
          setBook(null);
          setCard(null);
          say("Pile is done. Take the files.");
        }
      } else {
        setBook(null);
        setCard(null);
      }
    }, 700);
  }

  if (lane === "stack") {
    return (
      <StackScan
        voice={voice}
        onClose={() => setLane("shop")}
        onFinished={() => {
          onSaved?.();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {flash && (
        <div
          className={cn(
            "fixed inset-0 z-40 grid place-items-center",
            flash.choice === "SELL IT" && "bg-good",
            flash.choice === "TRY THE OTHER SHOP" && "bg-warn",
            flash.choice === "GIVE IT AWAY" && "bg-stamp",
          )}
        >
          <p className="font-display text-5xl font-semibold text-paper">{flash.choice}</p>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">The shop</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">Scan. Beep. Bin.</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setVoice((v) => !v)}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-rule bg-elevated px-3 text-sm"
          >
            {voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            {voice ? "Voice on" : "Voice off"}
          </button>
          <button
            type="button"
            data-tour="shop-camera"
            onClick={() => setLane("stack")}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-rule bg-elevated px-3 text-sm"
          >
            <Camera className="size-4" />
            Camera
          </button>
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-rule bg-elevated px-3 text-sm">
            Snap barcode
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = "";
                void onSnapBarcode(file);
              }}
            />
          </label>
        </div>
      </div>

      <label
        data-tour="shop-stamp"
        className="flex cursor-pointer items-start gap-3 rounded-xl border border-rule bg-elevated p-4"
      >
        <input
          type="checkbox"
          className="mt-1 size-5 accent-cloth"
          checked={countStamp}
          onChange={(e) => setCountStamp(e.target.checked)}
        />
        <span>
          <span className="block font-display text-lg font-semibold">Count the stamp</span>
          <span className="block text-sm leading-relaxed text-muted">
            Leave this on. An eight-dollar paperback can leave less than a dollar after the shop, the envelope, and the
            stamp. Turn it off only to see the trap.
          </span>
        </span>
      </label>

      <video
        ref={videoRef}
        className={cn("aspect-video w-full rounded-xl border border-rule bg-ink object-cover", !camOn && "hidden")}
        muted
        playsInline
        autoPlay
      />

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Practice six books</p>
          <button
            type="button"
            onClick={startPractice}
            data-tour="shop-practice"
            className="h-11 rounded-md bg-cloth px-4 text-sm font-medium text-cloth-fg"
          >
            {practiceAt != null ? `Book ${practiceAt + 1} of 6` : "Start practice"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PRACTICE_ISBNS.map((isbn, i) => {
            const b = DESK_CATALOG[isbn];
            const active = book?.isbn13 === isbn;
            const done = practiceHits.length > i && practiceAt != null ? i < practiceAt : false;
            return (
              <button
                key={isbn}
                type="button"
                onClick={() => {
                  if (b) {
                    setPracticeAt(null);
                    present(b);
                  }
                }}
                className={cn(
                  "spine-card min-h-24 px-3 py-3 text-left text-sm transition-opacity",
                  active && "ring-2 ring-ink ring-offset-2 ring-offset-paper",
                  done && "opacity-60",
                )}
              >
                <span className="block font-display text-base font-semibold leading-tight">
                  {PRACTICE_SHORT[isbn] ?? b?.title}
                </span>
                <span className="mt-1 block text-xs text-muted">{b?.author?.split(" ").slice(-1)[0]}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {book && card ? (
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-start gap-4">
            {book.coverUrl ? (
              <img src={book.coverUrl} alt="" className="h-28 w-20 rounded-sm object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">{book.isbn13}</p>
              <h2 className="font-display text-3xl font-semibold leading-tight">{book.title}</h2>
              <p className="text-muted">{book.author}</p>
            </div>
          </div>
          <dl>
            <Row label="Buyer pays" value={money(card.buyerPays)} strong />
            <Row label="Shop takes" value={money(card.shopTakes)} muted />
            <Row label="Envelope" value={money(card.mailer)} muted />
            <Row label="Stamp" value={money(card.stamp)} muted strike={!countStamp} />
            <Row label="We keep" value={money(card.keepAmazon)} strong danger={card.keepAmazon < 1} />
          </dl>
          <p className="text-sm text-muted">{card.why}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <Choice
              kind="SELL IT"
              label="SELL IT"
              hint="Amazon first"
              recommended={card.choice === "SELL IT"}
              disabled={busy}
              onClick={() => void choose("SELL IT")}
            />
            <Choice
              kind="TRY THE OTHER SHOP"
              label="TRY THE OTHER SHOP"
              hint="eBay"
              recommended={card.choice === "TRY THE OTHER SHOP"}
              disabled={busy}
              onClick={() => void choose("TRY THE OTHER SHOP")}
            />
            <Choice
              kind="GIVE IT AWAY"
              label="GIVE IT AWAY"
              hint="Keep under a dollar"
              recommended={card.choice === "GIVE IT AWAY"}
              disabled={busy}
              onClick={() => void choose("GIVE IT AWAY")}
            />
          </div>
        </Card>
      ) : (
        <Card className="grid min-h-64 place-items-center p-8 text-center">
          <p className="font-display text-3xl font-semibold">Waiting for a book</p>
          <p className="mt-2 max-w-md text-muted">
            HID grocery gun, webcam, or a practice spine. No typing. The three bins appear after the beep.
          </p>
        </Card>
      )}

      {pileCount > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-cloth p-5">
          <p className="font-display text-xl font-semibold">
            {pileCount} {pileCount === 1 ? "book" : "books"} in the pile
          </p>
          <Link
            to="/pile"
            className="inline-flex h-12 items-center rounded-md bg-cloth px-5 text-sm font-medium text-cloth-fg no-underline"
          >
            Pile is done — take the files
          </Link>
        </Card>
      )}

      <p className="text-sm text-muted">
        Scan beeps, the bins decide, the pile hydrates titles for you. When the pile is done,{" "}
        <Link to="/pile" className="text-ink underline decoration-rule underline-offset-4">
          take the eBay and Amazon files
        </Link>
        . No keys. No typing. The{" "}
        <Link to="/jar" className="text-ink underline decoration-rule underline-offset-4">
          jar
        </Link>{" "}
        is the ledger.{" "}
        <button type="button" className="text-ink underline decoration-rule underline-offset-4" onClick={() => requestTour()}>
          Walk me through
        </button>
        .
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
  danger,
  strike,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  danger?: boolean;
  strike?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule/70 py-1.5 last:border-0">
      <dt className={cn("text-muted", strong && "text-ink")}>{label}</dt>
      <dd
        className={cn(
          "font-display text-xl tabular-nums",
          muted && "text-muted",
          strong && "text-2xl font-semibold",
          danger && "text-stamp",
          strike && "line-through opacity-50",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Choice({
  kind,
  label,
  hint,
  recommended,
  disabled,
  onClick,
}: {
  kind: KidChoice;
  label: string;
  hint: string;
  recommended: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const tone =
    kind === "SELL IT"
      ? "bg-good text-good-fg"
      : kind === "TRY THE OTHER SHOP"
        ? "bg-warn text-elevated"
        : "bg-stamp text-stamp-fg";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-28 rounded-xl px-4 py-4 text-left transition-transform active:scale-[0.99]",
        tone,
        recommended && "ring-2 ring-ink ring-offset-2 ring-offset-paper",
      )}
    >
      <span className="block font-display text-2xl font-semibold leading-tight">{label}</span>
      <span className="mt-1 block text-sm opacity-80">{hint}</span>
    </button>
  );
}
