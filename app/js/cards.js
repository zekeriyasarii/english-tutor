// Kelime kartları — Leitner aralıklı tekrar sistemi
// Kutu 1..5; bilinen kart bir üst kutuya çıkar ve INTERVALS[kutu] gün sonra tekrar gelir.
// Bilinmeyen kart kutu 1'e döner ve aynı oturumda tekrar sorulur.

import { esc, shuffle, todayISO, addDays } from "./util.js";
import { store } from "./store.js";
import { sayBtn, speak } from "./speech.js";

const INTERVALS = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };
export const cardKey = (v) => v.en.toLocaleLowerCase("en").trim();

/** Kelime havuzundan bugün tekrar edilmesi gerekenler (hiç görülmemişler dahil) */
export function dueCards(pool, today = todayISO()) {
  const state = store.get().cards;
  return pool.filter((v) => {
    const c = state[cardKey(v)];
    return !c || c.due <= today;
  });
}

export function cardStats(pool) {
  const state = store.get().cards;
  const boxes = [0, 0, 0, 0, 0, 0]; // 0 = yeni
  pool.forEach((v) => boxes[state[cardKey(v)]?.box ?? 0]++);
  return boxes;
}

function grade(v, known) {
  const today = todayISO();
  store.update((s) => {
    const key = cardKey(v);
    const prev = s.cards[key]?.box ?? 0;
    const box = known ? Math.min(prev + 1, 5) : 1;
    s.cards[key] = { box, due: known ? addDays(today, INTERVALS[box]) : today };
  });
}

/**
 * Kart oturumu. direction: "en-tr" (İngilizce görüp Türkçesini hatırla) veya "tr-en".
 */
export function runCards(root, cards, { title = "Kelime kartları", onExit, direction = "en-tr" } = {}) {
  let queue = shuffle(cards);
  const seen = new Set();
  let known = 0;
  let flipped = false;
  const total = cards.length;

  function render() {
    flipped = false;
    if (!queue.length) return renderDone();
    const v = queue[0];
    const front = direction === "en-tr"
      ? `<div class="card-en">${esc(v.en)} ${sayBtn(v.en)}</div>`
      : `<div class="card-tr">${esc(v.tr)}</div>`;
    root.innerHTML = `
      <div class="cards">
        <div class="quiz-top">
          <button class="link" data-c="exit">✕ Çık</button>
          <span class="muted">${esc(title)} · ${total - queue.length} / ${total}</span>
        </div>
        <div class="progress"><span style="width:${Math.round(((total - queue.length) / total) * 100)}%"></span></div>
        <div class="flashcard" data-c="flip" role="button" tabindex="0" aria-label="Kartı çevir">
          ${front}
          <div class="card-back" hidden>
            ${direction === "en-tr" ? `<div class="card-tr">${esc(v.tr)}</div>` : `<div class="card-en">${esc(v.en)} ${sayBtn(v.en)}</div>`}
            ${v.example ? `<div class="card-ex"><span class="en">${esc(v.example)}</span> ${sayBtn(v.example)}<br><span class="muted">${esc(v.example_tr || "")}</span></div>` : ""}
            ${v.note ? `<div class="muted small">${esc(v.note)}</div>` : ""}
          </div>
          <div class="hint muted small">Hatırlamaya çalış, sonra kartı çevir (boşluk tuşu)</div>
        </div>
        <div class="card-actions" hidden>
          <button class="btn bad" data-c="no">Bilmedim <kbd>1</kbd></button>
          <button class="btn ok" data-c="yes">Bildim <kbd>2</kbd></button>
        </div>
      </div>`;
    if (direction === "en-tr" && store.get().settings.autoSpeak !== false) speak(v.en);
  }

  function flip() {
    if (flipped) return;
    flipped = true;
    root.querySelector(".card-back").hidden = false;
    root.querySelector(".hint").hidden = true;
    root.querySelector(".card-actions").hidden = false;
    if (direction === "tr-en") speak(queue[0].en);
  }

  function answer(isKnown) {
    if (!flipped) return;
    const v = queue.shift();
    const first = !seen.has(cardKey(v));
    seen.add(cardKey(v));
    if (first) grade(v, isKnown);
    if (isKnown) known += first ? 1 : 0;
    else queue.push(v); // oturum içinde tekrar sor
    render();
  }

  function renderDone() {
    root.innerHTML = `
      <div class="cards summary">
        <div class="score-ring" style="--p:${Math.round((known / total) * 100)}"><span>${known}/${total}</span></div>
        <h2>Oturum bitti!</h2>
        <p class="muted">${total} kartın ${known} tanesini ilk seferde bildin. Bilmediklerin yarın tekrar gelecek.</p>
        <div class="row gap"><button class="btn primary" data-c="exit">Tamam</button></div>
      </div>`;
  }

  root.onclick = (e) => {
    if (e.target.closest(".say")) return; // seslendirme düğmesi kartı çevirmesin
    const t = e.target.closest("[data-c]");
    if (!t) return;
    ({ flip, yes: () => answer(true), no: () => answer(false), exit: () => onExit?.() })[t.dataset.c]?.();
  };

  const onKey = (e) => {
    if (!root.isConnected) return document.removeEventListener("keydown", onKey);
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
    else if (e.key === "1") answer(false);
    else if (e.key === "2") answer(true);
  };
  document.addEventListener("keydown", onKey);

  render();
}
