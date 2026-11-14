# İngilizce Çalışma Planı

Günlük hayat odaklı, Salı–Cuma 60 dakikalık uzaktan seanslarla ilerleyen İngilizce programı.

## Yapı

```
config.yaml              Başlangıç tarihi, çalışma günleri, seviyeler, tatiller
curriculum/a1.yaml       A1 müfredatı (13 hafta × 4 seans) — tek doğru kaynak
content/a1/<id>.yaml     Seans içerikleri: ders notu, diyalog, kelimeler, quiz, ödev
docs/content-format.md   İçerik formatının tanımı
scripts/build_calendar.py  Müfredat + config → tarihli takvim
scripts/build_content.py   İçerikleri doğrular → ders notları, Anki, JSON

app/                     PWA (English Coach) — build adımı yok, sade JS modülleri
  data/                  content.json + sessions.json (script'ler buraya kopyalar)
scripts/make_icons.py    Uygulama ikonlarını PNG olarak üretir

output/  (üretilir, elle düzenlenmez)
  takvim.md              Okunabilir takvim
  sessions.json          Tarihli seans listesi (PWA)
  lessons/<id>.md        Öğrenci ders notu (quiz + cevap anahtarı)
  lessons/<id>.tutor.md  Öğretmen notu (dakika dakika akış, ipuçları)
  anki/a1.tsv            Anki kelime kartları (File → Import)
  content.json           Tüm içerik (PWA)
```

## Kullanım

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python3 scripts/build_calendar.py
python3 scripts/build_content.py          # --check: sadece doğrula
```

- Tarihi veya günleri değiştirmek için `config.yaml`'ı düzenleyip script'i tekrar çalıştırın.
- Tatile denk gelen ders atlanmaz, bir sonraki çalışma gününe kayar.
- A1 bitince `curriculum/a2.yaml` eklenir ve `levels: [a1, a2]` yapılır; takvim kaldığı yerden devam eder.

## Haftalık ritim

| Seans | Tür | İçerik |
|---|---|---|
| Salı | Yeni konu | Kalıp cümleler + dilbilgisi |
| Çarşamba | Yeni konu | Devamı, yeni kelime ve yapılar |
| Perşembe | Uygulama | Diyalog, rol yapma, dinleme |
| Cuma | Tekrar | Mini quiz + hata defteri |

## Seans akışı (60 dk)

5 dk ısınma → 10 dk tekrar → 20 dk yeni konu → 15 dk uygulama → 10 dk quiz/hatalar/ödev

## Uygulama (PWA)

```bash
python3 scripts/build_calendar.py && python3 scripts/build_content.py   # veriyi app/data'ya yazar
python3 -m http.server 8765 -d app                                        # http://localhost:8765
```

- **Ekranlar:** Bugün (sıradaki ders, istatistikler) · Plan · Ders (notlar, kelimeler, quiz,
  öğretmen sekmesi) · Kelime kartları (Leitner aralıklı tekrar) · Hata defteri · Ayarlar
- **Öğretmen modu:** Ayarlar → "Öğretmen". Derslerde seans akışı, ipuçları ve quiz cevapları görünür.
- **Seslendirme:** Tarayıcının yerleşik sesi kullanılır (en-GB / en-US). Kalite cihaza göre değişir.
- **Veri:** İlerleme tarayıcıda (localStorage), cihaza özel. Ayarlar → Dışa/İçe aktar ile yedeklenir.
- **Çevrimdışı:** Service worker uygulamayı önbelleğe alır. Kod değişince sayfayı iki kez yenile
  (ilk yenilemede arka planda güncellenir). İçerik (`data/`) her açılışta ağdan tazelenir.
- **Telefona kurulum:** Uygulama HTTPS üzerinden yayınlandığında tarayıcı menüsünden "Ana ekrana ekle".

## Yayın

`main` dalına her push'ta GitHub Actions ([.github/workflows/pages.yml](.github/workflows/pages.yml))
içerikleri doğrular, veriyi derler ve `app/` klasörünü GitHub Pages'e yükler.
Doğrulama hatası olursa yayın yapılmaz, canlı sürüm bozulmaz.

Canlı adres: https://zekeriyasarii.github.io/english-tutor/
