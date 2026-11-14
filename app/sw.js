// Service worker — uygulamanın çevrimdışı çalışması için
// Uygulama dosyaları: önbellekten hemen sun, arka planda güncelle (stale-while-revalidate)
// data/*.json: önce ağ (yeni içerik hemen gelsin), ağ yoksa önbellek

const CACHE = "english-coach-v2";
const SHELL = [
  "./",
  "index.html",
  "css/styles.css",
  "js/app.js",
  "js/util.js",
  "js/store.js",
  "js/md.js",
  "js/speech.js",
  "js/quiz.js",
  "js/cards.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "data/content.json",
  "data/sessions.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;

  if (url.pathname.includes("/data/")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
