#!/usr/bin/env python3
"""config.yaml + curriculum/<level>.yaml dosyalarından tarihli takvim üretir.

Çıktılar:
  output/takvim.md      — okunabilir takvim
  output/sessions.json  — tarihli seans listesi (PWA bu dosyayı kullanacak)

Kullanım:
  python3 scripts/build_calendar.py
"""
from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DAY_NAMES_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz",
             "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
TYPE_LABELS = {"new": "Yeni konu", "practice": "Uygulama", "review": "Tekrar + quiz", "exam": "Sınav"}
SESSION_TYPES = set(TYPE_LABELS)


def fmt_date(d: date) -> str:
    return f"{d.day} {MONTHS_TR[d.month - 1]} {d.year}, {DAY_NAMES_TR[d.weekday()]}"


def load_yaml(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def validate_level(data: dict, path: Path) -> None:
    errors = []
    for w in data.get("weeks", []):
        for i, s in enumerate(w.get("sessions", []), 1):
            if s.get("type") not in SESSION_TYPES:
                errors.append(f"hafta {w.get('week')} seans {i}: geçersiz type {s.get('type')!r}")
            if not s.get("title"):
                errors.append(f"hafta {w.get('week')} seans {i}: title eksik")
    if errors:
        sys.exit(f"{path}:\n  " + "\n  ".join(errors))


def study_dates(start: date, study_days: set[int], holidays: dict[date, str]):
    """Çalışma günlerini sırayla üretir; tatilleri atlar ve kaydını tutar."""
    d = start
    while True:
        if d.isoweekday() in study_days:
            if d in holidays:
                yield d, None  # tatil: ders kayar
            else:
                yield d, True
        d += timedelta(days=1)


def main() -> None:
    cfg = load_yaml(ROOT / "config.yaml")
    start: date = cfg["start_date"]
    study_days = set(cfg["study_days"])
    holidays = {h["date"]: h["name"] for h in cfg.get("holidays") or []}

    if start.isoweekday() not in study_days:
        sys.exit(f"start_date ({start}) bir çalışma gününe denk gelmiyor.")

    dates = study_dates(start, study_days, holidays)
    sessions = []
    skipped = []
    md = ["# Çalışma Takvimi", "",
          f"Başlangıç: **{fmt_date(start)}** · "
          f"Günler: {', '.join(DAY_NAMES_TR[d - 1] for d in sorted(study_days))} · "
          f"Seans: {cfg.get('session_minutes', 60)} dk", ""]

    for level in cfg["levels"]:
        path = ROOT / "curriculum" / f"{level}.yaml"
        data = load_yaml(path)
        validate_level(data, path)
        md += [f"## {data['title']}", ""]

        for w in data["weeks"]:
            md += [f"### Hafta {w['week']} — {w['theme']}", ""]
            md += ["**Hedefler:** " + "; ".join(w.get("can_do", [])), ""]
            md += ["| Tarih | Tür | Seans | İçerik |", "|---|---|---|---|"]
            for idx, s in enumerate(w["sessions"], 1):
                d, ok = next(dates)
                while ok is None:
                    skipped.append((d, holidays[d]))
                    d, ok = next(dates)
                sid = f"{level}-w{w['week']:02d}-s{idx}"
                sessions.append({
                    "id": sid,
                    "level": level,
                    "week": w["week"],
                    "session": idx,
                    "date": d.isoformat(),
                    "type": s["type"],
                    "title": s["title"],
                    "focus": s.get("focus", ""),
                    "theme": w["theme"],
                })
                md.append(f"| {fmt_date(d)} | {TYPE_LABELS[s['type']]} | {s['title']} | {s.get('focus', '')} |")
            md.append("")

    if skipped:
        md += ["## Tatil nedeniyle atlanan günler", ""]
        md += [f"- {fmt_date(d)} — {name}" for d, name in skipped]
        md.append("")

    last = date.fromisoformat(sessions[-1]["date"])
    md.insert(4, f"Bitiş: **{fmt_date(last)}** · Toplam {len(sessions)} seans")
    md.insert(5, "")

    out = ROOT / "output"
    out.mkdir(exist_ok=True)
    (out / "takvim.md").write_text("\n".join(md), encoding="utf-8")
    payload = json.dumps(sessions, ensure_ascii=False, indent=2)
    (out / "sessions.json").write_text(payload, encoding="utf-8")
    app_data = ROOT / "app" / "data"
    app_data.mkdir(parents=True, exist_ok=True)
    (app_data / "sessions.json").write_text(payload, encoding="utf-8")
    print(f"{len(sessions)} seans: {sessions[0]['date']} → {sessions[-1]['date']}")
    print(f"Atlanan tatil günü: {len(skipped)}")
    print(f"Yazıldı: {out / 'takvim.md'}, {out / 'sessions.json'}")


if __name__ == "__main__":
    main()
