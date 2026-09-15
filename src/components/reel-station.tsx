import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Clapperboard,
  Loader2,
  SkipForward,
  Square,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EanMark } from "@/components/ean-mark";
import { JewelsCard, ScoreProgress } from "@/components/jewels";
import { lookupIsbn } from "@/lib/catalog-api";
import { estimateIsbnComp } from "@/lib/comps-api";
import { saveCopy } from "@/lib/copies-api";
import { addClip, finishReel, startReel, updateClip } from "@/lib/reel-api";
import { bumpStation } from "@/lib/crew-api";
import {
  PRACTICE_REEL_BOOKS,
  REEL_PRACTICE_COUNT,
  REEL_TAKT_MS,
  REEL_TURN_MS,
} from "@/lib/desk-catalog";
import {
  detectIsbnFromCanvas,
  detectIsbnFromFile,
  detectIsbnFromVideo,
  drawVideoToCanvas,
  getBarcodeDetector,
  grabFrame,
  nativeBarcodeSupported,
} from "@/lib/barcode-detect";
import { explainCameraError, openCamera, stopStream, useBindCamera } from "@/lib/camera";
import {
  buildConditionDescription,
  estimateWeightOz,
  formatLabel,
  gradeLabel,
} from "@/lib/condition";
import {
  buildEbayTitle,
  buildTemplateDescription,
  heuristicPrice,
} from "@/lib/pricing";
import { scoreBook, scoreQueue, type BookTicket } from "@/lib/cashflow";
import { looksLikeScanBurst, normalizeScannedCode } from "@/lib/isbn";
import { beep, speak } from "@/lib/speech";
import { DEFAULT_CHANNEL_SLUGS, channelsForFormat } from "@/lib/channels";
import {
  CONDITION_GRADES,
  type BookFormat,
  type CatalogBook,
  type ClipStatus,
  type ConditionGrade,
  type DefectId,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "idle" | "capture" | "scoring" | "review";
type Phase = "isbn" | "turn";

type LiveClip = {
  key: string;
  dbId: number | null;
  seq: number;
  isbn13: string;
  isbn10: string;
  title: string;
  author: string;
  publisher: string;
  publishedYear: string;
  pages: number | null;
  format: BookFormat;
  language: string;
  coverUrl: string;
  subjects: string;
  source: string;
  stills: string[];
  detectedAtMs: number;
  grade: ConditionGrade | "";
  defects: DefectId[];
  status: ClipStatus;
  ticket: BookTicket | null;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ticketForClip(clip: Pick<LiveClip, "format" | "publishedYear" | "pages" | "subjects" | "grade">): BookTicket {
  const grade = clip.grade || "G";
  const h = heuristicPrice({
    format: clip.format,
    publishedYear: clip.publishedYear,
    conditionGrade: grade,
    pages: clip.pages,
  });
  return scoreBook({
    format: clip.format,
    publishedYear: clip.publishedYear,
    conditionGrade: grade,
    listPrice: h.listPrice,
    pages: clip.pages,
    subjects: clip.subjects,
  });
}

function clipFromBook(book: CatalogBook, seq: number, ms: number, stills: string[]): LiveClip {
  return {
    key: `${seq}-${book.isbn13}-${ms}`,
    dbId: null,
    seq,
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
    source: book.source,
    stills: stills.length ? stills : book.coverUrl ? [book.coverUrl] : [],
    detectedAtMs: ms,
    grade: "",
    defects: [],
    status: "looked_up",
    ticket: null,
  };
}

function TaktRing({ progress }: { progress: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, progress)) * c;
  return (
    <svg viewBox="0 0 72 72" className="size-16 -rotate-90 text-cloth-fg" aria-hidden>
      <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ReelStation() {
  const [voice, setVoice] = useState(true);
  const [mode, setMode] = useState<Mode>("idle");
  const [phase, setPhase] = useState<Phase>("isbn");
  const [busy, setBusy] = useState(false);
  const [reelId, setReelId] = useState<number | null>(null);
  const [current, setCurrent] = useState<CatalogBook | null>(null);
  const [clips, setClips] = useState<LiveClip[]>([]);
  const [beat, setBeat] = useState(0);
  const [goal, setGoal] = useState(REEL_PRACTICE_COUNT);
  const [taktMs, setTaktMs] = useState(REEL_TAKT_MS);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [camOn, setCamOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [detectOk, setDetectOk] = useState(false);
  const [flash, setFlash] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [scoreDone, setScoreDone] = useState(0);
  const [scoreTotal, setScoreTotal] = useState(0);
  const [scoreTitle, setScoreTitle] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);
  const startedAtRef = useRef(0);
  const lastIsbnRef = useRef({ isbn: "", t: 0 });
  const seqRef = useRef(0);
  const burstRef = useRef({ buf: "", t: 0 });
  const persistQ = useRef(Promise.resolve());
  const clipsRef = useRef<LiveClip[]>([]);

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  const say = useCallback(
    (text: string) => {
      if (voice) speak(text, { interrupt: true });
    },
    [voice],
  );

  useEffect(() => {
    setDetectOk(nativeBarcodeSupported());
    return () => {
      stopStream(streamRef.current);
    };
  }, []);

  useBindCamera(videoRef, stream, camOn && mode === "capture");

  const persistClip = useCallback((reel: number, clip: LiveClip) => {
    persistQ.current = persistQ.current.then(async () => {
      try {
        const saved = await addClip({
          data: {
            reelId: reel,
            seq: clip.seq,
            isbn13: clip.isbn13,
            detectedAtMs: clip.detectedAtMs,
            title: clip.title,
            author: clip.author,
            publisher: clip.publisher,
            publishedYear: clip.publishedYear,
            pages: clip.pages,
            format: clip.format,
            language: clip.language,
            coverUrl: clip.coverUrl,
            subjects: clip.subjects,
            catalogSource: clip.source,
            stills: clip.stills.filter((s) => s.startsWith("http")),
          },
        });
        setClips((prev) => prev.map((c) => (c.key === clip.key ? { ...c, dbId: saved.id } : c)));
      } catch {
        // Review can still list from local clip data.
      }
    });
  }, []);

  const ingestBook = useCallback(
    (book: CatalogBook, stills: string[], reel: number) => {
      seqRef.current += 1;
      const ms = Date.now() - startedAtRef.current;
      const clip = clipFromBook(book, seqRef.current, ms, stills);
      clipsRef.current = [...clipsRef.current, clip];
      setClips((prev) => [...prev, clip]);
      setBeat(seqRef.current);
      setCurrent(book);
      persistClip(reel, clip);
      beep(true);
      say(book.title || "Code captured.");
      setFlash(true);
      window.setTimeout(() => setFlash(false), 180);
      return clip;
    },
    [persistClip, say],
  );

  const ingestIsbn = useCallback(
    async (raw: string, stills: string[], reel: number) => {
      const code = normalizeScannedCode(raw);
      if (!code) return;
      const now = Date.now();
      if (code === lastIsbnRef.current.isbn && now - lastIsbnRef.current.t < 2400) return;
      lastIsbnRef.current = { isbn: code, t: now };
      setPhase("isbn");
      try {
        const res = await lookupIsbn({ data: { code } });
        if (!res.ok) {
          toast.error(res.error);
          beep(false);
          return;
        }
        ingestBook(res.book, stills, reel);
        setPhase("turn");
        window.setTimeout(() => setPhase("isbn"), REEL_TURN_MS);
      } catch {
        toast.error("Lookup failed.");
        beep(false);
      }
    },
    [ingestBook],
  );

  async function stopCapture() {
    stopRef.current = true;
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
    setCamOn(false);
    const dur = Math.round((Date.now() - startedAtRef.current) / 1000);
    setElapsedMs(Date.now() - startedAtRef.current);
    if (reelId) {
      try {
        await persistQ.current;
        await finishReel({ data: { id: reelId, durationSec: dur } });
      } catch {
        /* keep local clips */
      }
    }
    const captured = clipsRef.current;
    setScoreDone(0);
    setScoreTotal(captured.length);
    setScoreTitle(captured[0]?.title || "");
    if (captured.length > 10) {
      setMode("scoring");
      await wait(80);
    }
    const tickets = await scoreQueue(
      captured,
      (clip) => ticketForClip(clip),
      (done, _total, clip) => {
        setScoreDone(done);
        setScoreTitle(clip.title || clip.isbn13);
      },
      180,
    );
    const scored = captured.map((clip, i) => ({ ...clip, ticket: tickets[i] ?? null }));
    clipsRef.current = scored;
    setClips(scored);
    setMode("review");
    setReviewIndex(0);
    const first = scored[0];
    if (first?.title) say(`Grade ${first.title}.`);
  }

  async function runPractice(count: number, takt: number) {
    stopRef.current = false;
    seqRef.current = 0;
    setClips([]);
    setBeat(0);
    setGoal(count);
    setTaktMs(takt);
    setPhase("isbn");
    setBusy(true);
    try {
      const reel = await startReel({ data: { kind: "practice", taktMs: takt } });
      setReelId(reel.id);
      startedAtRef.current = Date.now();
      setMode("capture");
      const isbnMs = Math.round(takt * 0.6);
      const turnMs = takt - isbnMs;
      for (let i = 0; i < count; i += 1) {
        if (stopRef.current) break;
        const book = PRACTICE_REEL_BOOKS[i % PRACTICE_REEL_BOOKS.length];
        setPhase("isbn");
        setPhaseProgress(0);
        ingestBook(book, [book.coverUrl], reel.id);
        const t0 = Date.now();
        while (Date.now() - t0 < isbnMs) {
          if (stopRef.current) break;
          setPhaseProgress((Date.now() - t0) / takt);
          setElapsedMs(Date.now() - startedAtRef.current);
          await wait(50);
        }
        if (stopRef.current) break;
        setPhase("turn");
        const t1 = Date.now();
        while (Date.now() - t1 < turnMs) {
          if (stopRef.current) break;
          setPhaseProgress((isbnMs + (Date.now() - t1)) / takt);
          setElapsedMs(Date.now() - startedAtRef.current);
          await wait(50);
        }
      }
      if (!stopRef.current) await stopCapture();
    } catch {
      toast.error("Could not start the reel.");
      setMode("idle");
    } finally {
      setBusy(false);
    }
  }

  async function startLive() {
    stopRef.current = false;
    seqRef.current = 0;
    lastIsbnRef.current = { isbn: "", t: 0 };
    setClips([]);
    setBeat(0);
    setGoal(0);
    setTaktMs(REEL_TAKT_MS);
    try {
      const next = await openCamera();
      stopStream(streamRef.current);
      streamRef.current = next;
      setStream(next);
      const reel = await startReel({ data: { kind: "live", taktMs: REEL_TAKT_MS } });
      setReelId(reel.id);
      startedAtRef.current = Date.now();
      setCamOn(true);
      setMode("capture");
      say("Camera on. Show the barcode, then turn the book.");
    } catch (err) {
      toast.error(explainCameraError(err));
    }
  }

  async function onSnapBarcode(file: File | null) {
    if (!file) return;
    const isbn = await detectIsbnFromFile(file);
    if (!isbn) {
      toast.error("Could not read that barcode. Fill the frame with the ISBN and try again.");
      return;
    }
    if (mode === "capture" && reelId) {
      const still = videoRef.current ? grabFrame(videoRef.current) : "";
      void ingestIsbn(isbn, still ? [still] : [], reelId);
      return;
    }
    stopRef.current = false;
    seqRef.current = 0;
    lastIsbnRef.current = { isbn: "", t: 0 };
    setClips([]);
    setBeat(0);
    try {
      const reel = await startReel({ data: { kind: "upload", taktMs: REEL_TAKT_MS } });
      setReelId(reel.id);
      startedAtRef.current = Date.now();
      setMode("capture");
      await ingestIsbn(isbn, [], reel.id);
      await stopCapture();
    } catch {
      toast.error("Could not file that snap.");
    }
  }

  useEffect(() => {
    if (mode !== "capture" || !camOn || !reelId) return;
    const detector = getBarcodeDetector();
    const canvas = document.createElement("canvas");
    let timer = 0;
    let cancelled = false;
    const gap = detector ? 140 : 220;
    const tick = async () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && reelId) {
        let isbn: string | null = null;
        if (detector) {
          drawVideoToCanvas(video, canvas, 640);
          isbn = await detectIsbnFromCanvas(detector, canvas);
        } else {
          isbn = await detectIsbnFromVideo(video);
        }
        if (isbn && !cancelled) {
          const still = grabFrame(video);
          void ingestIsbn(isbn, still ? [still] : [], reelId);
        }
        setElapsedMs(Date.now() - startedAtRef.current);
      }
      if (!cancelled) timer = window.setTimeout(() => void tick(), gap);
    };
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, camOn, reelId, ingestIsbn]);

  useEffect(() => {
    if (mode !== "capture") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      const now = Date.now();
      const burst = burstRef.current;
      if (now - burst.t > 80) burst.buf = "";
      burst.t = now;
      if (e.key === "Enter" && looksLikeScanBurst(burst.buf) && reelId) {
        e.preventDefault();
        const code = burst.buf;
        burst.buf = "";
        const still = videoRef.current ? grabFrame(videoRef.current) : "";
        void ingestIsbn(code, still ? [still] : [], reelId);
        return;
      }
      if (/^[0-9]$/.test(e.key) || e.key === "X" || e.key === "x") burst.buf += e.key.toUpperCase();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, reelId, ingestIsbn]);

  async function onUploadVideo(file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const video = fileVideoRef.current;
    if (!video) return;
    const detector = getBarcodeDetector();
    stopRef.current = false;
    seqRef.current = 0;
    lastIsbnRef.current = { isbn: "", t: 0 };
    setClips([]);
    setBusy(true);
    try {
      const reel = await startReel({ data: { kind: "upload", taktMs: REEL_TAKT_MS } });
      setReelId(reel.id);
      startedAtRef.current = Date.now();
      setMode("capture");
      video.src = url;
      await video.play();
      const canvas = document.createElement("canvas");
      const step = 0.22;
      while (!video.ended && !stopRef.current) {
        drawVideoToCanvas(video, canvas, 640);
        const isbn = await detectIsbnFromCanvas(detector, canvas);
        if (isbn) {
          const still = grabFrame(video);
          await ingestIsbn(isbn, still ? [still] : [], reel.id);
        }
        const next = Math.min(video.duration || 0, video.currentTime + step);
        video.currentTime = next;
        await wait(40);
        setElapsedMs(Date.now() - startedAtRef.current);
        setBeat(seqRef.current);
      }
      await stopCapture();
      if (seqRef.current === 0) {
        toast("No ISBNs in that clip. Hold each barcode still for two seconds, or run the practice reel.");
      }
    } catch {
      toast.error("Could not read that video.");
      setMode("idle");
    } finally {
      setBusy(false);
      URL.revokeObjectURL(url);
    }
  }

  const pending = clips.filter((c) => c.status !== "listed" && c.status !== "skipped");
  const currentReview = pending[Math.min(reviewIndex, Math.max(0, pending.length - 1))] ?? null;

  useEffect(() => {
    if (mode !== "review" || !currentReview) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      if (e.key === "1") setGradeOn(currentReview.key, "LN");
      if (e.key === "2") setGradeOn(currentReview.key, "VG");
      if (e.key === "3") setGradeOn(currentReview.key, "G");
      if (e.key === "4") setGradeOn(currentReview.key, "A");
      if (e.key === "Enter") {
        e.preventDefault();
        void listOne(currentReview.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, currentReview?.key]);

  function setGradeOn(key: string, grade: ConditionGrade) {
    const next = clipsRef.current.map((c) => {
      if (c.key !== key) return c;
      const updated = { ...c, grade };
      return { ...updated, ticket: ticketForClip(updated) };
    });
    clipsRef.current = next;
    setClips(next);
    say(gradeLabel(grade));
  }

  async function listOne(key: string, fallbackGrade: ConditionGrade = "G") {
    const clip = clipsRef.current.find((c) => c.key === key);
    if (!clip || clip.status === "listed" || clip.status === "skipped") return;
    const grade = clip.grade || fallbackGrade;
    setBusy(true);
    try {
      const h = heuristicPrice({
        format: clip.format,
        publishedYear: clip.publishedYear,
        conditionGrade: grade,
        pages: clip.pages,
      });
      let asked = h.listPrice;
      let why = h.rationale;
      try {
        const comp = await estimateIsbnComp({
          data: {
            isbn13: clip.isbn13,
            title: clip.title,
            author: clip.author,
            publisher: clip.publisher,
            publishedYear: clip.publishedYear,
            format: clip.format,
            pages: clip.pages,
            conditionGrade: grade,
            subjects: clip.subjects,
          },
        });
        asked = comp.listPrice;
        why = comp.rationale;
      } catch {
        /* keep heuristic */
      }
      const cond = buildConditionDescription(grade, clip.defects, "");
      const title = buildEbayTitle({
        title: clip.title || "Untitled book",
        author: clip.author,
        format: clip.format,
        publishedYear: clip.publishedYear,
        conditionGrade: grade,
      });
      const desc = buildTemplateDescription({
        title: clip.title,
        author: clip.author,
        publisher: clip.publisher,
        publishedYear: clip.publishedYear,
        format: clip.format,
        pages: clip.pages,
        language: clip.language,
        isbn13: clip.isbn13,
        conditionDescription: cond,
        shippingNote: "Ships from Lincoln, Nebraska via USPS Media Mail. Packed to survive the trip.",
      });
      const copy = await saveCopy({
        data: {
          isbn13: clip.isbn13,
          isbn10: clip.isbn10,
          title: clip.title || "Untitled book",
          author: clip.author,
          publisher: clip.publisher,
          publishedYear: clip.publishedYear,
          pages: clip.pages,
          format: clip.format,
          language: clip.language,
          coverUrl: clip.coverUrl,
          subjects: clip.subjects,
          conditionGrade: grade,
          defects: clip.defects,
          photos: clip.stills.filter((s) => s.startsWith("http")).slice(0, 3),
          listFormat: h.listFormat,
          listPrice: asked,
          auctionStart: h.auctionStart,
          shippingWeightOz: estimateWeightOz(clip.format, clip.pages),
          ebayTitle: title,
          ebayDescription: desc,
          conditionDescription: cond,
          itemSpecifics: {
            Author: clip.author,
            "Book Title": clip.title,
            Language: clip.language,
            Format: formatLabel(clip.format),
          },
          pricingRationale: clip.ticket ? `${why} ${clip.ticket.summary}` : why,
          shippingNote: "Ships from Lincoln, Nebraska via USPS Media Mail. Packed to survive the trip.",
          status: "ready",
          channels: channelsForFormat(h.listFormat, DEFAULT_CHANNEL_SLUGS),
        },
      });
      if (clip.dbId) {
        await updateClip({
          data: {
            id: clip.dbId,
            conditionGrade: grade,
            status: "listed",
            copyId: copy.id,
            ebayTitle: title,
            ebayDescription: desc,
          },
        });
      }
      await bumpStation({ data: { slug: "reel" } });
      await bumpStation({ data: { slug: "grade" } });
      const next = clipsRef.current.map((c) =>
        c.key === key ? { ...c, status: "listed" as const, grade } : c,
      );
      clipsRef.current = next;
      setClips(next);
      toast.success(`Live · ${copy.sku} · bin ${copy.binLocation}`);
      say(`Listed. Bin ${copy.binLocation}.`);
      setReviewIndex(0);
    } catch {
      toast.error("Could not list this copy.");
      beep(false);
    } finally {
      setBusy(false);
    }
  }

  async function skipOne(key: string) {
    const clip = clips.find((c) => c.key === key);
    if (clip?.dbId) {
      await updateClip({ data: { id: clip.dbId, status: "skipped" } });
    }
    const next = clipsRef.current.map((c) =>
      c.key === key ? { ...c, status: "skipped" as const } : c,
    );
    clipsRef.current = next;
    setClips(next);
    say("Skipped.");
    setReviewIndex(0);
  }

  async function listRemaining() {
    const rest = clipsRef.current.filter((c) => c.status !== "listed" && c.status !== "skipped");
    for (const clip of rest) {
      await listOne(clip.key, clip.grade || "G");
    }
  }

  const seconds = Math.max(1, elapsedMs / 1000);
  const rate = elapsedMs > 800 ? (clips.length / seconds) * 60 : 0;
  const listed = clips.filter((c) => c.status === "listed").length;

  if (mode === "idle") {
    return (
      <div className="space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Lane 2</p>
            <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
              One-minute reel
            </h1>
            <p className="mt-3 max-w-xl text-lg text-muted">
              Hold the ISBN for two seconds. Turn the book. Next. Twenty books a minute is the
              takt. Titles, covers, and listings fill in on the side. Grading stays human.
            </p>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <Card data-tour="reel-drill" className="flex flex-col gap-4 p-5">
            <p className="text-sm text-muted">
              Eight books, one-second beats. Learn the motion without a camera.
            </p>
            <Button className="mt-auto" onClick={() => void runPractice(8, 1000)}>
              <Clapperboard className="size-4" />
              Run a drill
            </Button>
            <Button variant="ghost" onClick={() => void runPractice(12, 400)}>
              Twelve — then the bar
            </Button>
          </Card>
          <Card data-tour="reel-minute" className="flex flex-col gap-4 p-5">
            <p className="text-sm text-muted">
              Twenty books, three seconds each. ISBN 1.8s, turn 1.2s. The packing-line cadence.
            </p>
            <Button variant="secondary" className="mt-auto" onClick={() => void runPractice(20, REEL_TAKT_MS)}>
              Run 20 in 60s
            </Button>
          </Card>
          <Card data-tour="reel-camera" className="flex flex-col gap-4 p-5">
            <p className="text-sm text-muted">
              Phone uses the back camera. Laptop uses the webcam. Point the ISBN at the lens, or
              fire the USB gun. A still is grabbed the instant the code lands.
            </p>
            <Button variant="outline" className="mt-auto" onClick={() => void startLive()}>
              <Camera className="size-4" />
              Start camera
            </Button>
            <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-rule bg-elevated px-3 text-sm">
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
            {!detectOk && (
              <p className="text-xs text-muted">
                This browser will use a slower reader (Safari on iPhone). Hold the barcode still,
                or snap a still. Chrome on Android is the snappiest live scan.
              </p>
            )}
          </Card>
        </div>

        <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-xl font-semibold">Already filmed a pile?</p>
            <p className="text-sm text-muted">
              Drop a phone video. The reel walks the frames, clips each ISBN, and queues the
              stills.
            </p>
          </div>
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-rule bg-elevated px-4 text-sm">
            <Upload className="size-4" />
            Upload video
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => void onUploadVideo(e.target.files?.[0] ?? null)}
            />
          </label>
        </Card>
        <video ref={fileVideoRef} className="hidden" muted playsInline />
      </div>
    );
  }

  if (mode === "capture") {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Takt {taktMs / 1000}s</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {phase === "isbn" ? "Show the ISBN" : "Turn the book"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setVoice((v) => !v)}>
              {voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              Voice
            </Button>
            <Button variant="stamp" size="sm" onClick={() => void stopCapture()}>
              <Square className="size-4" />
              Stop and grade
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div
            className={cn(
              "relative overflow-hidden rounded-xl bg-ink text-cloth-fg shadow-ticket",
              flash && "ring-4 ring-good",
            )}
          >
            <video
              ref={videoRef}
              className={cn("aspect-video w-full object-cover", camOn ? "block" : "hidden")}
              muted
              playsInline
              autoPlay
            />
            {!camOn && (
              <div className="reel-stage aspect-[4/3] w-full p-8 md:p-12">
                <div className={cn("reel-card mx-auto h-full max-w-md", phase === "turn" && "is-turn")}>
                  <div className="reel-face flex flex-col items-center justify-center gap-5 bg-elevated p-6 text-ink">
                    {current ? (
                      <>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted">Hold still</p>
                        <EanMark isbn13={current.isbn13} />
                        <p className="font-display text-2xl font-semibold leading-tight">
                          {current.title}
                        </p>
                      </>
                    ) : (
                      <p className="text-muted">Waiting for a book</p>
                    )}
                  </div>
                  <div className="reel-face reel-face-cover bg-elevated">
                    {current?.coverUrl ? (
                      <img
                        src={current.coverUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-muted">Turn</div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
              <TaktRing progress={camOn ? 0 : phaseProgress} />
              <div className="rounded-md bg-ink/70 px-3 py-2 text-right">
                <p className="font-display text-3xl font-semibold tabular-nums leading-none">{beat}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-cloth-fg/70">
                  {goal ? `/ ${goal}` : "captured"} · {rate ? `${Math.round(rate)}/min` : "—"}
                </p>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-ink/70 px-4 py-3">
              <p className="text-sm">
                {current
                  ? `${current.title}${current.author ? ` · ${current.author}` : ""}`
                  : camOn
                    ? "Point the barcode at the lens, or fire the USB gun."
                    : "Watch the beat. Next book on the tone."}
              </p>
            </div>
          </div>

          <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Queue</p>
            {clips.length === 0 && <p className="text-sm text-muted">No clips yet.</p>}
            {clips
              .slice()
              .reverse()
              .map((c) => (
                <div key={c.key} className="flex gap-3 rounded-md border border-rule bg-elevated p-2">
                  {c.coverUrl ? (
                    <img src={c.coverUrl} alt="" className="size-12 rounded-sm object-cover" crossOrigin="anonymous" />
                  ) : (
                    <div className="size-12 rounded-sm bg-paper" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.title || c.isbn13}</p>
                    <p className="truncate text-xs text-muted">{c.author}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  const done = pending.length === 0;

  if (mode === "scoring") {
    return <ScoreProgress done={scoreDone} total={scoreTotal} title={scoreTitle} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Grade the pile</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {done ? "Reel closed" : "Tap what you see"}
          </h1>
          <p className="mt-2 text-muted">
            {clips.length} captured · {listed} listed · {pending.length} waiting
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setVoice((v) => !v)}>
            {voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
          {!done && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void listRemaining()}>
              List remaining as Good
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => { setMode("idle"); setClips([]); }}>
            New reel
          </Button>
        </div>
      </div>

      {done ? (
        <Card className="space-y-4 p-6">
          <p className="font-display text-2xl font-semibold">Every clip is filed.</p>
          <p className="text-muted">
            Captured books are live on the homebase. Check{" "}
            <Link to="/listings" className="text-cloth underline-offset-4 hover:underline">
              Listings
            </Link>{" "}
            or start another minute.
          </p>
        </Card>
      ) : currentReview ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <Card className="overflow-hidden p-0">
            <div className="grid md:grid-cols-[10rem_minmax(0,1fr)]">
              <div className="bg-ink/5">
                {currentReview.coverUrl ? (
                  <img
                    src={currentReview.coverUrl}
                    alt=""
                    className="h-full max-h-72 w-full object-cover"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="grid h-40 place-items-center text-subtle">No still</div>
                )}
              </div>
              <div className="space-y-4 p-5 md:p-6">
                <Badge tone="cloth">{currentReview.source || "Reel"}</Badge>
                <h2 className="font-display text-2xl font-semibold leading-tight">
                  {currentReview.title || "Untitled"}
                </h2>
                <p className="text-muted">
                  {currentReview.author}
                  {currentReview.publishedYear ? ` · ${currentReview.publishedYear}` : ""}
                  {` · ${formatLabel(currentReview.format)}`}
                </p>
                {currentReview.ticket && <JewelsCard ticket={currentReview.ticket} compact />}
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {CONDITION_GRADES.map((g, i) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGradeOn(currentReview.key, g.id)}
                      className={cn(
                        "min-h-20 rounded-lg border px-3 py-3 text-left",
                        currentReview.grade === g.id
                          ? "border-cloth bg-cloth text-cloth-fg"
                          : "border-rule bg-elevated hover:border-rule-strong",
                      )}
                    >
                      <span className="block text-[11px] uppercase tracking-[0.16em] opacity-70">
                        Key {i + 1}
                      </span>
                      <span className="mt-1 block font-display text-lg font-semibold">{g.short}</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="lg"
                    disabled={busy}
                    onClick={() => void listOne(currentReview.key)}
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    List
                  </Button>
                  <Button variant="ghost" size="lg" onClick={() => void skipOne(currentReview.key)}>
                    <SkipForward className="size-4" />
                    Skip
                  </Button>
                </div>
              </div>
            </div>
          </Card>
          <div className="space-y-2">
            {pending.map((c, i) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setReviewIndex(i)}
                className={cn(
                  "flex w-full gap-2 rounded-md border p-2 text-left",
                  c.key === currentReview.key ? "border-cloth bg-cloth/10" : "border-rule bg-elevated",
                )}
              >
                {c.coverUrl ? (
                  <img src={c.coverUrl} alt="" className="size-10 rounded-sm object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="size-10 rounded-sm bg-paper" />
                )}
                <span className="min-w-0 truncate text-sm">{c.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
