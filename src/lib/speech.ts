/** Checkout-lane voice. Uses the Mac/browser speech engine — no typing required. */

let last = "";

export function speak(text: string, opts?: { interrupt?: boolean }) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const t = text.trim();
  if (!t) return;
  if (!opts?.interrupt && t === last) return;
  last = t;
  if (opts?.interrupt) window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.rate = 1.02;
  u.pitch = 1;
  u.lang = "en-US";
  window.speechSynthesis.speak(u);
}

export function beep(ok = true) {
  if (typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const now = ctx.currentTime;

  function tone(freq: number, start: number, dur: number, gain = 0.05) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, now + start);
    g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(now + start);
    o.stop(now + start + dur);
  }

  if (ok) {
    tone(980, 0, 0.07);
    tone(1310, 0.08, 0.09);
  } else {
    tone(220, 0, 0.2, 0.05);
  }
  window.setTimeout(() => void ctx.close(), 400);
}
