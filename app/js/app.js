// English Coach — ana modül: veri yükleme, yönlendirme (hash router) ve ekranlar

import { $, esc, todayISO, fmtDate, fmtDateShort, daysBetween, TYPE_LABELS } from "./util.js";
import { markdown, inline } from "./md.js";
import { store } from "./store.js";
import { speak, sayBtn, ttsSupported } from "./speech.js";
import { runQuiz } from "./quiz.js";
import { runCards, dueCards, cardStats } from "./cards.js";

const main = $("#main");
let sessions = [];          // sessions.json — tarihli seans listesi
const content = new Map();  // id → seans içeriği (content.json)

// ------------------------------------------------------------------ veri

async function loadData() {
  const [c, s] = await Promise.all([
    fetch("data/content.json").then((r) => r.json()),
    fetch("data/sessions.json").then((r) => r.json()),
  ]);
  c.forEach((doc) => content.set(doc.id, doc));
  sessions = s.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

const isDone = (id) => Boolean(store.get().completed[id]);
const today = () => todayISO();

function currentSession() {
  const t = today();
  return sessions.find((s) => s.date === t) || sessions.find((s) => s.date > t) || null;
}

/** Kart havuzu: tamamlanan veya tarihi gelmiş derslerin kelimeleri */
function unlockedVocab() {
  const t = today();
  const seen = new Set();
  const pool = [];
  for (const s of sessions) {
    if (!(isDone(s.id) || s.date <= t)) continue;
    for (const v of content.get(s.id)?.vocabulary || []) {
      const k = v.en.toLocaleLowerCase("en");
      if (!seen.has(k)) { seen.add(k); pool.push({ ...v, lesson: s.id }); }
    }
  }
  return pool;
}

function lastQuiz(id) {
  const q = store.get().quizzes[id];
  return q?.length ? q[q.length - 1] : null;
}

function bestQuiz(id) {
  const q = store.get().quizzes[id];
  if (!q?.length) return null;
  return q.reduce((b, r) => (r.score / r.total > b.score / b.total ? r : b));
}

// ---------------------------------------------------------------- parçalar

const badge = (type) => `<span class="badge t-${type}">${TYPE_LABELS[type] || type}</span>`;

function statusIcon(s) {
  if (isDone(s.id)) return '<span class="status done" title="Tamamlandı">✓</span>';
  if (s.date === today()) return '<span class="status today" title="Bugün">●</span>';
  if (s.date < today() && content.has(s.id)) return '<span class="status missed" title="Tamamlanmadı">!</span>';
  return '<span class="status"></span>';
}

function sessionRow(s) {
  const ready = content.has(s.id);
  return `<a class="session-row ${ready ? "" : "not-ready"} ${s.date === today() ? "is-today" : ""}" href="#/lesson/${s.id}">
    ${statusIcon(s)}
    <span class="sr-date">${fmtDateShort(s.date)}</span>
    <span class="sr-title">${esc(s.title)}${ready ? "" : ' <span class="muted small">· hazırlanıyor</span>'}</span>
    ${badge(s.type)}
  </a>`;
}

function setTitle(t) {
  document.title = t ? `${t} · English Coach` : "English Coach";
}

// ----------------------------------------------------------------- ekranlar

function viewHome() {
  setTitle();
  const cur = currentSession();
  const t = today();
  const missed = sessions.filter((s) => s.date < t && !isDone(s.id) && content.has(s.id));
  const done = sessions.filter((s) => isDone(s.id)).length;
  const pool = unlockedVocab();
  const due = dueCards(pool).length;
  const quizzes = Object.values(store.get().quizzes).flat();
  const avg = quizzes.length ? Math.round((quizzes.reduce((a, q) => a + q.score / q.total, 0) / quizzes.length) * 100) : null;
  const week = cur ? sessions.filter((s) => s.level === cur.level && s.week === cur.week) : [];
  const isTodayLesson = cur && cur.date === t;
  const daysTo = cur ? daysBetween(t, cur.date) : 0;
  const role = store.get().settings.role;

  main.innerHTML = `
    <header class="page-head">
      <p class="eyebrow">${fmtDate(t)}</p>
      <h1>${role === "teacher" ? "Merhaba, öğretmen 👋" : "Merhaba! 👋"}</h1>
    </header>

    ${cur ? `
    <section class="hero ${isTodayLesson ? "is-today" : ""}">
      <p class="eyebrow">${isTodayLesson ? "Bugünün dersi" : daysTo === 1 ? "Yarınki ders" : `Sıradaki ders · ${daysTo} gün sonra`}</p>
      <h2>${esc(cur.title)}</h2>
      <p class="muted">${esc(cur.theme)} · ${fmtDate(cur.date)}</p>
      <p>${esc(cur.focus)}</p>
      <div class="row gap wrap">
        <a class="btn primary" href="#/lesson/${cur.id}">${isDone(cur.id) ? "Derse tekrar bak" : "Derse başla"}</a>
        ${content.get(cur.id)?.quiz?.length ? `<a class="btn" href="#/quiz/${cur.id}">Quiz</a>` : ""}
        ${badge(cur.type)}
      </div>
    </section>` : `<section class="hero"><h2>Program tamamlandı 🎉</h2><p>Yeni seviye eklendiğinde burada görünecek.</p></section>`}

    <section class="stats">
      <div class="stat"><span class="stat-num">${done}<small>/${sessions.length}</small></span><span class="stat-label">ders tamamlandı</span>
        <div class="progress thin"><span style="width:${(done / sessions.length) * 100}%"></span></div></div>
      <a class="stat" href="#/cards"><span class="stat-num">${due}</span><span class="stat-label">kart bugün tekrar bekliyor</span></a>
      <div class="stat"><span class="stat-num">${avg === null ? "—" : `%${avg}`}</span><span class="stat-label">quiz ortalaması</span></div>
    </section>

    ${missed.length ? `
    <section class="panel warn">
      <h3>Tamamlanmamış dersler</h3>
      <p class="muted small">Tarihi geçmiş ama "tamamlandı" olarak işaretlenmemiş dersler.</p>
      <div class="session-list">${missed.slice(0, 4).map(sessionRow).join("")}</div>
    </section>` : ""}

    ${week.length ? `
    <section class="panel">
      <h3>Bu hafta · ${esc(week[0].theme)}</h3>
      <div class="session-list">${week.map(sessionRow).join("")}</div>
    </section>` : ""}
  `;
}

function viewPlan() {
  setTitle("Plan");
  const weeks = [];
  for (const s of sessions) {
    const key = `${s.level}-${s.week}`;
    let w = weeks.find((x) => x.key === key);
    if (!w) weeks.push((w = { key, level: s.level, week: s.week, theme: s.theme, items: [] }));
    w.items.push(s);
  }
  const cur = currentSession();
  const curKey = cur ? `${cur.level}-${cur.week}` : null;
  let lastLevel = null;

  main.innerHTML = `
    <header class="page-head"><h1>Plan</h1>
      <p class="muted">${sessions.length} seans · ${fmtDate(sessions[0].date)} – ${fmtDate(sessions.at(-1).date)}</p></header>
    ${weeks.map((w) => {
      const lvl = w.level !== lastLevel ? `<h2 class="level-head">${w.level.toUpperCase()}</h2>` : "";
      lastLevel = w.level;
      const doneN = w.items.filter((s) => isDone(s.id)).length;
      return `${lvl}<section class="panel week ${w.key === curKey ? "current" : ""}" id="w-${w.key}">
        <div class="week-head"><h3>Hafta ${w.week} · ${esc(w.theme)}</h3><span class="muted small">${doneN}/${w.items.length}</span></div>
        <div class="session-list">${w.items.map(sessionRow).join("")}</div>
      </section>`;
    }).join("")}`;
  if (curKey) document.getElementById(`w-${curKey}`)?.scrollIntoView({ block: "center" });
}

function viewLesson(id, tab = "notes") {
  const s = sessions.find((x) => x.id === id);
  if (!s) return viewNotFound();
  const doc = content.get(id);
  setTitle(s.title);
  const role = store.get().settings.role;
  const tabs = [
    ["notes", "Notlar"],
    ["vocab", "Kelimeler"],
    ["quiz", "Quiz"],
    ...(role === "teacher" ? [["tutor", "Öğretmen"]] : []),
  ];
  if (!tabs.some(([k]) => k === tab)) tab = "notes";

  main.innerHTML = `
    <header class="page-head">
      <a class="link back" href="#/plan">← Plan</a>
      <p class="eyebrow">${s.level.toUpperCase()} · Hafta ${s.week} · Seans ${s.session} · ${fmtDate(s.date)}</p>
      <h1>${esc(s.title)}</h1>
      <p class="muted">${esc(s.theme)} ${badge(s.type)}</p>
      ${doc ? `<label class="done-toggle"><input type="checkbox" data-act="toggle-done" data-id="${id}" ${isDone(id) ? "checked" : ""}> Bu dersi tamamladık</label>` : ""}
    </header>
    ${doc ? `
      <nav class="tabs" role="tablist">${tabs.map(([k, label]) =>
        `<a role="tab" aria-selected="${k === tab}" class="${k === tab ? "active" : ""}" href="#/lesson/${id}/${k}">${label}</a>`).join("")}</nav>
      <div class="tab-body">${{ notes: tabNotes, vocab: tabVocab, quiz: tabQuiz, tutor: tabTutor }[tab](doc)}</div>`
    : `<section class="panel"><p><strong>Odak:</strong> ${esc(s.focus)}</p><p class="muted">Bu dersin içeriği henüz hazırlanmadı.</p></section>`}`;
}

function tabNotes(doc) {
  const examples = (ex) => ex?.length ? `<div class="examples">${ex.map((x) =>
    `<div class="ex"><div class="en">${esc(x.en)} ${sayBtn(x.en)}</div><div class="tr muted">${esc(x.tr)}</div></div>`).join("")}</div>` : "";
  const d = doc.dialogue;
  return `
    <section class="panel goals"><h2>Bu derste</h2><ul class="checks">${doc.objectives.map((o) => `<li>${esc(o)}</li>`).join("")}</ul></section>
    ${(doc.sections || []).map((s) => `<section class="panel prose"><h2>${esc(s.heading)}</h2>${markdown(s.body)}${examples(s.examples)}</section>`).join("")}
    ${d ? `<section class="panel dialogue"><div class="row between"><h2>Diyalog: ${esc(d.title)}</h2>
        ${ttsSupported ? `<button class="btn small" data-act="play-dialogue">▶ Tümünü dinle</button>` : ""}</div>
        ${d.lines.map((l) => `<div class="line"><span class="speaker">${esc(l.speaker)}</span>
          <div><div class="en">${esc(l.en)} ${sayBtn(l.en)}</div><div class="tr muted">${esc(l.tr)}</div></div></div>`).join("")}
      </section>` : ""}
    ${doc.practice?.length ? `<section class="panel"><h2>Alıştırmalar</h2>${doc.practice.map((p) => `
        <h3>${esc(p.title)}</h3><p>${inline(p.instructions)}</p>
        ${p.items?.length ? `<ul class="items">${p.items.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>` : ""}`).join("")}</section>` : ""}
    ${doc.homework?.length ? `<section class="panel"><h2>Ödev</h2><ul class="checks hw">${doc.homework.map((h) => `<li>${inline(h)}</li>`).join("")}</ul></section>` : ""}
    <div class="row gap center"><a class="btn" href="#/lesson/${doc.id}/vocab">Kelimeler →</a><a class="btn primary" href="#/quiz/${doc.id}">Quiz'e başla →</a></div>`;
}

function tabVocab(doc) {
  const v = doc.vocabulary || [];
  return `
    <div class="row gap wrap">
      <a class="btn primary" href="#/cards/${doc.id}">Kartlarla çalış (EN → TR)</a>
      <a class="btn" href="#/cards/${doc.id}/tr-en">TR → EN</a>
    </div>
    <section class="panel vocab">${v.map((x) => `
      <div class="vrow">
        <div class="en">${esc(x.en)} ${sayBtn(x.en)}</div>
        <div class="tr">${esc(x.tr)}</div>
        ${x.example || x.note ? `<div class="extra muted small">${x.example ? `<em>${esc(x.example)}</em> ${esc(x.example_tr || "")}` : ""}${x.note ? ` ${esc(x.note)}` : ""}</div>` : ""}
      </div>`).join("")}</section>`;
}

function tabQuiz(doc) {
  const hist = store.get().quizzes[doc.id] || [];
  const best = bestQuiz(doc.id);
  return `
    <section class="panel">
      <h2>${doc.quiz?.length || 0} soru</h2>
      <p class="muted">Çoktan seçmeli, boşluk doldurma, eşleştirme, cümle kurma ve çeviri.</p>
      ${best ? `<p>En iyi sonuç: <strong>${best.score}/${best.total}</strong></p>` : ""}
      <a class="btn primary" href="#/quiz/${doc.id}">${hist.length ? "Tekrar çöz" : "Quiz'e başla"}</a>
    </section>
    ${hist.length ? `<section class="panel"><h3>Geçmiş</h3><ul class="plain">${hist.slice(-8).reverse()
      .map((r) => `<li>${fmtDateShort(r.date)} — <strong>${r.score}/${r.total}</strong></li>`).join("")}</ul></section>` : ""}`;
}

function tabTutor(doc) {
  let t = 0;
  return `
    <section class="panel"><h2>Seans akışı (60 dk)</h2>
      <div class="timeline">${doc.plan.map((p) => {
        const row = `<div class="tl-row"><span class="tl-time">${t}–${t + p.minutes}</span><span>${esc(p.activity)}</span></div>`;
        t += p.minutes;
        return row;
      }).join("")}</div></section>
    ${doc.tutor_notes?.length ? `<section class="panel"><h2>İpuçları</h2><ul>${doc.tutor_notes.map((n) => `<li>${inline(n)}</li>`).join("")}</ul></section>` : ""}
    <section class="panel"><h2>Quiz cevapları</h2><ol class="answers">${(doc.quiz || []).map((q) => {
      const a = q.type === "match" ? q.pairs.map((p) => p.join(" = ")).join(", ")
        : Array.isArray(q.answer) ? q.answer.join(" / ") : q.answer;
      return `<li><span class="muted small">${esc(q.prompt || q.words?.join(" "))}</span><br><strong>${esc(a)}</strong></li>`;
    }).join("")}</ol></section>`;
}

function viewQuiz(id) {
  const doc = content.get(id);
  if (!doc?.quiz?.length) return viewNotFound();
  setTitle(`Quiz · ${doc.title}`);
  const box = document.createElement("div");
  main.replaceChildren(box);
  runQuiz(box, doc, { onExit: () => (location.hash = `#/lesson/${id}/quiz`) });
}

function viewCards(id, direction) {
  setTitle("Kartlar");
  if (id) {
    const doc = content.get(id);
    if (!doc?.vocabulary?.length) return viewNotFound();
    const box = document.createElement("div");
    main.replaceChildren(box);
    return runCards(box, doc.vocabulary, {
      title: doc.title, direction: direction || "en-tr",
      onExit: () => (location.hash = `#/lesson/${id}/vocab`),
    });
  }

  const pool = unlockedVocab();
  const due = dueCards(pool);
  const boxes = cardStats(pool);
  const labels = ["Yeni", "Kutu 1", "Kutu 2", "Kutu 3", "Kutu 4", "Kutu 5"];
  const max = Math.max(1, ...boxes);
  main.innerHTML = `
    <header class="page-head"><h1>Kelime kartları</h1>
      <p class="muted">Tamamlanan ve tarihi gelen derslerin kelimeleri. Bildiğin kartlar giderek daha seyrek gelir.</p></header>
    <section class="hero">
      <p class="eyebrow">Bugün</p>
      <h2>${due.length} kart tekrar bekliyor</h2>
      ${due.length ? `<div class="row gap wrap">
          <button class="btn primary" data-act="cards-due" data-dir="en-tr">Başla (EN → TR)</button>
          <button class="btn" data-act="cards-due" data-dir="tr-en">TR → EN</button></div>`
        : pool.length ? "<p>Bugünlük tekrar bitti. Yarın görüşürüz! 👏</p>"
        : `<p>Henüz açılmış kelime yok. Bir dersin <em>Kelimeler</em> sekmesinden kartlarla çalışabilir veya dersi "tamamladık" olarak işaretleyebilirsin.</p>`}
    </section>
    ${pool.length ? `<section class="panel"><h3>Kutular · toplam ${pool.length} kelime</h3>
      <div class="bars">${boxes.map((n, i) => `<div class="bar"><span class="bar-fill" style="height:${(n / max) * 100}%"></span>
        <span class="bar-n">${n}</span><span class="bar-l small muted">${labels[i]}</span></div>`).join("")}</div>
      <p class="muted small">Kutu 5'teki kelimeler 16 günde bir sorulur. Bunlar artık neredeyse kalıcı.</p></section>` : ""}`;
}

function viewErrors() {
  setTitle("Hata defteri");
  const errs = store.get().errors;
  main.innerHTML = `
    <header class="page-head"><h1>Hata defteri</h1>
      <p class="muted">Derslerde tekrar eden hatalar. Haftalık tekrar seanslarında birlikte gözden geçirin.</p></header>
    <form class="panel form" data-form="error">
      <label>Yanlış <input name="wrong" required placeholder="I have 30 years."></label>
      <label>Doğru <input name="correct" required placeholder="I'm 30."></label>
      <label>Not <input name="note" placeholder="Yaş 'be' ile söylenir"></label>
      <button class="btn primary">Ekle</button>
    </form>
    <section class="error-list">${errs.length ? errs.map((e) => `
      <article class="panel err">
        <div class="err-main">
          <div><del>${esc(e.wrong)}</del></div>
          <div class="en"><strong>${esc(e.correct)}</strong> ${sayBtn(e.correct)}</div>
          ${e.note ? `<div class="muted small">${esc(e.note)}</div>` : ""}
        </div>
        <div class="err-side"><span class="muted small">${fmtDateShort(e.date)}</span>
          <button class="link small" data-act="del-error" data-id="${e.id}" aria-label="Sil">Sil</button></div>
      </article>`).join("") : '<p class="muted center">Henüz kayıt yok.</p>'}</section>`;
}

function viewSettings() {
  setTitle("Ayarlar");
  const st = store.get().settings;
  main.innerHTML = `
    <header class="page-head"><h1>Ayarlar</h1></header>
    <form class="panel form" data-form="settings">
      <fieldset><legend>Kim kullanıyor?</legend>
        <label class="radio"><input type="radio" name="role" value="student" ${st.role === "student" ? "checked" : ""}> Öğrenci</label>
        <label class="radio"><input type="radio" name="role" value="teacher" ${st.role === "teacher" ? "checked" : ""}> Öğretmen <span class="muted small">(seans akışı, ipuçları ve cevaplar görünür)</span></label>
      </fieldset>
      <fieldset><legend>Seslendirme</legend>
        ${ttsSupported ? `
        <label>Aksan <select name="accent">
          <option value="en-GB" ${st.accent === "en-GB" ? "selected" : ""}>İngiliz (en-GB)</option>
          <option value="en-US" ${st.accent === "en-US" ? "selected" : ""}>Amerikan (en-US)</option></select></label>
        <label>Hız <input type="range" name="rate" min="0.6" max="1.2" step="0.1" value="${st.rate}"></label>
        <label class="radio"><input type="checkbox" name="autoSpeak" ${st.autoSpeak !== false ? "checked" : ""}> Kartlarda kelimeyi otomatik seslendir</label>
        <button type="button" class="btn small" data-act="test-voice">Sesi dene</button>`
        : "<p class='muted'>Bu tarayıcı seslendirmeyi desteklemiyor.</p>"}
      </fieldset>
    </form>
    <section class="panel">
      <h2>Veriler</h2>
      <p class="muted small">İlerleme sadece bu cihazda saklanır. Başka cihaza taşımak veya yedeklemek için dışa aktar.</p>
      <div class="row gap wrap">
        <button class="btn" data-act="export">Dışa aktar</button>
        <label class="btn">İçe aktar<input type="file" accept="application/json" data-act="import" hidden></label>
        <button class="btn bad" data-act="reset">Sıfırla</button>
      </div>
    </section>
    <p class="muted small center">English Coach · ${content.size}/${sessions.length} seans içeriği yüklü</p>`;
}

function viewNotFound() {
  main.innerHTML = `<section class="panel center"><h2>Sayfa bulunamadı</h2><a class="btn" href="#/">Ana sayfa</a></section>`;
}

// ------------------------------------------------------------------ router

function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [page, a, b] = parts;
  document.querySelectorAll(".nav a").forEach((l) =>
    l.classList.toggle("active", l.dataset.page === (page || "home") || (page === "lesson" && l.dataset.page === "plan") || (page === "quiz" && l.dataset.page === "plan")));
  window.speechSynthesis?.cancel();
  ({
    home: viewHome, plan: viewPlan, lesson: () => viewLesson(a, b), quiz: () => viewQuiz(a),
    cards: () => viewCards(a, b), errors: viewErrors, settings: viewSettings,
  }[page || "home"] || viewNotFound)();
  if (page !== "plan") window.scrollTo(0, 0);
}

// ------------------------------------------------------------------ olaylar

document.addEventListener("click", (e) => {
  const say = e.target.closest("[data-say]");
  if (say) { e.preventDefault(); e.stopPropagation(); return speak(say.dataset.say); }

  const t = e.target.closest("[data-act]");
  if (!t) return;
  const act = t.dataset.act;

  if (act === "play-dialogue") {
    speechSynthesis.cancel();
    content.get(location.hash.split("/")[2])?.dialogue?.lines.forEach((l) => speak(l.en, { queue: true }));
  } else if (act === "cards-due") {
    const box = document.createElement("div");
    main.replaceChildren(box);
    runCards(box, dueCards(unlockedVocab()).slice(0, 30), {
      title: "Günlük tekrar", direction: t.dataset.dir, onExit: () => viewCards(),
    });
  } else if (act === "del-error") {
    store.update((s) => (s.errors = s.errors.filter((x) => String(x.id) !== t.dataset.id)));
    viewErrors();
  } else if (act === "test-voice") {
    speak("Hello! Nice to meet you. What time is it? It's half past seven.");
  } else if (act === "export") {
    const blob = new Blob([store.export()], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob), download: `english-coach-yedek-${today()}.json`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (act === "reset") {
    if (confirm("Tüm ilerleme (tamamlanan dersler, quiz sonuçları, kartlar, hata defteri) silinecek. Emin misin?")) {
      store.reset();
      route();
    }
  }
});

document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.dataset.act === "toggle-done") {
    store.update((s) => (t.checked ? (s.completed[t.dataset.id] = today()) : delete s.completed[t.dataset.id]));
  } else if (t.dataset.act === "import" && t.files[0]) {
    try {
      store.import(await t.files[0].text());
      alert("Yedek yüklendi.");
      route();
    } catch (err) {
      alert(`Yüklenemedi: ${err.message}`);
    }
  } else if (t.form?.dataset.form === "settings") {
    const f = new FormData(t.form);
    store.update((s) => Object.assign(s.settings, {
      role: f.get("role"),
      ...(ttsSupported ? { accent: f.get("accent"), rate: Number(f.get("rate")), autoSpeak: f.get("autoSpeak") === "on" } : {}),
    }));
  }
});

document.addEventListener("submit", (e) => {
  if (e.target.dataset.form !== "error") return;
  e.preventDefault();
  const f = new FormData(e.target);
  store.update((s) => s.errors.unshift({
    id: Date.now(), date: today(),
    wrong: f.get("wrong").trim(), correct: f.get("correct").trim(), note: f.get("note").trim(),
  }));
  viewErrors();
});

// ------------------------------------------------------------------ başlat

window.addEventListener("hashchange", route);

loadData()
  .then(route)
  .catch((err) => {
    console.error(err);
    main.innerHTML = `<section class="panel"><h2>Veri yüklenemedi</h2>
      <p>Uygulamayı bir web sunucusu üzerinden açtığından emin ol (README'ye bak).</p>
      <pre class="small">${esc(err.message)}</pre></section>`;
  });

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW kaydı başarısız:", e));
}
