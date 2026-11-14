// Tarayıcının yerleşik konuşma sentezi (text-to-speech). İnternet gerektirmez,
// ses kalitesi cihaza ve tarayıcıya bağlıdır.

import { store } from "./store.js";
import { esc } from "./util.js";

export const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

let voices = [];
if (ttsSupported) {
  const loadVoices = () => (voices = speechSynthesis.getVoices());
  loadVoices();
  speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
}

function pickVoice(lang) {
  return (
    voices.find((v) => v.lang === lang && v.localService) ||
    voices.find((v) => v.lang === lang) ||
    voices.find((v) => v.lang.replace("_", "-").startsWith(lang)) ||
    voices.find((v) => v.lang.startsWith("en"))
  );
}

/** Metni seslendirir. queue=true ise öncekini kesmeden sıraya ekler (diyalog için). */
export function speak(text, { queue = false } = {}) {
  if (!ttsSupported || !text) return;
  const { accent, rate } = store.get().settings;
  if (!queue) speechSynthesis.cancel();
  // "I am / I'm" gibi kartlarda eğik çizgiyi kısa duraklamaya çevir; parantez içini okuma
  const clean = String(text).replace(/\([^)]*\)/g, "").replace(/\s*\/\s*/g, ", ").trim();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = accent;
  u.rate = rate;
  const v = pickVoice(accent);
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

export const speakerIcon =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 10v4h4l5 4V6L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';

/** Seslendirme düğmesi HTML'i; tıklama app.js'teki olay yöneticisinde yakalanır. */
export const sayBtn = (text, label = "Dinle") =>
  ttsSupported
    ? `<button class="say" data-say="${esc(text)}" aria-label="${esc(label)}" title="${esc(label)}">${speakerIcon}</button>`
    : "";
