#!/usr/bin/env python3
"""
ŻPA Żyrardów - Scraper v3 PDF

Pobiera oficjalne PDFy z rozkładami (zpa.powiat-zyrardowski.pl, pksgostynin.pl),
parsuje tabele i zapisuje do timetables.json RZECZYWISTE godziny na każdym
przystanku (direction.stopsTimes) wraz z oznaczeniami dni kursowania.
Godziny w aplikacji pochodzą więc wprost z PDFów – bez przybliżenia
„godzina startu + 2 min na przystanek”.

Wymagania: pip install -r scraper/requirements.txt
Uruchomienie: python scraper/scraper.py
Output: ../timetables.json + scraper/audits/pdf_times_report.json
"""

import hashlib
import json
import re
import sys
import time
import warnings
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from urllib3.exceptions import InsecureRequestWarning

sys.path.insert(0, str(Path(__file__).resolve().parent))

from pdf_timetables import (  # noqa: E402
    anchor_valid_until,
    apply_pdf_times,
    line_number_from_anchor,
    parse_date_pl,
    parse_pdf,
    summarize_report,
)

warnings.filterwarnings("ignore", category=InsecureRequestWarning)

try:
    import pdfplumber  # noqa: F401
    HAS_PDF = True
except ImportError:
    HAS_PDF = False
    print("⚠️  brak pdfplumber – parser PDF wyłączony (pip install -r scraper/requirements.txt)")

HEADERS = {"User-Agent": "Mozilla/5.0 (ZPA Scraper Bot) Chrome/124"}

SOURCES = [
    "https://zpa.powiat-zyrardowski.pl/75,rozklady",
    "http://pksgostynin.pl/zyrardowskie-przewozy-autobusowe/",
]

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = Path(__file__).resolve().parent / "cache"
AUDIT_DIR = Path(__file__).resolve().parent / "audits"


def fetch_pdf_list():
    pdfs = []
    for url in SOURCES:
        try:
            print(f"📄 Pobieram listę z {url}")
            r = requests.get(url, headers=HEADERS, timeout=15, verify=False)
            soup = BeautifulSoup(r.text, "html.parser")
            for a in soup.select('a[href$=".pdf"]'):
                href = a.get("href")
                if not href:
                    continue
                if not href.startswith("http"):
                    href = urljoin(url, href)
                text = a.get_text(strip=True)
                if line_number_from_anchor(text):
                    pdfs.append({"text": text, "href": href, "source": url})
        except Exception as e:
            print(f"❌ Błąd pobierania {url}: {e}")
    uniq = {p["href"]: p for p in pdfs}
    return list(uniq.values())


def download_pdf(href, timeout=30):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    digest = hashlib.md5(href.encode("utf-8")).hexdigest()
    path = CACHE_DIR / f"{digest}.pdf"
    if path.exists() and path.stat().st_size > 0:
        return path
    r = requests.get(href, headers=HEADERS, timeout=timeout, verify=False)
    r.raise_for_status()
    path.write_bytes(r.content)
    return path


def collect_parsed_pdfs(pdf_items, today):
    """Pobiera i parsuje PDFy; pomija te przestarzałe („ważny do …” z przeszłości)."""
    parsed = []
    for item in pdf_items:
        line_no = line_number_from_anchor(item["text"])
        if not line_no:
            continue
        valid_until = anchor_valid_until(item["text"])
        if valid_until and valid_until < today:
            print(f"⏭️  Pomijam przestarzały PDF (ważny do {valid_until.isoformat()}): {item['text'][:60]}")
            continue
        try:
            path = download_pdf(item["href"])
            result = parse_pdf(path)
        except Exception as e:
            print(f"❌ Nie udało się sparsować {item['href']}: {e}")
            continue
        tables = result["tables"]
        print(
            f"📄 {item['text'][:60]} – tabel: {len(tables)}, ważny od: "
            f"{result['validFrom'].isoformat() if result['validFrom'] else '?'}"
        )
        if not tables:
            continue
        parsed.append({
            "line_no": line_no,
            "href": item["href"],
            "anchor": item["text"],
            "validFrom": result["validFrom"],
            "legend": result["legend"],
            "tables": tables,
        })
    return parsed


def build_timetables_from_pdfs(pdf_items, output_path):
    base_path = Path(output_path)
    if base_path.exists():
        with open(base_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {"meta": {}, "lines": []}

    today = date.today()
    parsed_pdfs = []
    report = {"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "directions": [], "warnings": []}

    if HAS_PDF and pdf_items:
        parsed_pdfs = collect_parsed_pdfs(pdf_items, today)
        print(f"🧩 Sparsowano {len(parsed_pdfs)} PDFów z tabelami kursów")
        report = apply_pdf_times(data, parsed_pdfs, today=today)
        print(summarize_report(report))
    else:
        report["warnings"].append("brak pdfplumber lub brak PDFów – godziny pozostają bez zmian")

    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    audit_path = AUDIT_DIR / "pdf_times_report.json"
    with open(audit_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=str)

    data["meta"] = {
        "version": time.strftime("%Y-%m-%d"),
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": ", ".join(SOURCES),
        "pdfsFound": len(pdf_items),
        "pdfsParsed": len(parsed_pdfs),
        "timesSource": "pdf",
        "timesNote": "Godziny odjazdów i przyjazdów na każdym przystanku pochodzą wprost z tabel oficjalnych PDF-ów (direction.stopsTimes).",
        "report": {
            "directionsTotal": len(report.get("directions", [])),
            "directionsFromPdf": sum(1 for d in report.get("directions", []) if d.get("status") == "ok"),
            "warnings": len(report.get("warnings", [])),
        },
        "pdfs": pdf_items[:30],
    }

    from apply_pdf_stop_corrections import apply as apply_pdf_stop_corrections
    data = apply_pdf_stop_corrections(data)

    serialized = json.dumps(data, ensure_ascii=False, indent=2)
    with open(output_path, "w", encoding="utf-8") as out:
        out.write(serialized)
    public_path = ROOT / "public" / "timetables.json"
    if public_path.parent.exists():
        public_path.write_text(serialized, encoding="utf-8")
        print(f"✅ Zapisano {output_path} i {public_path} ({len(pdf_items)} PDFów na liście, {len(parsed_pdfs)} sparsowanych)")
    else:
        print(f"✅ Zapisano {output_path} ({len(pdf_items)} PDFów na liście, {len(parsed_pdfs)} sparsowanych)")
    print(f"📝 Raport: {audit_path}")


def main():
    print("🚍 ŻPA Scraper v3 (godziny z PDFów) start")
    pdfs = fetch_pdf_list()
    print(f"🔍 Znaleziono {len(pdfs)} PDFów z rozkładami")
    for p in pdfs[:10]:
        print(f"  - {p['text'][:60]} -> {p['href']}")

    output = ROOT / "timetables.json"
    build_timetables_from_pdfs(pdfs, output)

    print("\n✨ Gotowe. Zatwierdź zmiany: git add timetables.json && git commit -m 'update timetable' && git push")


if __name__ == "__main__":
    main()
