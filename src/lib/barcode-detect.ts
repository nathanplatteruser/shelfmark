import { normalizeScannedCode } from "@/lib/isbn";

type DetectorInstance = {
  detect: (source: ImageBitmapSource) => Promise<{ rawValue: string; format: string }[]>;
};

type ZxingReader = { decodeFromCanvas: (canvas: HTMLCanvasElement) => { getText: () => string } };

export function getBarcodeDetector(): DetectorInstance | null {
  if (typeof window === "undefined") return null;
  const Ctor = (
    window as unknown as {
      BarcodeDetector?: new (opts?: { formats?: string[] }) => DetectorInstance;
    }
  ).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "isbn_13", "isbn_10"],
    });
  } catch {
    try {
      return new Ctor();
    } catch {
      return null;
    }
  }
}

/** Native Chrome detector, or ZXing on Safari/iPhone/Firefox. */
export function barcodeDetectSupported(): boolean {
  return typeof window !== "undefined";
}

export function nativeBarcodeSupported(): boolean {
  return getBarcodeDetector() !== null;
}

let zxingPromise: Promise<ZxingReader> | null = null;

async function getZxing(): Promise<ZxingReader> {
  if (!zxingPromise) {
    zxingPromise = import("@zxing/browser").then(async (browser) => {
      const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
      ]);
      return new browser.BrowserMultiFormatReader(hints);
    });
  }
  return zxingPromise;
}

function pickIsbn(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const isbn = normalizeScannedCode(raw);
  if (!isbn) return null;
  if (isbn.startsWith("978") || isbn.startsWith("979") || isbn.length >= 12) return isbn;
  return isbn;
}

export function grabFrame(video: HTMLVideoElement, max = 520, quality = 0.58): string {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export function drawVideoToCanvas(video: HTMLVideoElement, canvas: HTMLCanvasElement, max = 640) {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  const scale = Math.min(1, max / Math.max(w, h));
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
}

async function detectNative(source: ImageBitmapSource): Promise<string | null> {
  const detector = getBarcodeDetector();
  if (!detector) return null;
  try {
    const codes = await detector.detect(source);
    for (const c of codes) {
      const isbn = pickIsbn(c.rawValue);
      if (isbn) return isbn;
    }
  } catch {
    /* empty frame */
  }
  return null;
}

async function detectZxing(canvas: HTMLCanvasElement): Promise<string | null> {
  try {
    const reader = await getZxing();
    const result = reader.decodeFromCanvas(canvas);
    return pickIsbn(result.getText());
  } catch {
    return null;
  }
}

export async function detectIsbnFromCanvas(
  detector: DetectorInstance | null,
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  if (detector) {
    const native = await detectNative(canvas);
    if (native) return native;
  }
  return detectZxing(canvas);
}

export async function detectIsbnFromVideo(video: HTMLVideoElement): Promise<string | null> {
  if (video.readyState < 2) return null;
  const native = await detectNative(video);
  if (native) return native;
  const canvas = document.createElement("canvas");
  drawVideoToCanvas(video, canvas, 640);
  return detectZxing(canvas);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = url;
  });
}

export async function detectIsbnFromFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const native = await detectNative(img);
    if (native) return native;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return detectZxing(canvas);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
