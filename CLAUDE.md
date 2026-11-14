# English Coach — Proje Rehberi

Başlangıç seviyesindeki bir öğrenci için günlük hayat odaklı İngilizce programı ve PWA.
Öğretmen (repo sahibi) ve öğrenci uzaktan, **Salı–Cuma, 60 dk** birlikte çalışır.
A1 dönemi **17 Kasım 2026**'da başlar ve 13 hafta (52 seans) sürer. Ardından A2 ve üstü
aynı formatta eklenecek.

Canlı uygulama: https://zekeriyasarii.github.io/english-tutor/ (öğrenci bu linki kullanıyor)

## Yapı

```
config.yaml                 Başlangıç tarihi, çalışma günleri, seviyeler, tatiller
curriculum/<level>.yaml     Seviye müfredatı: haftalar → 4 seans (title, type, focus)
content/<level>/<id>.yaml   Seans içeriği (tek doğru kaynak) — format: docs/content-format.md
scripts/build_calendar.py   config + müfredat → output/takvim.md, sessions.json
scripts/build_content.py    İçeriği doğrular → ders notları (md), Anki (tsv), content.json
scripts/make_icons.py       app/icons PNG'lerini üretir (bağımlılıksız)
app/                        PWA — build adımı yok, sade ES modülleri
tests/                      Headless Chrome (CDP) ile uçtan uca testler
.github/workflows/pages.yml main'e push → doğrula, derle, GitHub Pages'e yayınla
```

`output/` ve `app/data/` üretilir, git'e girmez.

## Komutlar

```bash
python3 scripts/build_calendar.py && python3 scripts/build_content.py   # derle (app/data dahil)
python3 scripts/build_content.py --check                                 # sadece doğrula
python3 -m http.server 8765 -d app                                       # yerel: http://localhost:8765
node tests/quiz.e2e.mjs                    # tüm quizleri doğru/yanlış cevaplarla çözer (sunucu açık olmalı)
BASE=https://zekeriyasarii.github.io/english-tutor/ node tests/quiz.e2e.mjs   # canlı site
```

Bağımlılık: Python 3 + PyYAML (`requirements.txt`). Testler için Node 22+ ve `google-chrome`.

## İçerik yazma kuralları

Yeni seans eklerken mevcut dosyaları (ör. `content/a1/a1-w04-s3.yaml`) örnek al.

- **Kimlik:** `id` = `<level>-wNN-sN`, dosya adı ile aynı; `title`/`type` müfredatla birebir aynı olmalı
  (doğrulayıcı kontrol eder). Mevcut id'leri değiştirme, çünkü öğrencinin ilerlemesi bu id'lere bağlı.
- **plan** toplamı tam **60 dk** olmalı.
- **Dil:** Açıklamalar Türkçe, örnekler İngilizce + Türkçe çeviri. Öğrenci başlangıç seviyesinde,
  bu yüzden sade anlat.
- **Türkçe konuşanların hataları:** her konuda `⚠️` ile vurgula (he/she, a/an, at/on/in,
  3. tekil -s, "I have 30 years" vb.). Müfredattaki `pitfalls` alanı buna rehber.
- **Sıralama:** Henüz öğretilmemiş dilbilgisi sadece **kalıp** olarak geçebilir ("What do you do?"
  gibi). Bunu `tutor_notes` içinde belirt.
- **Ritim:** s1–s2 yeni konu, s3 uygulama/rol yapma, s4 tekrar + quiz. Ay sonu review'ları
  (4, 8, 12. haftalar) önceki haftaları da kapsar.
- **Quiz:** 8–14 soru, türleri karıştır. `translate` ve `fill` sorularında makul tüm doğru
  varyantları `answer` listesine ekle (kısaltmalı/kısaltmasız, mum/mom gibi).
  Karşılaştırma büyük/küçük harf ve noktalamayı yok sayar.
- **Kelimeler:** seans başına ~15–25. Aynı kelime önceki bir seansta varsa tekrar ekleme
  (Anki'de ilk geçtiği yer sayılır).
- İngiliz İngilizcesi esas. Amerikan farkını `note` ile belirt (colour/color, flat/apartment).

İçerik ekledikten sonra: `build_content.py` (doğrulama) → `tests/quiz.e2e.mjs` → commit → push.

## Uygulama (app/) kuralları

- Framework yok, build yok, harici CDN yok: uygulama çevrimdışı çalışmalı.
- Tüm yollar **göreli** olmalı (site `/english-tutor/` alt yolunda yayınlanıyor).
- Yeni bir JS veya CSS dosyası eklenirse `app/sw.js` içindeki `SHELL` listesine de ekle.
  Önbellek yapısı değişirse `CACHE` sürümünü artır.
- İlerleme verisi `localStorage` içinde (`english-coach.v1`), cihaza özel. Şemayı değiştirirken
  eski veriyi bozma: `store.js` içindeki `merge` varsayılanları doldurur.
- Modüller: `app.js` (router + ekranlar), `quiz.js`, `cards.js` (Leitner: 1/2/4/8/16 gün),
  `md.js` (içerikte kullanılan Markdown alt kümesi), `speech.js` (tarayıcı TTS), `store.js`, `util.js`.
- Mobil öncelikli (390 px genişlikte test et), açık ve koyu tema.
- Arayüz metinleri Türkçe.

## Git / yayın

- `main`'e push otomatik yayın yapar. Doğrulama hatası olursa yayın durur.
- Repo herkese açık. Commit e-postası GitHub `noreply` adresi (repo-yerel git config).
  Gerçek e-posta veya kişisel bilgi commit'lere ya da dosyalara girmesin.

## Yol haritası

- [x] A1 müfredatı ve takvimi (52 seans)
- [x] 1–4. haftaların içeriği (16 seans)
- [x] PWA v1: dersler, quiz, kartlar, hata defteri, öğretmen modu, çevrimdışı, Pages yayını
- [x] 5–8. haftaların içeriği (ay 2: günlük rutin, Present Simple, boş zaman, ev ve şehir)
- [ ] 9–13. haftaların içeriği ve A1 final sınavı (`type: exam` seansları)
- [ ] Öğrenci geri bildirimine göre uygulama düzeltmeleri
- [ ] v2: cihazlar arası ilerleme senkronizasyonu (öğretmen öğrencinin ilerlemesini görsün);
      şimdilik Ayarlar → dışa/içe aktar ile yapılıyor
- [ ] A2 müfredatı (`curriculum/a2.yaml`, `levels: [a1, a2]`)
- [ ] Actions sürümlerini güncelle (Node 20 uyarısı)
