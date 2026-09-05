#!/usr/bin/env python3
"""Testy parsera PDF (pdf_timetables.py) na danych odwzorowanych z realnych PDF-ów.

Uruchomienie: python scraper/test_pdf_timetables.py
"""

import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from pdf_timetables import (  # noqa: E402
    DAYS,
    anchor_valid_until,
    apply_pdf_times,
    clean_stop_name,
    cell_time,
    line_number_from_anchor,
    merge_raw_tables,
    parse_date_pl,
    parse_legend,
    parse_table,
)


def header_rows(markers):
    """Nagłówek tabeli PKS w formie siatki pdfplumber (kursy od kolumny 7)."""
    lead = ["", "", "", "", "Nagłówek", "", ""]
    return [
        lead + ["GOST"] * len(markers) + [""],
        lead + [str(4500 + i) for i in range(len(markers))] + [""],
        lead + markers + [""],
        lead + ["zw."] * len(markers) + [""],
        ["Km", "Odl", "NrP", "Lp", "Dworce i przystanki", "NrPOW", "KD POW"] + [None] * len(markers) + [""],
    ]



# Prawdziwa tabela z PDF „Linia nr 1 Żyrardów Spółdzielcza PKP” (D.A. → Spółdzielcza),
# czas „Rozkład ważny od 01.05.2026”.
LINE1_STOPS = [
    "ŻYRARDÓW D.A. o",
    "ŻYRARDÓW ŚRODKOWA/BOHATERÓW",
    "ŻYRARDÓW ŚRODKOWA/MIRECKIEGO",
    "ŻYRARDÓW ŚRODKOWA/LIMANOWSKIE",
    "ŻYRARDÓW ŚRODKOWA/SPOKOJNA",
    "ŻYRARDÓW F.DE GIRARDA",
    "ŻYRARDÓW KPT.PALACA",
    "ŻYRARDÓW SKROWACZEWSKIEGO/NIET",
    "ŻYRARDÓW SPÓLDZIELCZA p",
]

LINE1_COURSES = [
    ["05:14", "05:16", "05:17", "05:18", "05:19", "05:20", "05:22", "05:23", "05:24"],
    ["06:18", "06:20", "06:21", "06:22", "06:23", "06:24", "06:26", "06:27", "06:28"],
    ["06:32", "06:34", "06:35", "06:36", "06:37", "06:38", "06:40", "06:41", "06:42"],
    ["08:06", "08:08", "08:09", "08:10", "08:11", "08:12", "08:14", "08:15", "08:16"],
    ["09:18", "09:20", "09:21", "09:22", "09:23", "09:24", "09:26", "09:27", "09:28"],
    ["11:20", "11:22", "11:23", "11:24", "11:25", "11:26", "11:28", "11:29", "11:30"],
    ["12:30", "12:32", "12:33", "12:34", "12:35", "12:36", "12:38", "12:39", "12:40"],
    ["13:26", "13:28", "13:29", "13:30", "13:31", "13:32", "13:34", "13:35", "13:36"],
    ["14:06", "14:08", "14:09", "14:10", "14:11", "14:12", "14:14", "14:15", "14:16"],
    ["14:42", "14:44", "14:45", "14:46", "14:47", "14:48", "14:50", "14:51", "14:52"],
    ["19:10", "19:12", "19:13", "19:14", "19:15", "19:16", "19:18", "19:19", "19:20"],
]

LINE1_MARKERS = ["D", "D", "D", "C", "D", "D", "C", "D", "D", "7+", "D"]


def line1_rows():
    rows = header_rows(LINE1_MARKERS)
    for stop_index, stop in enumerate(LINE1_STOPS):
        rows.append(
            [f"0,{stop_index}", "0,2", str(9 - stop_index), str(stop_index + 1), stop, "01", ""]
            + [course[stop_index] for course in LINE1_COURSES]
            + [""]
        )
    # powielone wiersze na łączeniu stron (z „rozjechanymi” kolumnami i wariantami znaków)
    rows.append(["", "2,8", "0,4", "2", "8", "ŽYRARDÓW SKROWACZEWSKIEGO/NIET", "01", ""]
                + [course[7] for course in LINE1_COURSES])
    rows.append(["", "3,2", "", "1", "9", "ŻYRARDÓW SPÓLDZIELCZA p", "01", ""]
                + [course[8] for course in LINE1_COURSES])
    rows.append(["", "", "", "10", "Prędkość techniczna", "", ""] + ["31,4"] * len(LINE1_MARKERS) + [""])
    return rows


def line1_direction():
    return {
        "id": "1a",
        "label": "ŻYRARDÓW D.A. → ŻYRARDÓW SPÓŁDZIELCZA",
        "stops": [clean_stop_name(stop) for stop in LINE1_STOPS],
        "baseTimes": {
            "weekday": ["05:14", "06:18", "06:32", "08:06", "09:18", "11:20", "12:30", "13:26", "14:06", "14:42", "19:10"],
            "saturday": ["05:14", "06:32", "09:18", "12:30", "14:06", "19:10"],
            "sunday": ["05:14", "08:06", "12:30", "14:42"],
        },
    }


LEGEND_TEXT = (
    "Oznaczenia:\n"
    "D - kursuje od poniedziałku do piątku oprócz świąt\n"
    "7+ - Kursuje w niedziele i święta\n"
    "C - kursuje w soboty, niedziele i święta\n"
    "E - kursuje w soboty\n"
    "zw. - kurs zwykły\n"
)


class HelpersTest(unittest.TestCase):
    def test_cell_time(self):
        self.assertEqual(cell_time("4:44"), "04:44")
        self.assertEqual(cell_time(" 19:05 "), "19:05")
        self.assertIsNone(cell_time("31,4"))
        self.assertIsNone(cell_time("0,4"))
        self.assertIsNone(cell_time(None))

    def test_clean_stop_name(self):
        self.assertEqual(clean_stop_name("ŻYRARDÓW SPÓLDZIELCZA o"), "ŻYRARDÓW SPÓLDZIELCZA")
        self.assertEqual(clean_stop_name("ŻYRARDÓW MOSTOWA PĘTLA p"), "ŻYRARDÓW MOSTOWA PĘTLA")
        self.assertEqual(clean_stop_name("DZIAŁKI OSP"), "DZIAŁKI OSP")

    def test_parse_date_pl(self):
        self.assertEqual(parse_date_pl("Roz kład ważny od 04.07.2026", "ważn"), date(2026, 7, 4))
        self.assertEqual(parse_date_pl("ważny od 1 września 2026 r.", "ważn"), date(2026, 9, 1))
        self.assertIsNone(parse_date_pl("brak daty", "ważn"))

    def test_anchor_valid_until(self):
        self.assertEqual(
            anchor_valid_until("Linia 0 Żeromskiego – Zalew (przez PKP) – ważny do 31 sierpnia 2026 r."),
            date(2026, 8, 31),
        )
        self.assertEqual(anchor_valid_until("Linia 4 – ważny do 31.08.2026"), date(2026, 8, 31))
        # „ważny od …” to nie data ważności – nie odrzucamy PDF-a
        self.assertIsNone(anchor_valid_until("Linia 4 Wiskitki ... od 01.09.2026"))
        self.assertIsNone(anchor_valid_until("Linia 1"))

    def test_line_number_from_anchor(self):
        self.assertEqual(line_number_from_anchor("Linia nr 1 Żyrardów Spółdzielcza PKP (965)(PDF)"), "1")
        self.assertEqual(line_number_from_anchor("Linia 10"), "10")
        self.assertIsNone(line_number_from_anchor("Linia Różanów - Żyrardów (1957)(PDF)"))

    def test_parse_legend(self):
        legend = parse_legend(LEGEND_TEXT)
        # D, 7+, C są już w słowniku domyślnym – legenda dodaje tylko nieznane tokeny
        self.assertEqual(legend.get("E"), {"saturday"})
        self.assertNotIn("D", legend)


class ParseTableTest(unittest.TestCase):
    def setUp(self):
        self.table = parse_table(merge_raw_tables([line1_rows()])[0])

    def test_stops_deduplicated(self):
        self.assertEqual(self.table["stops"], [clean_stop_name(s) for s in LINE1_STOPS])

    def test_course_count_and_times(self):
        self.assertEqual(self.table["courseCount"], 11)
        self.assertEqual(self.table["courses"][0]["times"], LINE1_COURSES[0])
        self.assertEqual(self.table["courses"][10]["times"], LINE1_COURSES[10])

    def test_markers_collected(self):
        self.assertIn("C", self.table["courses"][3]["marker_text"])
        self.assertIn("7+", self.table["courses"][9]["marker_text"])

    def test_coverage(self):
        self.assertEqual(self.table["coverage"], 1.0)


class SparseRowsTest(unittest.TestCase):
    """Wiersze z brakującymi kursami mapowane po indeksie kolumny (PDF linii 5)."""

    def test_sparse_row(self):
        rows = header_rows(["D", "7+", "C", "D", "D", "D"])
        stops = ["ŻYRARDÓW KORYTÓW o", "ŻYRARDÓW MICKIEWICZA/DZIAŁKI", "ŻYRARDÓW KORYTÓW p"]
        # pierwszy wiersz pełny (ustala 6 kolumn kursów), kolejne z brakami w środku
        grid = [
            ["15:40", "16:00", "17:50", "18:10", "21:01", "21:30"],
            ["15:41", None, "17:51", None, "21:02", None],
            ["15:42", None, "17:52", None, "21:03", None],
        ]
        for stop, times in zip(stops, grid):
            rows.append(["0,0", "0,2", "45", "1", stop, "02", ""] + times + [""])
        table = parse_table(rows)
        self.assertEqual(table["courseCount"], 6)
        self.assertEqual(table["courses"][0]["times"], ["15:40", "15:41", "15:42"])
        self.assertEqual(table["courses"][1]["times"], ["16:00", None, None])
        self.assertEqual(table["courses"][2]["times"], ["17:50", "17:51", "17:52"])
        self.assertEqual(table["courses"][3]["times"], ["18:10", None, None])
        self.assertEqual(table["coverage"], round(12 / 18, 3))



class ApplyTest(unittest.TestCase):
    def _parsed(self, tables, valid_from=date(2026, 5, 1), legend_text=LEGEND_TEXT):
        return [{
            "line_no": "1",
            "href": "https://zpa.powiat-zyrardowski.pl/plik,236,linia-nr-1.pdf",
            "validFrom": valid_from,
            "legend": parse_legend(legend_text),
            "tables": tables,
        }]

    def test_apply_per_stop_times(self):
        data = {"lines": [{"number": "1", "directions": [line1_direction()]}]}
        report = apply_pdf_times(data, self._parsed([self._table()]), today=date(2026, 9, 5))
        direction = data["lines"][0]["directions"][0]
        self.assertEqual(report["directions"][0]["status"], "ok")

        base = direction["baseTimes"]
        per_stop = direction["stopsTimes"]
        # kursy D -> dzień powszedni; C -> sob+nd; 7+ -> niedziela
        self.assertEqual(base["weekday"], ["05:14", "06:18", "06:32", "09:18", "11:20", "13:26", "14:06", "19:10"])
        self.assertEqual(base["saturday"], ["08:06", "12:30"])
        self.assertEqual(base["sunday"], ["08:06", "12:30", "14:42"])

        for day in DAYS:
            for k, first in enumerate(base[day]):
                self.assertEqual(per_stop[day][k][0], first)
        # rzeczywista godzina na ŚRODKOWA/BOHATERÓW (indeks 1) dla kursu 05:14
        self.assertEqual(per_stop["weekday"][0][1], "05:16")
        self.assertEqual(per_stop["weekday"][0][8], "05:24")
        # źródło zapisane w kierunku
        self.assertEqual(direction["timetableSource"]["kind"], "pdf")
        self.assertEqual(direction["timetableSource"]["validFrom"], "2026-05-01")

    def test_fallback_to_existing_day_buckets(self):
        # kursy bez oznaczeń w nagłówku -> dni wg starych baseTimes
        rows = header_rows([""] * 3)
        stops = ["ŻYRARDÓW D.A. o", "ŻYRARDÓW SPÓLDZIELCZA p"]
        times = [["05:14", "05:24"], ["06:18", "06:28"], ["19:10", "19:20"]]
        for stop, row_times in zip(stops, [list(r) for r in zip(*times)]):
            rows.append(["0,0", "0,9", "9", "1", stop, "01", ""] + row_times + [""])
        table = parse_table(rows)

        direction = {
            "label": "test",
            "stops": [clean_stop_name(s) for s in stops],
            "baseTimes": {"weekday": ["05:14", "06:18", "19:10"], "saturday": ["05:14"], "sunday": []},
        }
        data = {"lines": [{"number": "1", "directions": [direction]}]}
        apply_pdf_times(data, self._parsed([table], legend_text=""), today=date(2026, 9, 5))
        self.assertEqual(direction["baseTimes"]["weekday"], ["05:14", "06:18", "19:10"])
        self.assertEqual(direction["baseTimes"]["saturday"], ["05:14"])
        self.assertEqual(direction["baseTimes"]["sunday"], [])

    def test_newest_valid_pdf_wins(self):
        old_table = self._table(first="04:44")
        new_table = self._table(first="05:44")
        pdfs = self._parsed([old_table], valid_from=date(2026, 8, 1)) + \
            self._parsed([new_table], valid_from=date(2026, 9, 1))
        direction = line1_direction()
        data = {"lines": [{"number": "1", "directions": [direction]}]}
        apply_pdf_times(data, pdfs, today=date(2026, 9, 5))
        self.assertEqual(direction["baseTimes"]["weekday"][0], "05:44")
        self.assertEqual(direction["timetableSource"]["validFrom"], "2026-09-01")

        direction = line1_direction()
        data = {"lines": [{"number": "1", "directions": [direction]}]}
        apply_pdf_times(data, pdfs, today=date(2026, 8, 15))
        self.assertEqual(direction["baseTimes"]["weekday"][0], "04:44")

    def test_future_only_pdf_leaves_data(self):
        direction = line1_direction()
        data = {"lines": [{"number": "1", "directions": [direction]}]}
        report = apply_pdf_times(
            data,
            self._parsed([self._table()], valid_from=date(2026, 10, 1)),
            today=date(2026, 9, 5),
        )
        self.assertEqual(report["directions"][0]["status"], "brak-dopasowania-PDF")
        self.assertNotIn("stopsTimes", direction)
        self.assertEqual(
            direction["baseTimes"]["weekday"],
            ["05:14", "06:18", "06:32", "08:06", "09:18", "11:20", "12:30", "13:26", "14:06", "14:42", "19:10"],
        )

    def test_unknown_marker_defaults_to_weekday_with_warning(self):
        rows = header_rows(["X"])
        rows.append(["0,0", "0,9", "9", "1", "ŻYRARDÓW D.A. o", "01", "", "07:00", ""])
        rows.append(["0,9", "0,9", "9", "2", "ŻYRARDÓW SPÓLDZIELCZA p", "01", "", "07:10", ""])
        table = parse_table(rows)
        direction = {
            "label": "test",
            "stops": [clean_stop_name(s) for s in ["ŻYRARDÓW D.A. o", "ŻYRARDÓW SPÓLDZIELCZA p"]],
            "baseTimes": {"weekday": [], "saturday": [], "sunday": []},
        }
        data = {"lines": [{"number": "1", "directions": [direction]}]}
        report = apply_pdf_times(data, self._parsed([table], legend_text=""), today=date(2026, 9, 5))
        self.assertEqual(direction["baseTimes"]["weekday"], ["07:00"])
        self.assertTrue(any("X" in w for w in report["warnings"]))

    def _table(self, first="05:14"):
        shift = (
            int(first[:2]) * 60 + int(first[3:])
            - (int(LINE1_COURSES[0][0][:2]) * 60 + int(LINE1_COURSES[0][0][3:]))
        )

        def shift_time(t):
            total = int(t[:2]) * 60 + int(t[3:]) + shift
            return f"{total // 60:02d}:{total % 60:02d}"

        rows = header_rows(LINE1_MARKERS)
        for stop_index, stop in enumerate(LINE1_STOPS):
            rows.append(
                [f"0,{stop_index}", "0,2", str(9 - stop_index), str(stop_index + 1), stop, "01", ""]
                + [[shift_time(t) for t in course][stop_index] for course in LINE1_COURSES]
                + [""]
            )
        return parse_table(rows)


if __name__ == "__main__":
    unittest.main(verbosity=2)
