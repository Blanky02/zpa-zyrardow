#!/usr/bin/env python3
"""
ŻPA Żyrardów - Scraper v2 AUTO
Pobiera PDFy z https://zpa.powiat-zyrardowski.pl/75,rozklady
i http://pksgostynin.pl/zyrardowskie-przewozy-autobusowe/
Parsuje tabele i generuje timetables.json zgodny z aplikacją SPA.

Wymagania: pip install requests beautifulsoup4 pdfplumber
Uruchomienie: python scraper.py
Output: ../timetables.json
"""

import re, json, hashlib, os, sys, time, warnings
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
from urllib3.exceptions import InsecureRequestWarning

# Suppress only the insecure request warning if verify=False is necessary
warnings.filterwarnings('ignore', category=InsecureRequestWarning)

try:
    import pdfplumber
    HAS_PDF = True
except ImportError:
    HAS_PDF = False
    print("⚠️  brak pdfplumber, parsowanie PDF wyłączone (tylko lista linków)")

HEADERS = {"User-Agent": "Mozilla/5.0 (ZPA Scraper Bot) Chrome/124"}

SOURCES = [
    "https://zpa.powiat-zyrardowski.pl/75,rozklady",
    "http://pksgostynin.pl/zyrardowskie-przewozy-autobusowe/"
]

# Mapowanie kolorów per linia
COLORS = {
    "0": "bg-teal-600", "1": "bg-emerald-600", "2": "bg-sky-600",
    "3": "bg-violet-600", "4": "bg-blue-600", "5": "bg-orange-600",
    "7": "bg-emerald-500", "8": "bg-sky-500", "9": "bg-rose-600", "10": "bg-amber-600"
}

def fetch_pdf_list():
    pdfs = []
    for url in SOURCES:
        try:
            print(f"📄 Pobieram listę z {url}")
            r = requests.get(url, headers=HEADERS, timeout=15, verify=False)
            soup = BeautifulSoup(r.text, "html.parser")
            for a in soup.select('a[href$=".pdf"]'):
                href = a.get('href')
                if not href: continue
                if not href.startswith('http'):
                    # relative
                    href = urljoin(url, href)
                text = a.get_text(strip=True)
                if 'Linia' in text or 'linia' in text.lower() or re.search(r'\b[0-9]{1,2}\b', text):
                    pdfs.append({"text": text, "href": href, "source": url})
        except Exception as e:
            print(f"❌ Błąd pobierania {url}: {e}")
    # deduplicate by href
    uniq = {p['href']: p for p in pdfs}
    return list(uniq.values())

def parse_pdf_text(pdf_path):
    if not HAS_PDF:
        return None
    try:
        with pdfplumber.open(pdf_path) as doc:
            full_text = "\n".join([p.extract_text() or "" for p in doc.pages])
            # próba wyciągnięcia tabeli
            tables = []
            for page in doc.pages:
                try:
                    tables.extend(page.extract_tables() or [])
                except:
                    pass
            return {"text": full_text, "tables": tables}
    except Exception as e:
        print(f"❌ PDF parse error {pdf_path}: {e}")
        return None

def extract_line_info(text, filename_hint=""):
    """
    Bardzo uproszczony parser - w realu PDFy ZPA mają układ:
    Przystanek | Dni powszednie | Sobota | Niedziela
    My wyciągamy regexami.
    """
    # Numer linii z tekstu np. "Linia nr 1" lub z nazwy pliku
    m = re.search(r'Linia\s*nr\s*([0-9]+)', text, re.I)
    if not m:
        m = re.search(r'Linia\s*[- ]\s*([0-9]+)', text, re.I)
    line_no = m.group(1) if m else re.search(r'([0-9]+)', filename_hint).group(1) if re.search(r'([0-9]+)', filename_hint) else "?"
    
    # Godziny
    times = re.findall(r'\b([0-2]?\d:[0-5]\d)\b', text)
    # Przystanki - linie z dużą literą, bez godziny
    stops = []
    for line in text.splitlines():
        line=line.strip()
        if not line: continue
        if re.match(r'^\d{1,2}:\d{2}', line): continue
        if len(line)<4: continue
        # heurystyka: przystanek zawiera "/" lub "ul." lub duże litery
        if '/' in line or 'Pl.' in line or 'Dworzec' in line or re.match(r'^[A-ZĄĆĘŁŃÓŚŻŹ][a-ząćęłńóśżź]+', line):
            # oczyść
            clean = re.sub(r'\s{2,}', ' ', line)[:80]
            if clean not in stops and len(clean)>3:
                stops.append(clean)
    stops = stops[:20] # max 20
    return {"line_no": line_no, "times": sorted(set(times)), "stops_sample": stops[:10]}

def build_timetables_from_pdfs(pdf_items, output_path):
    """
    W wersji FULL parsowalibyśmy każdy PDF na kierunki.
    Dla demo - jeśli pdfplumber dostępny, tworzymy strukturę, jeśli nie - zostawiamy mock.
    """
    # Wczytaj istniejący timetables.json jako bazę
    base_path = Path(output_path)
    if base_path.exists():
        with open(base_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        data = {"meta": {}, "lines": []}
    
    # Tutaj logika update: dla każdego PDFa porównaj hash
    # Na potrzeby v2 - symlink/full parser TODO
    # Na razie zaktualizuj tylko meta
    data['meta'] = {
        "version": time.strftime("%Y-%m-%d"),
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": ", ".join(SOURCES),
        "pdfsFound": len(pdf_items),
        "pdfs": pdf_items[:30],
        "note": "Wygenerowano przez scraper.py - podmień logikę parse na pełne tabele per przystanek. Ten plik jest kompatybilny z index.html v2."
    }
    # Jeżeli chcesz pełny auto-parse, odkomentuj:
    # for item in pdf_items:
    #   ...
    #   data['lines'].append(...)

    # Nazwy techniczne z API (np. "ŻYRARDÓW D") nie mogą zastępować
    # kolejności i nazw widocznych w oficjalnych tabelach PDF.
    from apply_pdf_stop_corrections import apply as apply_pdf_stop_corrections
    data = apply_pdf_stop_corrections(data)

    with open(output_path, 'w', encoding='utf-8') as out:
        json.dump(data, out, ensure_ascii=False, indent=2)
    print(f"✅ Zapisano {output_path} ({len(pdf_items)} PDFów)")

def main():
    print("🚍 ŻPA Scraper v2 start")
    pdfs = fetch_pdf_list()
    print(f"🔍 Znaleziono {len(pdfs)} PDFów z rozkładami")
    for p in pdfs[:10]:
        print(f"  - {p['text'][:60]} -> {p['href']}")
    
    # Pobierz 1 przykładowy PDF aby pokazać parsowanie
    if pdfs and HAS_PDF:
        sample = pdfs[0]
        try:
            print(f"\n⬇️  Pobieram przykładowy PDF {sample['href']}")
            r = requests.get(sample['href'], headers=HEADERS, timeout=20, verify=False)
            tmp = "/tmp/zpa_sample.pdf"
            Path(tmp).write_bytes(r.content)
            parsed = parse_pdf_text(tmp)
            if parsed:
                info = extract_line_info(parsed['text'], sample['text'])
                print(f"📊 Parsed info: linia {info['line_no']}, {len(info['times'])} godzin, przystanki: {info['stops_sample'][:3]}")
        except Exception as e:
            print(f"⚠️  Sample parse failed: {e}")

    # Zapisz timetables.json (w root projektu, nie w scraper/)
    output = Path(__file__).parent.parent / "timetables.json"
    build_timetables_from_pdfs(pdfs, output)
    
    # Sprawdź hash czy się zmieniło
    # Jeżeli hostujesz na S3, tu wgraj
    print("\n✨ Gotowe. Teraz index.html v2 automatycznie pobierze nowy plik przy odświeżeniu.")
    print("   Wdróż: git add timetables.json && git commit -m 'update timetable' && git push")

if __name__ == "__main__":
    main()
