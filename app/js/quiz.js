// Etkileşimli quiz: mcq, fill, match, order, translate

import { esc, shuffle, normalize, isAccepted, todayISO } from "./util.js";
import { inline } from "./md.js";
import { store } from "./store.js";
import { sayBtn } from "./speech.js";

const TYPE_HINT = {
  mcq: "Doğru seçeneği seç",
  fill: "Boşluğu doldur",
  match: "Eşleştir",
  order: "Kelimeleri doğru sıraya koy",
  translate: "İngilizceye çevir",
};

/** Sorudan "doğru cevap" metni (geri bildirim ve hata defteri için) */
function expected(q) {
  switch (q.type) {
    case "mcq": return q.answer;
    case "fill": return q.prompt.replace("___", q.answer[0]);
    case "order": return q.answer;
    case "translate": return q.answer[0];
    case "match": return q.pairs.map(([l, r]) => `${l} = ${r}`).join(", ");
  }
}

export function runQuiz(root, lesson, { onExit } = {}) {
  const questions = lesson.quiz || [];
  let idx = 0;
  let results = []; // { q, correct, given }
  let answered = false;

  function render() {
    answered = false;
    if (idx >= questions.length) return renderSummary();
    const q = questions[idx];
    const pct = Math.round((idx / questions.length) * 100);
    root.innerHTML = `
      <div class="quiz">
        <div class="quiz-top">
          <button class="link" data-q="exit">✕ Çık</button>
          <span class="muted">${idx + 1} / ${questions.length}</span>
        </div>
        <div class="progress"><span style="width:${pct}%"></span></div>
        <p class="eyebrow">${TYPE_HINT[q.type]}</p>
        <div class="q-body">${body(q, idx)}</div>
        <div class="feedback" aria-live="polite"></div>
        <div class="q-actions">
          ${q.type === "mcq" ? "" : '<button class="btn primary" data-q="check">Kontrol et</button>'}
        </div>
      </div>`;
    root.querySelector("input, textarea")?.focus();
  }

  function body(q, i) {
    const seed = `${lesson.id}-${i}`;
    switch (q.type) {
      case "mcq":
        return `<p class="q-prompt">${inline(q.prompt)}</p>
          <div class="options">${shuffle(q.options, seed)
            .map((o) => `<button class="option" data-q="pick" data-val="${esc(o)}">${esc(o)}</button>`)
            .join("")}</div>`;
      case "fill": {
        const [a, b] = q.prompt.split("___");
        return `<p class="q-prompt fill">${inline(a)}<input class="blank" type="text" autocapitalize="off" autocomplete="off" spellcheck="false" aria-label="Boşluk">${inline(b ?? "")}</p>`;
      }
      case "translate":
        return `<p class="q-prompt">${esc(q.prompt)}</p>
          <textarea rows="2" class="answer" autocapitalize="sentences" autocomplete="off" spellcheck="false" placeholder="İngilizcesini yaz..."></textarea>`;
      case "order":
        return `<div class="built" data-built aria-label="Cümlen"></div>
          <div class="chips">${shuffle(q.words, seed)
            .map((w, k) => `<button class="chip" data-q="chip" data-k="${k}">${esc(w)}</button>`)
            .join("")}</div>`;
      case "match": {
        const rights = shuffle(q.pairs.map((p) => p[1]), seed);
        return `${q.prompt ? `<p class="q-prompt">${inline(q.prompt)}</p>` : ""}
          <div class="match">${q.pairs
            .map(([l], k) => `<label class="match-row"><span>${esc(l)}</span>
              <select data-k="${k}"><option value="">Seç…</option>${rights
                .map((r) => `<option value="${esc(r)}">${esc(r)}</option>`)
                .join("")}</select></label>`)
            .join("")}</div>`;
      }
    }
  }

  function check(pickVal) {
    if (answered) return;
    const q = questions[idx];
    let correct = false;
    let given = "";

    switch (q.type) {
      case "mcq":
        given = pickVal;
        correct = pickVal === q.answer;
        root.querySelectorAll(".option").forEach((b) => {
          b.disabled = true;
          if (b.dataset.val === q.answer) b.classList.add("ok");
          else if (b.dataset.val === pickVal) b.classList.add("bad");
        });
        break;
      case "fill":
      case "translate": {
        const el = root.querySelector(".blank, .answer");
        given = el.value;
        if (!normalize(given)) return el.focus();
        correct = isAccepted(given, q.answer);
        el.disabled = true;
        el.classList.add(correct ? "ok" : "bad");
        break;
      }
      case "order": {
        const words = [...root.querySelectorAll("[data-built] .chip")].map((c) => c.textContent);
        if (words.length < q.words.length) return;
        given = words.join(" ");
        correct = normalize(given) === normalize(q.answer);
        root.querySelectorAll(".chip").forEach((c) => (c.disabled = true));
        root.querySelector("[data-built]").classList.add(correct ? "ok" : "bad");
        break;
      }
      case "match": {
        const sels = [...root.querySelectorAll("select")];
        if (sels.some((s) => !s.value)) return;
        correct = true;
        const parts = [];
        sels.forEach((s) => {
          const [l, r] = q.pairs[+s.dataset.k];
          const ok = s.value === r;
          correct &&= ok;
          s.disabled = true;
          s.classList.add(ok ? "ok" : "bad");
          parts.push(`${l} = ${s.value}`);
        });
        given = parts.join(", ");
        break;
      }
    }

    answered = true;
    results[idx] = { q, correct, given };
    showFeedback(q, correct);
  }

  function showFeedback(q, correct) {
    const fb = root.querySelector(".feedback");
    const exp = expected(q);
    const canOverride = !correct && q.type === "translate";
    fb.className = `feedback ${correct ? "ok" : "bad"}`;
    fb.innerHTML = `
      <strong>${correct ? "Doğru! 🎉" : "Doğru cevap:"}</strong>
      ${correct ? "" : `<span class="en">${esc(exp)}</span> ${q.type !== "match" ? sayBtn(exp) : ""}`}
      ${q.explanation ? `<p class="muted">${esc(q.explanation)}</p>` : ""}
      ${canOverride ? `<p class="muted small">Cevabın da doğru olabilir. İngilizcede aynı şey birkaç şekilde söylenebilir.
        <button class="link" data-q="override">Cevabım doğruydu</button></p>` : ""}`;
    root.querySelector(".q-actions").innerHTML =
      `<button class="btn primary" data-q="next">${idx + 1 < questions.length ? "Sonraki" : "Sonucu gör"}</button>`;
    root.querySelector('[data-q="next"]').focus();
  }

  function renderSummary() {
    const score = results.filter((r) => r.correct).length;
    const total = questions.length;
    const pct = Math.round((score / total) * 100);
    store.update((s) => {
      (s.quizzes[lesson.id] ||= []).push({ date: todayISO(), score, total });
    });
    const wrong = results.map((r, i) => ({ ...r, i })).filter((r) => !r.correct);
    const msg = pct >= 90 ? "Harika iş!" : pct >= 70 ? "Çok iyi!" : pct >= 50 ? "Fena değil, biraz tekrar iyi olur." : "Bu dersi bir kez daha gözden geçirelim.";
    root.innerHTML = `
      <div class="quiz summary">
        <div class="score-ring" style="--p:${pct}"><span>${score}/${total}</span></div>
        <h2>${msg}</h2>
        <p class="muted">%${pct} doğru</p>
        ${wrong.length ? `<h3>Yanlışlar</h3><ul class="wrong-list">${wrong
          .map((r) => `<li>
            <div><span class="muted small">Senin cevabın:</span> <del>${esc(r.given || "—")}</del></div>
            <div><span class="muted small">Doğrusu:</span> <strong>${esc(expected(r.q))}</strong></div>
            <button class="link small" data-q="to-errors" data-i="${r.i}">+ Hata defterine ekle</button>
          </li>`).join("")}</ul>` : ""}
        <div class="row gap">
          <button class="btn" data-q="restart">Tekrar çöz</button>
          <button class="btn primary" data-q="exit">Bitir</button>
        </div>
      </div>`;
  }

  root.onclick = (e) => {
    const t = e.target.closest("[data-q]");
    if (!t) return;
    const act = t.dataset.q;
    if (act === "pick") check(t.dataset.val);
    else if (act === "check") check();
    else if (act === "next") { idx++; render(); }
    else if (act === "exit") onExit?.();
    else if (act === "restart") { idx = 0; results = []; render(); }
    else if (act === "override") {
      results[idx].correct = true;
      showFeedback(questions[idx], true);
    } else if (act === "chip") {
      const built = root.querySelector("[data-built]");
      if (t.parentElement === built) root.querySelector(".chips").append(t);
      else built.append(t);
    } else if (act === "to-errors") {
      const r = results[+t.dataset.i];
      store.update((s) => s.errors.unshift({
        id: Date.now(), date: todayISO(), wrong: r.given, correct: expected(r.q), note: `${lesson.title} quiz`,
      }));
      t.replaceWith(Object.assign(document.createElement("span"), { className: "muted small", textContent: "✓ Eklendi" }));
    }
  };

  root.onkeydown = (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.target.matches(".blank, .answer")) {
      e.preventDefault();
      answered ? (idx++, render()) : check();
    }
  };

  render();
}
