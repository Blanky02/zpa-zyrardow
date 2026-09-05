#!/usr/bin/env python3
"""Parser rozkładów z oficjalnych PDF-ów PKS Gostynin / ŻPA Żyrardów.

Wyciąga z tabel PDF RZECZYWISTE godziny na każdym przystanku (dla każdego
kursu) oraz oznaczenia dni kursowania z nagłówka tabeli (D / 6 / 7+ / C ...),
a następnie uzupełnia timetables.json:

  direction.baseTimes       – godziny odjazdu z pierwszego przystanku (per dzień)
  direction.stopsTimes      – [day][kurs] -> [HH:MM | null, ...] per przystanek
  direction.timetableSource – skąd pochodzą godziny (plik PDF, „ważny od”)

Dzięki temu aplikacja pokazuje przyjazdy wprost z PDF-u, a nie przybliżenie
liczone jako „godzina startu + 2 minuty na przystanek”.

Uwagi implementacyjne:
- PDF-y mają warstwę tekstu z uszkodzonymi polskimi znakami (ł -> l, Ž -> Ż),
  dlatego dopasowanie przystanków idzie po norm() odpornej na literówki.
- Tabele bywają powielone na łączeniach stron i mają „rozjechane” kolumny –
  parser deduplikuje wiersze i mapuje godziny po kolejności, a zapasowo po
  indeksie kolumny.
- Oznaczenia dni dekodowane są z legendy PDF (np. „D – kursuje od
  poniedziałku do piątku oprócz świąt”, „7+ – niedziele i święta”,
  „C – soboty, niedziele i święta”).
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime
from difflib import SequenceMatcher

WEEKDAY, SATURDAY, SUNDAY = "weekday", "saturday", "sunday"
DAYS = (WEEKDAY, SATURDAY, SUNDAY)
DAY_LABELS = {WEEKDAY: "Dzień powszedni", SATURDAY: "Sobota", SUNDAY: "Niedziela"}

TIME_RE = re.compile(r"^\s*(\d{1,2}):([0-5]\d)\s*$")

# Znaczenia potwierdzone legendami w PDF-ach ŻPA/PKS Gostynin.
MARKER_DAYS = {
    "D": {WEEKDAY},          # pn–pt oprócz świąt
    "6": {SATURDAY},         # soboty
    "6+": {SATURDAY},
    "7": {SUNDAY},           # niedziele
    "7+": {SUNDAY},          # niedziele i święta
    "N": {SUNDAY},
    "S": {SATURDAY, SUNDAY}, # weekend
    "C": {SATURDAY, SUNDAY}, # soboty, niedziele i święta
    "COD": {WEEKDAY, SATURDAY, SUNDAY},
}

MONTHS = {
    "stycznia": 1, "lutego": 2, "marca": 3, "kwietnia": 4, "maja": 5,
    "czerwca": 6, "lipca": 7, "sierpnia": 8, "września": 9, "wrzesnia": 9,
    "października": 10, "listopada": 11, "grudnia": 12,
}

# Komórki/wiersze, które nie są przystankami.
NOISE_FRAGMENTS = (
    "predkosc", "przyspieszenie", "data i dane", "zarzadzajacej", "liczba",
    "wypis", "pojazdow", "pojazd", "nazwa linii", "naz wa linii", "rozkład",
    "rozkład ważny", "oznaczenia", "omaczenia", "rodzaj kursu", "rodzaje",
    "dworce i przystanki", "skrot nazwy", "numer kursu", "numer barsu",
    "zpowrotem", "kierownik", "kursuje", "kontrola",
)

_L_FOLD = str.maketrans({"ł": "l", "Ł": "l"})


def norm(text) -> str:
    """Normalizacja odporna na uszkodzenia warstwy tekstowej PDF (ł->l itd.)."""
    if text is None:
        return ""
    t = str(text).translate(_L_FOLD)
    t = unicodedata.normalize("NFKD", t)
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    t = re.sub(r"[^0-9a-z]+", " ", t.lower())
    return re.sub(r"\s+", " ", t).strip()


def cell_time(cell):
    """'4:44'/'04:44' -> '04:44', w przeciwnym razie None."""
    if cell is None:
        return None
    m = TIME_RE.match(str(cell))
    if not m or int(m.group(1)) > 24:
        return None
    return f"{int(m.group(1)):02d}:{m.group(2)}"


def minutes(time_str):
    if not time_str:
        return 10**9
    h, m = time_str.split(":")
    return int(h) * 60 + int(m)


def clean_stop_name(cell) -> str:
    if cell is None:
        return ""
    t = re.sub(r"\s+", " ", str(cell)).strip()
    # znaczniki „o” (początkowy) / „p” (końcowy) na końcu nazwy
    for _ in range(3):
        t2 = re.sub(r"\s+[op]\s*$", "", t)
        if t2 == t:
            break
        t = t2
    return t.strip(" ,/").strip()


def is_noise(text) -> bool:
    if not text:
        return True
    if not re.search(r"[A-Za-zĄĆĘŁŃÓŚŻŹąćęłńóśżź]", str(text)):
        return True
    n = norm(text)
    if len(n) < 3:
        return True
    return any(fragment in n for fragment in NOISE_FRAGMENTS)


def parse_date_pl(text, keyword="od"):
    """Data z tekstu: 'ważny od 04.07.2026', 'ważny od 1 września 2026 r.'."""
    if not text:
        return None
    t = str(text).lower()
    section = t
    if keyword:
        idx = t.find(keyword)
        if idx == -1:
            return None
        section = t[idx:]
    m = re.search(r"(\d{1,2})\s*[-.]\s*(\d{1,2})\s*[-.]\s*(\d{4})", section)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            return None
    m = re.search(r"(\d{1,2})\s+([a-ząęóśżź]+)\s+(\d{4})", section)
    if m and m.group(2) in MONTHS:
        try:
            return date(int(m.group(3)), MONTHS[m.group(2)], int(m.group(1)))
        except ValueError:
            return None
    return None


def anchor_valid_until(text):
    """Data „ważny do …” z treści linku (prefiltr przestarzałych PDFów)."""
    if not text:
        return None
    m = re.search(r"ważn\w*\s+do\s+(.+)$", str(text).lower())
    if not m:
        return None
    return parse_date_pl(m.group(1), None)


def parse_legend(text) -> dict:
    """Legenda oznaczeń z PDF-a: token -> zbiór dni.

    Przykład: 'D - kursuje od poniedziałku do piątku oprócz świąt'
              '7+ - Kursuje w niedziele i święta'
              'C - kursuje w soboty, niedziele i święta'
    """
    mapping = {}
    if not text:
        return mapping
    for m in re.finditer(r"(?:^|\n)\s*([A-Za-z0-9]{1,2}\+?)\s*[-–—]\s*([^\n]{4,90})", str(text)):
        token = m.group(1).strip().upper()
        desc = m.group(2).lower()
        days = set()
        if "codziennie" in desc:
            days = {WEEKDAY, SATURDAY, SUNDAY}
        elif "poniedziałk" in desc and "piątk" in desc:
            days = {WEEKDAY}
        else:
            if "sobot" in desc:
                days.add(SATURDAY)
            if "niedziel" in desc or "święt" in desc or "swiet" in desc:
                days.add(SUNDAY)
        if days and token not in MARKER_DAYS:
            mapping[token] = days
    return mapping


def decode_marker_days(text, legend=None):
    """Zbiór dni kursowania z treści komórek nagłówka kursu."""
    days = set()
    unknown = set()
    if not text:
        return days, unknown
    for token in re.findall(r"[A-Z0-9]{1,2}\+?", str(text).translate(_L_FOLD).upper()):
        if token in MARKER_DAYS:
            days |= MARKER_DAYS[token]
        elif legend and token in legend:
            days |= legend[token]
        elif re.fullmatch(r"[A-Z]{1,3}", token):
            unknown.add(token)
    return days, unknown


def find_header(rows):
    """Zwraca (indeks wiersza, indeks kolumny) nagłówka 'Dworce i przystanki'."""
    for i, row in enumerate(rows):
        for j, cell in enumerate(row):
            if not cell:
                continue
            n = norm(cell)
            if "dworce" in n and "przystank" in n:
                return i, j
    return None, None


def merge_raw_tables(raw_tables):
    """Scala fragmenty tabel (kontynuacje stron bez wiersza nagłówka)."""
    merged = []
    for tbl in raw_tables or []:
        rows = [list(row) for row in tbl if row is not None]
        if not rows:
            continue
        has_header, _ = find_header(rows)
        if has_header is None and merged:
            merged[-1].extend(rows)
        else:
            merged.append(rows)
    return merged


def _row_times(row):
    return [(j, cell_time(cell)) for j, cell in enumerate(row) if cell_time(cell)]


def _detect_stop_name(row, name_col):
    checked = []
    if name_col is not None and 0 <= name_col < len(row):
        checked.append(row[name_col])
    checked.extend(row)
    for cell in checked:
        if cell is None:
            continue
        if TIME_RE.match(str(cell).strip()):
            continue
        text = clean_stop_name(cell)
        if text and not is_noise(text):
            return text
    return None


def parse_table(rows):
    """Jedna tabela PDF -> {'stops': [...], 'courses': [{'marker_text', 'times'}]}."""
    header_idx, name_col = find_header(rows)
    if header_idx is None:
        return None

    entries = []
    seen_keys = set()
    for row in rows[header_idx + 1:]:
        if any(cell and "dworce" in norm(cell) and "przystank" in norm(cell) for cell in row):
            continue  # nagłówek kolejnej tabeli w tej samej siatce
        name = _detect_stop_name(row, name_col)
        if not name or is_noise(name):
            continue
        key = (norm(name), tuple(t for _, t in _row_times(row)))
        if key in seen_keys:
            continue  # powielone wiersze na łączeniach stron (także poza sąsiedztwem)
        seen_keys.add(key)
        entries.append((name, row, key))

    if len(entries) < 2:
        return None

    # Kolumny kursów: wiersz przystanku z największą liczbą komórek z godzinami.
    best_row = max((row for _, row, _ in entries), key=lambda r: len(_row_times(r)))
    course_cols = [j for j, _ in _row_times(best_row)]
    if not course_cols:
        return None
    course_count = len(course_cols)

    courses = [{"marker_text": "", "times": []} for _ in range(course_count)]
    for name, row, _ in entries:
        row_times = _row_times(row)
        if len(row_times) == course_count:
            per_course = [t for _, t in row_times]
        else:
            col_to_time = dict(row_times)
            per_course = [col_to_time.get(col) for col in course_cols]
        for k, t in enumerate(per_course):
            courses[k]["times"].append(t)

    # Oznaczenia dni: komórki nagłówka w kolumnach kursów.
    for row in rows[: header_idx + 1]:
        for k, col in enumerate(course_cols):
            cell = row[col] if col < len(row) else None
            if cell and str(cell).strip():
                courses[k]["marker_text"] = (courses[k]["marker_text"] + " " + str(cell)).strip()

    stops = [name for name, _, _ in entries]

    # Utnij wiersze bez żadnej godziny (śmieci warstwy tekstowej).
    keep = [i for i in range(len(stops)) if any(c["times"][i] for c in courses)]
    if len(keep) < 2:
        return None
    if len(keep) != len(stops):
        stops = [stops[i] for i in keep]
        for course in courses:
            course["times"] = [course["times"][i] for i in keep]

    filled = sum(1 for c in courses for t in c["times"] if t)
    coverage = filled / float(course_count * len(stops)) if stops else 0.0

    return {
        "stops": stops,
        "courses": courses,
        "coverage": round(coverage, 3),
        "courseCount": course_count,
        "firstTimes": [c["times"][0] if c["times"] else None for c in courses],
    }


def parse_pdf(path):
    """Cały PDF -> {'validFrom': date|None, 'legend': {...}, 'tables': [...]}."""
    import pdfplumber

    text_parts = []
    raw_tables = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            try:
                text_parts.append(page.extract_text() or "")
            except Exception:
                pass
            try:
                raw_tables.extend(page.extract_tables() or [])
            except Exception:
                continue

    text = "\n".join(text_parts)
    valid_from = parse_date_pl(text, "ważn")
    legend = parse_legend(text)

    tables = []
    for rows in merge_raw_tables(raw_tables):
        parsed = parse_table(rows)
        if parsed and parsed["coverage"] >= 0.5 and parsed["courseCount"] >= 1:
            tables.append(parsed)
    return {"validFrom": valid_from, "legend": legend, "tables": tables}


def line_number_from_anchor(text):
    """Numer linii z treści linku: 'Linia nr 1 ...', 'Linia 10 ...'."""
    if not text:
        return None
    m = re.search(r"linia\s*(?:nr\.?\s*)?(\d{1,2})\b", str(text), re.IGNORECASE)
    return m.group(1) if m else None


def sequence_similarity(direction_stops, table_stops):
    a = " | ".join(norm(s) for s in direction_stops)
    b = " | ".join(norm(s) for s in table_stops)
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def _existing_days_for_time(direction, first_time):
    days = set()
    if not first_time:
        return days
    for day in DAYS:
        if first_time in (direction.get("baseTimes") or {}).get(day) or []:
            days.add(day)
    return days


def build_day_schedule(direction, table, legend):
    """Dzień -> lista kursów (godzina startu + godziny na przystankach)."""
    warnings = []
    prepared = []
    unknown_tokens = set()
    for index, course in enumerate(table["courses"]):
        first = course["times"][0] if course["times"] else None
        if not first:
            warnings.append(f"kurs #{index + 1} bez godziny na pierwszym przystanku – pominięty")
            continue
        days, unknown = decode_marker_days(course.get("marker_text", ""), legend)
        unknown_tokens |= unknown
        source = "oznaczenia-pdf"
        if not days:
            days = _existing_days_for_time(direction, first)
            source = "zgodność-ze-starymi-danymi" if days else ""
        if not days:
            days = {WEEKDAY}
            source = "domyślnie-robocze"
            warnings.append(
                f"kurs {first}: nie rozpoznano oznaczenia dni "
                f"({' '.join(sorted(unknown_tokens)) or 'brak'}) – przypisano do dni roboczych"
            )
        prepared.append({"first": first, "times": list(course["times"]), "days": days, "daySource": source})

    prepared.sort(key=lambda c: minutes(c["first"]))
    base = {day: [] for day in DAYS}
    per_stop = {day: [] for day in DAYS}
    for course in prepared:
        for day in DAYS:
            if day in course["days"]:
                base[day].append(course["first"])
                per_stop[day].append(course["times"])
    return base, per_stop, warnings, unknown_tokens


def apply_pdf_times(data, parsed_pdfs, today=None):
    """Uzupełnia timetables.json o rzeczywiste godziny z PDF-ów.

    parsed_pdfs: lista {'line_no', 'href', 'validFrom', 'legend', 'tables'}
    Zwraca raport (dict) do audits/pdf_times_report.json.
    """
    today = today or date.today()
    report = {
        "generatedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "today": today.isoformat(),
        "directions": [],
        "warnings": [],
        "unusedTables": [],
    }

    tables_by_line = {}
    for pdf in parsed_pdfs:
        line_no = str(pdf.get("line_no") or "").strip()
        for table in pdf.get("tables") or []:
            entry = dict(table)
            entry["href"] = pdf.get("href")
            entry["validFrom"] = pdf.get("validFrom")
            entry["legend"] = pdf.get("legend") or {}
            tables_by_line.setdefault(line_no, []).append(entry)

    for line in data.get("lines", []):
        line_no = str(line.get("number", "")).strip()
        candidates = [
            t for t in tables_by_line.get(line_no, [])
            if not t.get("validFrom") or t.get("validFrom") <= today
        ]
        expired = [
            t for t in tables_by_line.get(line_no, [])
            if t.get("validFrom") and t.get("validFrom") > today
        ]
        for table in expired:
            report["warnings"].append(
                f"linia {line_no}: pominięto PDF obowiązujący dopiero od "
                f"{table['validFrom'].isoformat()} ({table.get('href')})"
            )

        pairs = []
        for dir_index, direction in enumerate(line.get("directions", [])):
            for table in candidates:
                ratio = sequence_similarity(direction.get("stops", []), table.get("stops", []))
                if ratio >= 0.8:
                    pairs.append((ratio, dir_index, table))
        # remis trafności rozstrzyga nowszy PDF („ważny od”); drobne różnice
        # dopasowania (druga cyfra po przecinku) nie powinny przemawiać za
        # starszym PDF-em, gdy układ przystanków się nie zmienił
        pairs.sort(key=lambda item: (
            -round(item[0], 2),
            -(item[2].get("validFrom") or date.min).toordinal(),
            item[1],
        ))


        assigned = {}
        used_ids = set()
        for ratio, dir_index, table in pairs:
            if dir_index in assigned or id(table) in used_ids:
                continue
            assigned[dir_index] = (table, ratio)
            used_ids.add(id(table))

        for table in candidates:
            if id(table) not in used_ids:
                report["unusedTables"].append({
                    "line": line_no,
                    "href": table.get("href"),
                    "validFrom": table["validFrom"].isoformat() if table.get("validFrom") else None,
                    "stops": len(table.get("stops", [])),
                    "courses": table.get("courseCount"),
                    "coverage": table.get("coverage"),
                })

        for dir_index, direction in enumerate(line.get("directions", [])):
            entry = {
                "line": line_no,
                "label": direction.get("label"),
                "stops": len(direction.get("stops", [])),
            }
            matched = assigned.get(dir_index)
            if not matched:
                entry.update({"status": "brak-dopasowania-PDF", "timesSource": "przybliżenie"})
                report["directions"].append(entry)
                report["warnings"].append(
                    f"linia {line_no} kierunek „{direction.get('label')}”: brak pasującej tabeli PDF – "
                    "pozostawiono dotychczasowe dane"
                )
                continue

            table, ratio = matched
            base, per_stop, warnings, _unknown = build_day_schedule(
                direction, table, table.get("legend") or {}
            )
            old_base = direction.get("baseTimes") or {}
            per_day = {}
            for day in DAYS:
                old = list(old_base.get(day) or [])
                new = base[day]
                per_day[day] = {
                    "old": len(old),
                    "new": len(new),
                    "added": sorted(set(new) - set(old)),
                    "removed": sorted(set(old) - set(new)),
                }
            entry.update({
                "status": "ok",
                "match": round(ratio, 3),
                "pdf": table.get("href"),
                "validFrom": table["validFrom"].isoformat() if table.get("validFrom") else None,
                "coverage": table.get("coverage"),
                "courses": table.get("courseCount"),
                "perDay": per_day,
                "warnings": warnings,
                "timesSource": "pdf",
            })
            direction["baseTimes"] = base
            direction["stopsTimes"] = per_stop
            direction["timetableSource"] = {
                "kind": "pdf",
                "pdf": table.get("href"),
                "validFrom": table["validFrom"].isoformat() if table.get("validFrom") else None,
                "parsedAt": report["generatedAt"],
            }
            for warning in warnings:
                report["warnings"].append(f"linia {line_no} „{direction.get('label')}”: {warning}")
            report["directions"].append(entry)

    return report


def summarize_report(report):
    ok = sum(1 for d in report["directions"] if d.get("status") == "ok")
    total = len(report["directions"])
    lines = [f"GODZINY Z PDFÓW: {ok}/{total} kierunków zaktualizowanych"]
    for entry in report["directions"]:
        if entry.get("status") != "ok":
            lines.append(f"  ⚠️  linia {entry['line']} „{entry.get('label')}”: {entry.get('status')}")
            continue
        per_day = entry.get("perDay", {})
        day_summary = ", ".join(
            f"{day}: {stats['old']}→{stats['new']}"
            + (f" (+{len(stats['added'])}/-{len(stats['removed'])})" if stats["added"] or stats["removed"] else "")
            for day, stats in per_day.items()
        )
        lines.append(
            f"  ✅ linia {entry['line']} „{entry.get('label')}” "
            f"(trafność {entry.get('match')}, PDF od {entry.get('validFrom')}) – {day_summary}"
        )
    for warning in report["warnings"]:
        lines.append(f"  ⚠️  {warning}")
    return "\n".join(lines)
