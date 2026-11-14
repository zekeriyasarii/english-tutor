# İçerik Formatı

Her seans `content/<level>/<id>.yaml` dosyasında tutulur. `id`, müfredattaki seansla eşleşir
(`a1-w01-s1` = A1, 1. hafta, 1. seans). Bu dosyalar tek doğru kaynaktır; ders notları,
Anki kartları ve PWA verisi bunlardan üretilir:

```bash
python3 scripts/build_content.py
```

## Alanlar

| Alan | Zorunlu | Açıklama |
|---|---|---|
| `id`, `level`, `week`, `session` | ✓ | Kimlik; dosya adı ve müfredatla tutarlı olmalı |
| `title`, `type` | ✓ | Müfredattaki başlık ve tür (`new`, `practice`, `review`, `exam`) |
| `objectives` | ✓ | Seans sonunda öğrencinin yapabilecekleri (Türkçe) |
| `plan` | ✓ | Öğretmen için dakika dakika seans akışı; toplam 60 dk olmalı |
| `sections` | | Ders notu bölümleri: `heading`, `body` (Markdown), `examples` (`en`/`tr`) |
| `dialogue` | | Örnek diyalog: `title`, `lines` (`speaker`, `en`, `tr`) |
| `vocabulary` | | Kelimeler: `en`, `tr`, isteğe bağlı `example`, `example_tr`, `note` |
| `practice` | | Seans içi etkinlikler: `title`, `instructions`, isteğe bağlı `items` |
| `quiz` | | Sorular (aşağıda) |
| `homework` | | Bir sonraki seansa kadar yapılacaklar |
| `tutor_notes` | | Sadece öğretmen için ipuçları (öğrenci notunda görünmez) |

## Quiz soru türleri

```yaml
- type: mcq                 # Çoktan seçmeli
  prompt: "..."
  options: ["a", "b", "c"]
  answer: "b"               # options içinden biri olmalı
  explanation: "..."        # isteğe bağlı, her türde kullanılabilir

- type: fill                # Boşluk doldurma; prompt içinde ___ olmalı
  prompt: "I ___ from Turkey."
  answer: ["am", "'m"]      # Kabul edilen cevaplar

- type: match               # Eşleştirme
  prompt: "..."
  pairs:
    - ["Good morning", "Günaydın"]

- type: order               # Kelimeleri sıraya koyma
  words: ["name", "my", "is", "Ali"]
  answer: "My name is Ali."

- type: translate           # Türkçeden İngilizceye çeviri
  prompt: "Benim adım Ali."
  answer: ["My name is Ali.", "I'm Ali.", "I am Ali."]
```

Cevaplar karşılaştırılırken büyük/küçük harf, baştaki/sondaki boşluk ve sondaki noktalama
yok sayılır (PWA da aynı kuralı uygulayacak).
