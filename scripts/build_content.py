#!/usr/bin/env python3
"""content/<level>/*.yaml dosyalarını doğrular ve çıktıları üretir.

Çıktılar:
  output/lessons/<id>.md        — öğrenci ders notu (quiz + en sonda cevap anahtarı)
  output/lessons/<id>.tutor.md  — öğretmen notu (seans akışı, ipuçları, cevaplar)
  output/anki/<level>.tsv       — Anki'ye aktarılabilir kelime kartları
  output/content.json           — tüm seans içerikleri (PWA bu dosyayı kullanacak)

Kullanım:
  python3 scripts/build_content.py            # doğrula + üret
  python3 scripts/build_content.py --check    # sadece doğrula
"""
from __future__ import annotations

import json
import random
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
QUIZ_TYPES = {"mcq", "fill", "match", "order", "translate"}
REQUIRED = ["id", "level", "week", "session", "title", "type", "objectives", "plan"]
ID_RE = re.compile(r"^(?P<level>[a-c][12])-w(?P<week>\d{2})-s(?P<session>\d)$")


# --------------------------------------------------------------------------- load

def load_yaml(path: Path):
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def curriculum_index(levels: list[str]) -> dict[str, dict]:
    idx = {}
    for level in levels:
        data = load_yaml(ROOT / "curriculum" / f"{level}.yaml")
        for w in data["weeks"]:
            for i, s in enumerate(w["sessions"], 1):
                idx[f"{level}-w{w['week']:02d}-s{i}"] = {**s, "theme": w["theme"]}
    return idx


# ----------------------------------------------------------------------- validate

def validate(doc: dict, path: Path, curriculum: dict[str, dict]) -> list[str]:
    errs: list[str] = []
    e = errs.append

    for key in REQUIRED:
        if key not in doc:
            e(f"zorunlu alan eksik: {key}")
    if errs:
        return errs

    sid = doc["id"]
    m = ID_RE.match(sid)
    if path.stem != sid:
        e(f"dosya adı ({path.stem}) id ile aynı olmalı ({sid})")
    if not m:
        e(f"id formatı hatalı: {sid}")
    elif (m["level"], int(m["week"]), int(m["session"])) != (doc["level"], doc["week"], doc["session"]):
        e("id ile level/week/session alanları tutarsız")

    cur = curriculum.get(sid)
    if cur is None:
        e(f"{sid} müfredatta yok")
    else:
        if cur["title"] != doc["title"]:
            e(f"başlık müfredattan farklı: {doc['title']!r} != {cur['title']!r}")
        if cur["type"] != doc["type"]:
            e(f"tür müfredattan farklı: {doc['type']!r} != {cur['type']!r}")

    total = sum(p.get("minutes", 0) for p in doc["plan"])
    if total != 60:
        e(f"plan toplamı 60 dk değil: {total}")

    for v in doc.get("vocabulary", []):
        if not v.get("en") or not v.get("tr"):
            e(f"kelimede en/tr eksik: {v}")

    for n, q in enumerate(doc.get("quiz", []), 1):
        t = q.get("type")
        where = f"quiz {n} ({t})"
        if t not in QUIZ_TYPES:
            e(f"{where}: bilinmeyen tür")
            continue
        if t == "mcq":
            if q.get("answer") not in (q.get("options") or []):
                e(f"{where}: answer seçenekler arasında değil")
            if len(set(q.get("options") or [])) != len(q.get("options") or []):
                e(f"{where}: tekrarlanan seçenek")
        elif t == "fill":
            if "___" not in q.get("prompt", ""):
                e(f"{where}: prompt içinde ___ yok")
            if not isinstance(q.get("answer"), list) or not q["answer"]:
                e(f"{where}: answer boş olmayan liste olmalı")
        elif t == "match":
            pairs = q.get("pairs") or []
            if len(pairs) < 2 or any(len(p) != 2 for p in pairs):
                e(f"{where}: pairs en az 2 adet [sol, sağ] çifti olmalı")
        elif t == "order":
            words, ans = q.get("words") or [], q.get("answer", "")
            if sorted(w.lower() for w in words) != sorted(tokens(ans)):
                e(f"{where}: words ile answer'daki kelimeler aynı değil")
        elif t == "translate":
            if not q.get("prompt") or not isinstance(q.get("answer"), list) or not q["answer"]:
                e(f"{where}: prompt ve answer listesi gerekli")
    return errs


def tokens(sentence: str) -> list[str]:
    """Cümleyi kelimelere ayırır; sondaki noktalamayı atar (order sorusu kontrolü için)."""
    return [w.lower() for w in sentence.rstrip(".?!").split()]


# ------------------------------------------------------------------------ render

def md_escape_cell(s: str) -> str:
    return str(s).replace("|", "\\|")


def render_examples(ex: list[dict]) -> list[str]:
    if not ex:
        return []
    out = ["| İngilizce | Türkçe |", "|---|---|"]
    out += [f"| {md_escape_cell(x['en'])} | {md_escape_cell(x['tr'])} |" for x in ex]
    return out + [""]


def shuffled(items: list, seed: str) -> list:
    rnd = random.Random(seed)
    items = list(items)
    rnd.shuffle(items)
    return items


def render_quiz(doc: dict) -> tuple[list[str], list[str]]:
    """(sorular, cevap anahtarı) satırlarını döndürür."""
    qs, keys = [], []
    letters = "abcdefghij"
    for n, q in enumerate(doc.get("quiz", []), 1):
        t = q["type"]
        if t == "mcq":
            opts = shuffled(q["options"], f"{doc['id']}-{n}")
            qs.append(f"**{n}.** {q['prompt']}")
            qs += [f"   - {letters[i]}) {o}" for i, o in enumerate(opts)]
            keys.append(f"{n}. {letters[opts.index(q['answer'])]}) {q['answer']}")
        elif t == "fill":
            qs.append(f"**{n}.** Boşluğu doldur: {q['prompt']}")
            keys.append(f"{n}. {' / '.join(q['answer'])}")
        elif t == "match":
            left = [p[0] for p in q["pairs"]]
            right = shuffled([p[1] for p in q["pairs"]], f"{doc['id']}-{n}")
            qs.append(f"**{n}.** {q.get('prompt', 'Eşleştir')}")
            qs += ["", "   | | | | |", "   |---|---|---|---|"]
            for i, (l, r) in enumerate(zip(left, right)):
                qs.append(f"   | {i + 1}. {md_escape_cell(l)} | | {letters[i]}) {md_escape_cell(r)} | |")
            pairs = {p[0]: p[1] for p in q["pairs"]}
            keys.append(f"{n}. " + ", ".join(
                f"{i + 1}-{letters[right.index(pairs[l])]}" for i, l in enumerate(left)))
        elif t == "order":
            words = shuffled(q["words"], f"{doc['id']}-{n}")
            qs.append(f"**{n}.** Kelimeleri sırala: " + " / ".join(f"`{w}`" for w in words))
            keys.append(f"{n}. {q['answer']}")
        elif t == "translate":
            qs.append(f"**{n}.** İngilizceye çevir: *{q['prompt']}*")
            keys.append(f"{n}. {q['answer'][0]}")
        if q.get("explanation"):
            keys[-1] += f" — {q['explanation']}"
        qs.append("")
    return qs, keys


def render_student(doc: dict, theme: str) -> str:
    L = [f"# {doc['title']}", "",
         f"*{doc['level'].upper()} · Hafta {doc['week']} · Seans {doc['session']} — {theme}*", "",
         "## Bu derste", ""]
    L += [f"- {o}" for o in doc["objectives"]] + [""]

    for s in doc.get("sections", []):
        L += [f"## {s['heading']}", "", s.get("body", "").rstrip(), ""]
        L += render_examples(s.get("examples", []))

    if d := doc.get("dialogue"):
        L += [f"## Diyalog: {d['title']}", "", "| | İngilizce | Türkçe |", "|---|---|---|"]
        L += [f"| **{l['speaker']}** | {md_escape_cell(l['en'])} | {md_escape_cell(l['tr'])} |"
              for l in d["lines"]]
        L.append("")

    if vocab := doc.get("vocabulary"):
        L += ["## Kelimeler", "", "| İngilizce | Türkçe | Örnek / Not |", "|---|---|---|"]
        for v in vocab:
            extra = []
            if v.get("example"):
                extra.append(f"*{v['example']}* ({v.get('example_tr', '')})".replace(" ()", ""))
            if v.get("note"):
                extra.append(v["note"])
            L.append(f"| **{md_escape_cell(v['en'])}** | {md_escape_cell(v['tr'])} | "
                     f"{md_escape_cell(' — '.join(extra))} |")
        L.append("")

    if practice := doc.get("practice"):
        L += ["## Alıştırmalar", ""]
        for p in practice:
            L += [f"### {p['title']}", "", p["instructions"], ""]
            L += [f"- {i}" for i in p.get("items", [])]
            L.append("")

    qs, keys = render_quiz(doc)
    if qs:
        L += ["## Quiz", ""] + qs

    if hw := doc.get("homework"):
        L += ["## Ödev", ""] + [f"- [ ] {h}" for h in hw] + [""]

    if keys:
        L += ["---", "", "<details><summary>Cevap anahtarı</summary>", ""]
        L += [f"- {k}" for k in keys] + ["", "</details>", ""]
    return "\n".join(L)


def render_tutor(doc: dict, theme: str) -> str:
    L = [f"# Öğretmen notu — {doc['title']}", "",
         f"*{doc['id']} · {theme}*", "", "## Seans akışı (60 dk)", "",
         "| Dk | Etkinlik |", "|---|---|"]
    t = 0
    for p in doc["plan"]:
        L.append(f"| {t}-{t + p['minutes']} | {md_escape_cell(p['activity'])} |")
        t += p["minutes"]
    L.append("")
    if notes := doc.get("tutor_notes"):
        L += ["## İpuçları", ""] + [f"- {n}" for n in notes] + [""]
    _, keys = render_quiz(doc)
    if keys:
        L += ["## Quiz cevapları", ""] + [f"- {k}" for k in keys] + [""]
    L += [f"Öğrenci notu: [{doc['id']}.md]({doc['id']}.md)", ""]
    return "\n".join(L)


def render_anki(docs: list[dict]) -> str:
    """Tab ayrımlı, Anki'nin dosya başlığı yönergeleriyle."""
    lines = ["#separator:tab", "#html:true", "#columns:English\tTürkçe\tÖrnek\tTags", "#tags column:4"]
    seen = set()
    for doc in docs:
        tag = f"{doc['level']} {doc['level']}-w{doc['week']:02d}"
        for v in doc.get("vocabulary", []):
            key = v["en"].lower()
            if key in seen:
                continue
            seen.add(key)
            ex = ""
            if v.get("example"):
                ex = f"{v['example']}<br><i>{v.get('example_tr', '')}</i>"
            elif v.get("note"):
                ex = f"<i>{v['note']}</i>"
            clean = lambda s: str(s).replace("\t", " ").replace("\n", " ")
            lines.append("\t".join([clean(v["en"]), clean(v["tr"]), clean(ex), tag]))
    return "\n".join(lines) + "\n"


# -------------------------------------------------------------------------- main

def main() -> None:
    check_only = "--check" in sys.argv
    cfg = load_yaml(ROOT / "config.yaml")
    levels = cfg["levels"]
    curriculum = curriculum_index(levels)

    docs, failed = [], False
    for level in levels:
        for path in sorted((ROOT / "content" / level).glob("*.yaml")):
            doc = load_yaml(path)
            errs = validate(doc, path, curriculum)
            if errs:
                failed = True
                print(f"✗ {path.relative_to(ROOT)}")
                for err in errs:
                    print(f"    - {err}")
            else:
                docs.append(doc)

    print(f"{len(docs)} seans geçerli · içerik hazır: {len(docs)}/{len(curriculum)} seans")
    if failed:
        sys.exit(1)
    if check_only:
        return

    out = ROOT / "output"
    (out / "lessons").mkdir(parents=True, exist_ok=True)
    (out / "anki").mkdir(parents=True, exist_ok=True)

    for doc in docs:
        theme = curriculum[doc["id"]]["theme"]
        (out / "lessons" / f"{doc['id']}.md").write_text(render_student(doc, theme), encoding="utf-8")
        (out / "lessons" / f"{doc['id']}.tutor.md").write_text(render_tutor(doc, theme), encoding="utf-8")

    for level in levels:
        level_docs = [d for d in docs if d["level"] == level]
        if level_docs:
            (out / "anki" / f"{level}.tsv").write_text(render_anki(level_docs), encoding="utf-8")

    payload = json.dumps(docs, ensure_ascii=False, indent=2)
    (out / "content.json").write_text(payload, encoding="utf-8")
    app_data = ROOT / "app" / "data"
    app_data.mkdir(parents=True, exist_ok=True)
    (app_data / "content.json").write_text(payload, encoding="utf-8")
    vocab_total = sum(len(d.get("vocabulary", [])) for d in docs)
    quiz_total = sum(len(d.get("quiz", [])) for d in docs)
    print(f"Üretildi: {len(docs)} ders notu (+ öğretmen notu), {vocab_total} kelime, {quiz_total} quiz sorusu")
    print(f"  {out / 'lessons'}/\n  {out / 'anki'}/\n  {out / 'content.json'}")


if __name__ == "__main__":
    main()
