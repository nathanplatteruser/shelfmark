import { useEffect, type RefObject } from "react";

const ATTEMPTS: MediaStreamConstraints[] = [
  {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  },
  { audio: false, video: { facingMode: { ideal: "environment" } } },
  { audio: false, video: true },
];

export function cameraAvailable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

export async function openCamera(): Promise<MediaStream> {
  if (!cameraAvailable()) {
    throw Object.assign(new Error("Camera is not available in this browser."), { name: "NotFoundError" });
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw Object.assign(new Error("Camera needs https."), { name: "SecurityError" });
  }
  let last: unknown;
  for (const constraints of ATTEMPTS) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      last = err;
    }
  }
  throw last instanceof Error ? last : new Error("Could not open a camera.");
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

export async function bindCamera(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  if (video.srcObject !== stream) video.srcObject = stream;
  try {
    await video.play();
  } catch {
    /* autoplay can reject until the next user gesture; srcObject is still bound */
  }
}

export function explainCameraError(err: unknown): string {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
  if (name === "SecurityError") {
    return "Camera needs a secure page. Open Shelfmark from the app link, not a raw http address.";
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission was denied. Allow it once, or snap a photo of the barcode instead.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera found. A laptop needs a webcam. A phone can snap the barcode instead.";
  }
  if (name === "OverconstrainedError") {
    return "This device would not open the rear camera. Trying the webcam failed too — snap a photo of the barcode.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera is already in use by another app. Close that, then try again.";
  }
  return "Could not open the camera. Snap a photo of the barcode, or use the USB gun.";
}

/** Phone: back camera. Laptop: built-in webcam. Bind after the <video> is on screen. */
export function useBindCamera(
  videoRef: RefObject<HTMLVideoElement | null>,
  stream: MediaStream | null,
  active: boolean,
) {
  useEffect(() => {
    const video = videoRef.current;
    if (!active || !video || !stream) return;
    void bindCamera(video, stream);
    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [videoRef, stream, active]);
}
