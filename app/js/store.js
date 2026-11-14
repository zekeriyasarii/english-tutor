// İlerleme verisi: tarayıcının localStorage'ında, bu cihaza özel.
// Yedekleme / cihazlar arası taşıma için Ayarlar'daki dışa/içe aktarma kullanılır.

const KEY = "english-coach.v1";

const empty = () => ({
  completed: {},   // { sessionId: "2026-11-17" }
  quizzes: {},     // { sessionId: [{ date, score, total }] }
  cards: {},       // { "hello": { box: 1-5, due: "2026-11-18" } }
  errors: [],      // [{ id, date, wrong, correct, note }]
  settings: { role: "student", accent: "en-GB", rate: 0.9 },
});

function merge(obj) {
  const base = empty();
  return { ...base, ...obj, settings: { ...base.settings, ...(obj?.settings || {}) } };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(JSON.parse(raw));
  } catch { /* gizli sekme, engellenmiş depolama vb. */ }
  return empty();
}

let state = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* depolama yoksa uygulama yine çalışır, sadece kalıcı olmaz */ }
}

export const store = {
  get: () => state,
  update(fn) {
    fn(state);
    save();
  },
  replace(obj) {
    state = merge(obj);
    save();
  },
  reset() {
    state = empty();
    save();
  },
  export() {
    return JSON.stringify({ app: "english-coach", version: 1, exportedAt: new Date().toISOString(), data: state }, null, 2);
  },
  import(text) {
    const parsed = JSON.parse(text);
    const data = parsed?.app === "english-coach" ? parsed.data : null;
    if (!data || typeof data !== "object") throw new Error("Bu dosya bir yedek dosyası değil.");
    this.replace(data);
  },
};
