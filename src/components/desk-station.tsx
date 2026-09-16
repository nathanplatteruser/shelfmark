import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Camera,
  Check,
  Clapperboard,
  Keyboard,
  Loader2,
  ScanBarcode,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { JewelsCard } from "@/components/jewels";
import { assessPhotos, identifyFromPhoto, polishListing } from "@/lib/ai-api";
import { lookupIsbn } from "@/lib/catalog-api";
import { estimateIsbnComp } from "@/lib/comps-api";
import { countIsbn, saveCopy } from "@/lib/copies-api";
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
  netProceeds,
  shouldSkip,
} from "@/lib/pricing";
import { scoreBook } from "@/lib/cashflow";
import { detectIsbnFromFile, detectIsbnFromVideo, nativeBarcodeSupported } from "@/lib/barcode-detect";
import { explainCameraError, openCamera, stopStream, useBindCamera } from "@/lib/camera";
import { looksLikeScanBurst, normalizeScannedCode, formatIsbnDisplay } from "@/lib/isbn";
import { beep, speak } from "@/lib/speech";
import { CONDITION_GRADES, DEFECTS, type BookFormat, type CatalogBook, type ConditionGrade, type DefectId, type ListFormat } from "@/lib/types";
import { DEFAULT_CHANNEL_SLUGS, LISTABLE_CHANNELS, channelsForFormat } from "@/lib/channels";
import { cn } from "@/lib/utils";

type Step = "scan" | "grade" | "list";

function compressDataUrl(dataUrl: string, max = 720): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.62));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function DeskStation({ onSaved }: { onSaved: () => void }) {
  const [voice, setVoice] = useState(true);
  const [step, setStep] = useState<Step>("scan");
  const [busy, setBusy] = useState(false);
  const [scanValue, setScanValue] = useState("");
  const [book, setBook] = useState<CatalogBook | null>(null);
  const [dupes, setDupes] = useState(0);
  const [grade, setGrade] = useState<ConditionGrade | "">("");
  const [defects, setDefects] = useState<DefectId[]>([]);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [price, setPrice] = useState(8.99);
  const [listFormat, setListFormat] = useState<ListFormat>("bin");
  const [auctionStart, setAuctionStart] = useState(4.99);
  const [ebayTitle, setEbayTitle] = useState("");
  const [ebayDescription, setEbayDescription] = useState("");
  const [conditionDescription, setConditionDescription] = useState("");
  const [rationale, setRationale] = useState("");
  const [shippingNote, setShippingNote] = useState(
    "Ships from Lincoln, Nebraska via USPS Media Mail. Packed to survive the trip.",
  );
  const [polished, setPolished] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(DEFAULT_CHANNEL_SLUGS);
  const [camOn, setCamOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const scanVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const burstRef = useRef({ buf: "", t: 0 });

  const say = useCallback(
    (text: string) => {
      if (voice) speak(text, { interrupt: true });
    },
    [voice],
  );

  const reset = useCallback(() => {
    setStep("scan");
    setBook(null);
    setDupes(0);
    setGrade("");
    setDefects([]);
    setNotes("");
    setPhotos([]);
    setPrice(8.99);
    setListFormat("bin");
    setAuctionStart(4.99);
    setEbayTitle("");
    setEbayDescription("");
    setConditionDescription("");
    setRationale("");
    setPolished(false);
    setPolishing(false);
    setSelectedChannels(DEFAULT_CHANNEL_SLUGS);
    setScanValue("");
    setBusy(false);
    stopCam();
    requestAnimationFrame(() => scanRef.current?.focus());
  }, []);

  const applyCatalog = useCallback(
    async (found: CatalogBook, missing?: boolean) => {
      stopCam();
      setBook(found);
      setStep("grade");
      const c = await countIsbn({ data: { isbn13: found.isbn13 } });
      setDupes(c.count);
      const spoken = found.title
        ? `${found.title}. ${found.author || "Author unknown"}.`
        : "Code found. Title missing. Grade the copy.";
      say(spoken);
      if (missing || !found.title) {
        toast("Catalog is thin on this ISBN. Title can be filled from a photo.");
      }
    },
    [say],
  );

  const handleCode = useCallback(
    async (raw: string) => {
      const code = normalizeScannedCode(raw) ?? raw.replace(/[^0-9Xx]/g, "");
      if (!code || code.length < 10) {
        beep(false);
        toast.error("Need a 10–13 digit ISBN.");
        return;
      }
      setBusy(true);
      setScanValue(code);
      try {
        const res = await lookupIsbn({ data: { code } });
        beep(true);
        if (!res.ok) {
          toast.error(res.error);
          say("Not an ISBN.");
          return;
        }
        await applyCatalog(res.book, "missing" in res && res.missing);
      } catch {
        toast.error("Lookup failed. Check the code and try again.");
        beep(false);
      } finally {
        setBusy(false);
      }
    },
    [applyCatalog, say],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "TEXTAREA" ||
          (target.tagName === "INPUT" && target !== scanRef.current));
      if (typing) return;

      const now = Date.now();
      const burst = burstRef.current;
      if (now - burst.t > 80) burst.buf = "";
      burst.t = now;

      if (e.key === "Enter" && looksLikeScanBurst(burst.buf) && step === "scan") {
        e.preventDefault();
        const code = burst.buf;
        burst.buf = "";
        void handleCode(code);
        return;
      }
      if (/^[0-9]$/.test(e.key) || e.key === "X" || e.key === "x") {
        burst.buf += e.key.toUpperCase();
      }

      if (step === "grade" && !typing) {
        if (e.key === "1") setGrade("LN");
        if (e.key === "2") setGrade("VG");
        if (e.key === "3") setGrade("G");
        if (e.key === "4") setGrade("A");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleCode, step]);

  useEffect(() => {
    scanRef.current?.focus();
  }, [step]);

  useEffect(() => {
    return () => {
      stopStream(streamRef.current);
    };
  }, []);

  useBindCamera(scanVideoRef, stream, camOn && step === "scan");
  useBindCamera(videoRef, stream, camOn && step === "grade");

  useEffect(() => {
    if (!camOn || step !== "scan") return;
    const video = scanVideoRef.current;
    if (!video) return;
    let alive = true;
    let timer = 0;
    const gap = nativeBarcodeSupported() ? 140 : 220;
    const tick = async () => {
      if (!alive) return;
      const isbn = await detectIsbnFromVideo(video);
      if (isbn && alive) void handleCode(isbn);
      if (alive) timer = window.setTimeout(() => void tick(), gap);
    };
    void tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [camOn, step, handleCode]);

  async function startCam() {
    try {
      const next = await openCamera();
      stopStream(streamRef.current);
      streamRef.current = next;
      setStream(next);
      setCamOn(true);
    } catch (err) {
      toast.error(explainCameraError(err));
    }
  }

  function stopCam() {
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
    setCamOn(false);
  }

  async function onSnapBarcode(file: File | null) {
    if (!file) return;
    const isbn = await detectIsbnFromFile(file);
    if (isbn) {
      void handleCode(isbn);
    } else {
      toast.error("Could not read that barcode. Fill the frame with the ISBN and try again.");
    }
  }

  async function snapPhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const shot = await compressDataUrl(canvas.toDataURL("image/jpeg", 0.7));
    setPhotos((p) => [...p, shot].slice(0, 3));
    beep(true);
  }

  async function onUpload(files: FileList | null) {
    if (!files) return;
    const next: string[] = [];
    for (const file of Array.from(files).slice(0, 3)) {
      const raw = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      next.push(await compressDataUrl(raw));
    }
    setPhotos((p) => [...p, ...next].slice(0, 3));
  }

  async function runIdentify() {
    if (!photos[0]) {
      toast.error("Take a photo of the cover or title page first.");
      return;
    }
    setBusy(true);
    try {
      const res = await identifyFromPhoto({ data: { image: photos[0] } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBook((b) => ({
        isbn13: res.isbn13 || b?.isbn13 || "",
        isbn10: b?.isbn10 || "",
        title: res.title || b?.title || "",
        author: res.author || b?.author || "",
        publisher: res.publisher || b?.publisher || "",
        publishedYear: res.publishedYear || b?.publishedYear || "",
        pages: b?.pages ?? null,
        format: (res.format as BookFormat) || b?.format || "paperback",
        language: res.language || "English",
        coverUrl: b?.coverUrl || photos[0],
        subjects: b?.subjects || "",
        source: "Title-page photo",
        description: b?.description || "",
      }));
      say(`${res.title}. ${res.author}.`);
      toast.success("Title page read.");
    } finally {
      setBusy(false);
    }
  }

  async function runAssess() {
    if (photos.length === 0) {
      toast.error("Add a photo first.");
      return;
    }
    setBusy(true);
    try {
      const res = await assessPhotos({
        data: { title: book?.title || "", author: book?.author || "", images: photos },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setGrade(res.grade);
      setDefects(res.defects);
      setNotes(res.notes);
      say(`${gradeLabel(res.grade)}. ${res.notes}`);
      toast.success("Photos graded.");
    } finally {
      setBusy(false);
    }
  }

  const preview = useMemo(() => {
    if (!book || !grade) return null;
    const h = heuristicPrice({
      format: book.format,
      publishedYear: book.publishedYear,
      conditionGrade: grade,
      pages: book.pages,
    });
    const cond = buildConditionDescription(grade, defects, notes);
    const title = buildEbayTitle({
      title: book.title || "Untitled book",
      author: book.author,
      format: book.format,
      publishedYear: book.publishedYear,
      conditionGrade: grade,
    });
    return { ...h, cond, title };
  }, [book, grade, defects, notes]);

  const ticket = useMemo(() => {
    if (!book) return null;
    const g = grade || "G";
    const listPrice =
      step === "list"
        ? price
        : heuristicPrice({
            format: book.format,
            publishedYear: book.publishedYear,
            conditionGrade: g,
            pages: book.pages,
          }).listPrice;
    return scoreBook({
      format: book.format,
      publishedYear: book.publishedYear,
      conditionGrade: g,
      listPrice,
      pages: book.pages,
      subjects: book.subjects,
    });
  }, [book, grade, price, step]);

  async function goToList() {
    if (!book || !grade) {
      toast.error("Pick a condition first.");
      return;
    }
    const h = heuristicPrice({
      format: book.format,
      publishedYear: book.publishedYear,
      conditionGrade: grade,
      pages: book.pages,
    });
    const cond = buildConditionDescription(grade, defects, notes);
    const title = buildEbayTitle({
      title: book.title || "Untitled book",
      author: book.author,
      format: book.format,
      publishedYear: book.publishedYear,
      conditionGrade: grade,
    });
    let asked = h.listPrice;
    try {
      const comp = await estimateIsbnComp({
        data: {
          isbn13: book.isbn13,
          title: book.title,
          author: book.author,
          publisher: book.publisher,
          publishedYear: book.publishedYear,
          format: book.format,
          pages: book.pages,
          conditionGrade: grade,
          subjects: book.subjects,
        },
      });
      asked = comp.listPrice;
      setRationale(comp.rationale);
    } catch {
      setRationale(h.rationale);
    }
    const desc = buildTemplateDescription({
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      publishedYear: book.publishedYear,
      format: book.format,
      pages: book.pages,
      language: book.language,
      isbn13: book.isbn13,
      conditionDescription: cond,
      shippingNote,
    });
    setPrice(asked);
    setAuctionStart(h.auctionStart);
    setListFormat(h.listFormat);
    setConditionDescription(cond);
    setEbayTitle(title);
    setEbayDescription(desc);
    setStep("list");
    say(
      `${gradeLabel(grade)}. ${h.listFormat === "auction" ? "Auction" : "Buy it now"} ${asked} dollars.`,
    );

    setPolishing(true);
    try {
      const polishedRes = await polishListing({
        data: {
          title: book.title,
          author: book.author,
          publisher: book.publisher,
          publishedYear: book.publishedYear,
          format: book.format,
          pages: book.pages,
          language: book.language,
          isbn13: book.isbn13,
          subjects: book.subjects,
          conditionGrade: grade,
          defects,
          conditionNotes: notes,
        },
      });
      setEbayTitle(polishedRes.ebayTitle || title);
      setEbayDescription(polishedRes.ebayDescription || desc);
      setConditionDescription(polishedRes.conditionDescription || cond);
      setListFormat(polishedRes.listFormat);
      setPrice(polishedRes.listPrice || asked);
      setAuctionStart(polishedRes.auctionStart || h.auctionStart);
      setRationale(polishedRes.pricingRationale || h.rationale);
      if (polishedRes.shippingNote) setShippingNote(polishedRes.shippingNote);
      setPolished(polishedRes.polished);
    } catch {
      // template already shown
    } finally {
      setPolishing(false);
    }
  }

  async function commit(status: "ready" | "skipped") {
    if (!book) return;
    setBusy(true);
    try {
      const copy = await saveCopy({
        data: {
          isbn13: book.isbn13,
          isbn10: book.isbn10,
          title: book.title || "Untitled book",
          author: book.author,
          publisher: book.publisher,
          publishedYear: book.publishedYear,
          pages: book.pages,
          format: book.format,
          language: book.language,
          coverUrl: book.coverUrl,
          subjects: book.subjects,
          conditionGrade: grade || "G",
          defects,
          conditionNotes: notes,
          photos,
          listFormat,
          listPrice: price,
          auctionStart,
          shippingWeightOz: estimateWeightOz(book.format, book.pages),
          ebayTitle,
          ebayDescription,
          conditionDescription,
          itemSpecifics: {
            Author: book.author,
            "Book Title": book.title,
            Language: book.language,
            Format: formatLabel(book.format),
          },
          pricingRationale: ticket ? `${rationale} ${ticket.summary}`.trim() : rationale,
          shippingNote,
          status,
          skipReason: status === "skipped" ? "Below floor after fees" : "",
          channels: channelsForFormat(listFormat, selectedChannels),
        },
      });
      beep(true);
      if (status === "skipped") {
        say("Skipped. Next book.");
        toast("Skipped. Donate or box it.");
      } else {
        say(`Listed everywhere. Bin ${copy.binLocation}. Next book.`);
        toast.success(`Live · ${copy.sku} · bin ${copy.binLocation}`);
      }
      onSaved();
      reset();
    } catch {
      toast.error("Could not save this copy.");
      beep(false);
    } finally {
      setBusy(false);
    }
  }

  const skipSuggested = shouldSkip(price);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Lane 1</p>
            <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
              {step === "scan" && "Scan a book"}
              {step === "grade" && "Grade the copy"}
              {step === "list" && "List it"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setVoice((v) => !v)}
              aria-pressed={voice}
            >
              {voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              Voice {voice ? "on" : "off"}
            </Button>
            {step !== "scan" && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="size-4" />
                Cancel
              </Button>
            )}
          </div>
        </div>

        <ol className="flex gap-2 text-xs uppercase tracking-[0.16em] text-subtle">
          {(["scan", "grade", "list"] as Step[]).map((s, i) => (
            <li
              key={s}
              className={cn(
                "rounded-full px-3 py-1",
                step === s ? "bg-cloth text-cloth-fg" : "bg-elevated text-muted border border-rule",
              )}
            >
              {i + 1} {s}
            </li>
          ))}
        </ol>

        {step === "scan" && (
          <>
          <Card className="p-6 md:p-8">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="grid size-20 place-items-center rounded-xl bg-cloth text-cloth-fg">
                <ScanBarcode className="size-9" strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <p className="font-display text-2xl font-semibold">Point the gun at the barcode</p>
                <p className="max-w-md text-muted">
                  A grocery-store USB scanner types the ISBN by itself. This box is listening. No
                  typing required.
                </p>
              </div>
              <form
                className="flex w-full max-w-lg flex-col gap-3 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleCode(scanValue);
                }}
              >
                <Input
                  ref={scanRef}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Scan or type ISBN"
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  className="h-14 font-mono text-lg tracking-wide"
                  aria-label="ISBN"
                />
                <Button type="submit" size="lg" disabled={busy} className="h-14 sm:w-36">
                  {busy ? <Loader2 className="size-5 animate-spin" /> : "Look up"}
                </Button>
              </form>
              <video
                ref={scanVideoRef}
                className={cn(
                  "aspect-video w-full max-w-lg rounded-xl bg-ink object-cover",
                  !(camOn && step === "scan") && "hidden",
                )}
                muted
                playsInline
                autoPlay
              />
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => (camOn ? stopCam() : void startCam())}
                >
                  <Camera className="size-4" />
                  {camOn ? "Camera off" : "Camera"}
                </Button>
                <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-rule bg-elevated px-3 text-sm">
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
              <p className="max-w-md text-sm text-subtle">
                Phone: back camera. Laptop: webcam. Chrome reads the barcode live. iPhone can also
                snap a still of the ISBN.
              </p>
              <p className="text-sm text-subtle">
                Try a demo ISBN:{" "}
                <button
                  type="button"
                  className="font-mono text-cloth underline-offset-4 hover:underline"
                  onClick={() => void handleCode("9780743273565")}
                >
                  9780743273565
                </button>
              </p>
            </div>
          </Card>
          <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-left">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Faster pile</p>
              <p className="font-display text-xl font-semibold">Video reel, twenty a minute</p>
              <p className="text-sm text-muted">
                Show each ISBN for two seconds, turn, next. The machine fills titles. You still
                grade.
              </p>
            </div>
            <Button variant="secondary" asChild>
              <Link to="/reel">
                <Clapperboard className="size-4" />
                Open the reel
              </Link>
            </Button>
          </Card>
        </>
        )}

        {step !== "scan" && book && (
          <Card className="overflow-hidden p-0">
            <div className="grid gap-0 md:grid-cols-[9.5rem_minmax(0,1fr)]">
              <div className="bg-ink/5">
                {book.coverUrl ? (
                  <img
                    src={book.coverUrl}
                    alt=""
                    className="h-full max-h-64 w-full object-cover md:max-h-none"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="grid h-40 place-items-center text-subtle md:h-full">No cover</div>
                )}
              </div>
              <div className="space-y-3 p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="cloth">{book.source}</Badge>
                  {dupes > 0 && <Badge tone="warn">{dupes} already in stock</Badge>}
                  {book.isbn13 && (
                    <span className="font-mono text-xs text-muted">{formatIsbnDisplay(book.isbn13)}</span>
                  )}
                </div>
                <h2 className="font-display text-2xl font-semibold leading-tight">
                  {book.title || "Untitled — read the title page"}
                </h2>
                <p className="text-muted">
                  {book.author || "Author unknown"}
                  {book.publishedYear ? ` · ${book.publishedYear}` : ""}
                  {` · ${formatLabel(book.format)}`}
                </p>
                {!book.title && (
                  <Button variant="secondary" size="sm" onClick={() => void runIdentify()} disabled={busy}>
                    Read title page photo
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {step === "grade" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {CONDITION_GRADES.map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setGrade(g.id);
                    say(g.label);
                  }}
                  className={cn(
                    "min-h-24 rounded-lg border px-3 py-4 text-left transition-colors duration-150",
                    grade === g.id
                      ? "border-cloth bg-cloth text-cloth-fg"
                      : "border-rule bg-elevated hover:border-rule-strong",
                  )}
                >
                  <span className="block text-[11px] uppercase tracking-[0.18em] opacity-70">
                    Key {i + 1}
                  </span>
                  <span className="mt-1 block font-display text-xl font-semibold">{g.short}</span>
                  <span className="mt-1 block text-sm opacity-80">{g.hint}</span>
                </button>
              ))}
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">Tap what you see</p>
              <div className="flex flex-wrap gap-2">
                {DEFECTS.map((d) => {
                  const on = defects.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() =>
                        setDefects((prev) =>
                          on ? prev.filter((x) => x !== d.id) : [...prev, d.id],
                        )
                      }
                      className={cn(
                        "h-11 rounded-full border px-4 text-sm",
                        on ? "border-stamp bg-stamp text-stamp-fg" : "border-rule bg-elevated",
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Photos</p>
                  <span className="text-xs text-subtle">{photos.length}/3</span>
                </div>
                <video
                  ref={videoRef}
                  className={cn(
                    "aspect-video w-full rounded-md bg-ink object-cover",
                    camOn ? "block" : "hidden",
                  )}
                  muted
                  playsInline
                  autoPlay
                />
                <div className="flex flex-wrap gap-2">
                  {!camOn ? (
                    <Button variant="secondary" size="sm" onClick={() => void startCam()}>
                      <Camera className="size-4" />
                      Camera
                    </Button>
                  ) : (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => void snapPhoto()}>
                        Snap
                      </Button>
                      <Button variant="ghost" size="sm" onClick={stopCam}>
                        Stop
                      </Button>
                    </>
                  )}
                  <label className="inline-flex h-9 cursor-pointer items-center rounded-sm border border-rule bg-elevated px-3 text-sm">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={(e) => void onUpload(e.target.files)}
                    />
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={photos.length === 0 || busy}
                    onClick={() => void runAssess()}
                  >
                    Grade from photos
                  </Button>
                </div>
                {photos.length > 0 && (
                  <div className="flex gap-2">
                    {photos.map((p, i) => (
                      <img
                        key={i}
                        src={p}
                        alt=""
                        className="size-16 rounded-sm object-cover"
                      />
                    ))}
                  </div>
                )}
              </Card>
              <Card className="p-4">
                <label className="text-xs uppercase tracking-[0.18em] text-muted">
                  Extra note
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder="Only if something odd — smell, missing map, etc."
                  className="mt-2 w-full resize-none rounded-md border border-rule bg-paper p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </Card>
            </div>

            <Button size="xl" className="w-full" disabled={!grade || busy} onClick={() => void goToList()}>
              {busy ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
              Next — write the listing
            </Button>
          </div>
        )}

        {step === "list" && book && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {(["bin", "offer", "auction"] as ListFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setListFormat(f)}
                  className={cn(
                    "h-12 rounded-md border px-4 text-sm capitalize whitespace-nowrap",
                    listFormat === f ? "border-cloth bg-cloth text-cloth-fg" : "border-rule bg-elevated",
                  )}
                >
                  {f === "bin" ? "Buy It Now" : f === "offer" ? "BIN + offer" : "Auction"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="secondary" size="lg" onClick={() => setPrice((p) => Math.max(2.99, roundDown(p)))}>
                −
              </Button>
              <div className="min-w-36 text-center">
                <p className="font-display text-5xl font-semibold tabular-nums tracking-tight">
                  ${price.toFixed(2)}
                </p>
                <p className="text-xs text-muted">
                  eBay net about ${netProceeds(price).toFixed(2)} after 15.3% + order fee. Stamp is
                  the same on every shelf — see the jewels below.
                </p>
              </div>
              <Button variant="secondary" size="lg" onClick={() => setPrice((p) => p + 1)}>
                +
              </Button>
            </div>

            {ticket && <JewelsCard ticket={ticket} />}

            {skipSuggested && (
              <p className="rounded-md border border-stamp/30 bg-elevated px-3 py-2 text-sm text-stamp">
                Fees eat this one. Skip unless it is scarce.
              </p>
            )}

            <Card className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">eBay title</p>
                {polished ? <Badge tone="good">Polished</Badge> : polishing ? <Badge>Writing…</Badge> : <Badge>Template</Badge>}
              </div>
              <Input value={ebayTitle} onChange={(e) => setEbayTitle(e.target.value.slice(0, 80))} />
              <p className="text-right text-xs tabular-nums text-subtle">{ebayTitle.length}/80</p>
              <textarea
                value={ebayDescription}
                onChange={(e) => setEbayDescription(e.target.value)}
                rows={8}
                className="w-full resize-none rounded-md border border-rule bg-paper p-3 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-sm text-muted">{rationale}</p>
            </Card>

            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">
                List everywhere
              </p>
              <div className="flex flex-wrap gap-2">
                {LISTABLE_CHANNELS.map((ch) => {
                  const allowed = listFormat !== "auction" || ch.supportsAuction;
                  const on = allowed && selectedChannels.includes(ch.slug);
                  return (
                    <button
                      key={ch.slug}
                      type="button"
                      disabled={!allowed}
                      onClick={() =>
                        setSelectedChannels((prev) =>
                          prev.includes(ch.slug)
                            ? prev.filter((x) => x !== ch.slug)
                            : [...prev, ch.slug],
                        )
                      }
                      className={cn(
                        "h-11 rounded-full border px-4 text-sm",
                        !allowed && "cursor-not-allowed opacity-40",
                        on
                          ? "border-cloth bg-cloth text-cloth-fg"
                          : "border-rule bg-elevated",
                      )}
                    >
                      {ch.name}
                      <span className="ml-2 text-[11px] uppercase tracking-[0.12em] opacity-70">
                        {ch.kind === "rest" ? "API" : "file"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {listFormat === "auction" && (
                <p className="mt-2 text-sm text-muted">
                  Auctions are eBay-only. BIN copies go to every selected shelf.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                size="xl"
                className="w-full"
                disabled={busy || !book.title || channelsForFormat(listFormat, selectedChannels).length === 0}
                onClick={() => void commit("ready")}
              >
                {busy ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
                List everywhere
              </Button>
              <Button
                size="xl"
                variant="secondary"
                className="w-full"
                disabled={busy}
                onClick={() => void commit("skipped")}
              >
                <SkipForward className="size-5" />
                Skip / donate
              </Button>
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">How she works the lane</p>
          <ol className="mt-4 space-y-3 text-sm text-muted">
            <li>1. Scan. The gun types. She never hunts letters.</li>
            <li>2. Tap a grade. Keys 1–4 work too.</li>
            <li>3. Tap defects. Snap a photo only when it matters.</li>
            <li>4. Hear the price. Change it with + / − if it feels wrong.</li>
            <li>5. List everywhere. Bin is assigned. Put the book there.</li>
          </ol>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Machine vs human</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex gap-2">
              <Keyboard className="mt-0.5 size-4 text-subtle" />
              <span>Machine writes titles, ISBN data, shipping, and pushes every shelf.</span>
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 text-good" />
              <span>She grades, prices, photos, bins, packs, and talks to buyers.</span>
            </li>
          </ul>
        </Card>
        {preview && step === "grade" && (
          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Likely ticket</p>
            <p className="mt-3 font-display text-3xl font-semibold tabular-nums">${preview.listPrice.toFixed(2)}</p>
            <p className="mt-1 text-sm text-muted">{preview.rationale}</p>
          </Card>
        )}
        {ticket && step === "grade" && <JewelsCard ticket={ticket} compact />}
      </aside>
    </div>
  );
}

function roundDown(p: number): number {
  const n = Math.max(2.99, p - 1);
  return Math.round(n) - 0.01;
}
