// Ortak yardımcılar

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

const pad = (n) => String(n).padStart(2, "0");

/** Yerel saate göre bugünün tarihi: "2026-11-17" */
export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

const fmtLong = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long" });
const fmtShort = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", weekday: "short" });
export const fmtDate = (iso) => fmtLong.format(parseISO(iso));
export const fmtDateShort = (iso) => fmtShort.format(parseISO(iso));

export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

/** Fisher-Yates; seed verilirse her seferinde aynı sırayı üretir. */
export function shuffle(arr, seed) {
  const a = [...arr];
  let s = seed ? [...String(seed)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) : null;
  const rnd = () => {
    if (s === null) return Math.random();
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Cevap karşılaştırması için normalleştirme:
 * küçük harf, kıvrık kesme işaretleri düz, kesme dışındaki noktalama atılır, boşluklar sadeleşir.
 */
export function normalize(s) {
  return String(s ?? "")
    .toLocaleLowerCase("en")
    .replace(/[’‘`´]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const isAccepted = (input, answers) => {
  const n = normalize(input);
  return n.length > 0 && answers.some((a) => normalize(a) === n);
};

export const TYPE_LABELS = {
  new: "Yeni konu",
  practice: "Uygulama",
  review: "Tekrar",
  exam: "Sınav",
};
