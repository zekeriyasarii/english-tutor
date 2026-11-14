// Kullanım: python3 -m http.server 8765 -d app &  →  node tests/quiz.e2e.mjs
// Canlı site için: BASE=https://zekeriyasarii.github.io/english-tutor/ node tests/quiz.e2e.mjs
// Tüm derslerin quizlerini doğru cevaplarla çöz → hepsi tam puan olmalı.
// Bir quizi de bilerek yanlış cevaplarla çöz → yanlışlar ve hata defteri akışı çalışmalı.
import { launch } from "./cdp.mjs";

const BASE = process.env.BASE || "http://localhost:8765/";
const b = await launch({ port: 9334 });
await b.goto(BASE);
await b.eval("localStorage.clear()");

// Sayfa içinde çalışan otomatik cevaplayıcı
const SOLVER = `
async (correct) => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const id = location.hash.split("/")[2];
  const doc = (await (await fetch("data/content.json")).json()).find(d => d.id === id);
  for (const q of doc.quiz) {
    await sleep(15);
    const root = document.querySelector(".quiz");
    if (q.type === "mcq") {
      const want = correct ? q.answer : q.options.find(o => o !== q.answer);
      [...root.querySelectorAll(".option")].find(b => b.dataset.val === want).click();
    } else if (q.type === "fill" || q.type === "translate") {
      const el = root.querySelector(".blank, .answer");
      el.value = correct ? q.answer[q.answer.length - 1] : "zzz wrong";
      root.querySelector('[data-q="check"]').click();
    } else if (q.type === "order") {
      const target = q.answer.replace(/[.?!]$/, "").split(" ");
      const words = correct ? target : [...target].reverse();
      for (const w of words) {
        const chip = [...root.querySelectorAll(".chips .chip")].find(c => c.textContent.toLowerCase() === w.toLowerCase());
        chip.click();
      }
      root.querySelector('[data-q="check"]').click();
    } else if (q.type === "match") {
      root.querySelectorAll("select").forEach((s) => {
        const [, r] = q.pairs[+s.dataset.k];
        s.value = correct ? r : [...s.options].map(o => o.value).find(v => v && v !== r);
      });
      root.querySelector('[data-q="check"]').click();
    }
    const fb = root.querySelector(".feedback");
    if (!fb.className.includes(correct ? "ok" : "bad")) return { id, failedAt: q, feedback: fb.textContent.trim().slice(0, 200) };
    root.querySelector('[data-q="next"]').click();
  }
  await sleep(20);
  return { id, summary: document.querySelector(".score-ring span")?.textContent, total: doc.quiz.length };
}`;

const ids = await b.eval(`fetch("data/content.json").then(r => r.json()).then(d => d.filter(x => x.quiz?.length).map(x => x.id))`);
let failures = 0;
for (const id of ids) {
  await b.goto(`${BASE}#/quiz/${id}`, 300);
  const r = await b.eval(`(${SOLVER})(true)`);
  const ok = r.summary === `${r.total}/${r.total}`;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${id} ${r.summary ?? ""}${r.failedAt ? ` FAILED: ${JSON.stringify(r.failedAt)} → ${r.feedback}` : ""}`);
}

// Yanlış cevaplar + hata defteri
await b.goto(`${BASE}#/quiz/a1-w02-s2`, 300);
const wrong = await b.eval(`(${SOLVER})(false)`);
console.log(`yanlış modu: ${wrong.summary} (beklenen 0/${wrong.total})${wrong.failedAt ? " FAILED " + JSON.stringify(wrong.failedAt) : ""}`);
const wrongItems = await b.eval(`document.querySelectorAll(".wrong-list li").length`);
await b.eval(`document.querySelector('[data-q="to-errors"]').click()`);
await b.goto(`${BASE}#/errors`, 300);
const errs = await b.eval(`document.querySelectorAll(".err").length`);
console.log(`yanlış listesi: ${wrongItems} madde, hata defteri: ${errs} kayıt`);

const stored = await b.eval(`JSON.parse(localStorage.getItem("english-coach.v1")).quizzes`);
console.log(`kaydedilen quiz sonucu: ${Object.values(stored).flat().length}`);
console.log(b.logs.length ? "KONSOL:\n" + b.logs.join("\n") : "konsol hatası yok");
console.log(failures ? `\n${failures} quiz başarısız` : "\nTüm quizler tam puan");
process.exitCode = failures || b.logs.length ? 1 : 0;
await b.close();
