#!/usr/bin/env python3
"""Sprawdza kolejność przystanków aplikacji i mapy względem oficjalnych PDF."""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_PATH = Path(__file__).resolve().parent / "pdf_stop_orders.json"


def normalize(name: str) -> str:
    name = unicodedata.normalize("NFKD", name.upper())
    name = "".join(char for char in name if not unicodedata.combining(char))
    name = re.sub(r"[^A-Z0-9]+", " ", name).strip()
    name = re.sub(r"^ZYRARDOW\s+", "", name)
    return name


def same_stop(first: str, second: str) -> bool:
    left, right = normalize(first), normalize(second)
    if left == right or left in right or right in left:
        return True
    return SequenceMatcher(None, left, right).ratio() >= 0.84


def audit(timetables: dict, expected: dict) -> dict:
    actual_lines = {line["id"]: line for line in timetables.get("lines", [])}
    direction_results = []
    errors = []

    for line_id, canonical in expected["lines"].items():
        line = actual_lines.get(line_id)
        if not line:
            errors.append(f"Brak linii {line_id}")
            continue
        if len(line.get("directions", [])) != len(canonical["directions"]):
            errors.append(f"Linia {line_id}: inna liczba kierunków")
            continue

        for direction_index, expected_direction in enumerate(canonical["directions"]):
            direction = line["directions"][direction_index]
            expected_stops = expected_direction["stops"]
            list_stops = direction.get("stops", [])
            map_stops = direction.get("stops_full") or []
            direction_errors = []

            if len(list_stops) != len(expected_stops):
                direction_errors.append(f"Linie: {len(list_stops)} pozycji zamiast {len(expected_stops)}")
            if len(map_stops) != len(expected_stops):
                direction_errors.append(f"Mapa: {len(map_stops)} pozycji zamiast {len(expected_stops)}")

            for index, expected_name in enumerate(expected_stops):
                if index < len(list_stops) and not same_stop(list_stops[index], expected_name):
                    direction_errors.append(
                        f"Linie poz. {index + 1}: {list_stops[index]!r}, PDF: {expected_name!r}"
                    )
                if index < len(map_stops):
                    map_name = map_stops[index].get("name") or map_stops[index].get("official_name") or ""
                    if not same_stop(map_name, expected_name):
                        direction_errors.append(
                            f"Mapa poz. {index + 1}: {map_name!r}, PDF: {expected_name!r}"
                        )
                    if not map_stops[index].get("lat") or not map_stops[index].get("lon"):
                        direction_errors.append(f"Mapa poz. {index + 1}: brak współrzędnych")

            # Jeden słupek nie może reprezentować kilku różnych kolejnych nazw.
            identities: dict[str, tuple[int, str]] = {}
            for index, stop in enumerate(map_stops):
                identity = str(stop.get("designator") or stop.get("id") or "")
                name = expected_stops[index] if index < len(expected_stops) else ""
                previous = identities.get(identity)
                if identity and previous and not same_stop(previous[1], name):
                    direction_errors.append(
                        f"Stanowisko {identity} użyte dla {previous[1]!r} (poz. {previous[0]}) i {name!r} (poz. {index + 1})"
                    )
                identities.setdefault(identity, (index + 1, name))

            start = expected_stops[0] if expected_stops else "?"
            end = expected_stops[-1] if expected_stops else "?"
            direction_results.append({
                "line_id": line_id,
                "line_number": canonical["line_number"],
                "direction_index": direction_index,
                "start": start,
                "end": end,
                "stop_count": len(expected_stops),
                "source_pdf": canonical["source_pdf"],
                "valid_from": canonical["valid_from"],
                "status": "ok" if not direction_errors else "error",
                "errors": direction_errors,
            })
            errors.extend(f"Linia {line_id}, kierunek {direction_index}: {error}" for error in direction_errors)

    unexpected = sorted(set(actual_lines) - set(expected["lines"]))
    errors.extend(f"Linia bez definicji PDF: {line_id}" for line_id in unexpected)
    return {
        "verified_at": expected.get("verified_at"),
        "direction_count": len(direction_results),
        "stop_occurrence_count": sum(result["stop_count"] for result in direction_results),
        "ok_directions": sum(result["status"] == "ok" for result in direction_results),
        "error_count": len(errors),
        "directions": direction_results,
        "errors": errors,
    }


def write_markdown(report: dict, path: Path) -> None:
    lines = [
        "# Audyt kolejności przystanków względem PDF",
        "",
        f"Zweryfikowano: `{report['verified_at']}`",
        f"Kierunki: **{report['ok_directions']}/{report['direction_count']} zgodne**",
        f"Pozycje przystanków: **{report['stop_occurrence_count']}**",
        f"Błędy: **{report['error_count']}**",
        "",
        "| Linia | Kierunek | Liczba | PDF ważny od | Wynik |",
        "|---:|---|---:|---:|---|",
    ]
    for result in report["directions"]:
        route = f"{result['start']} → {result['end']}"
        status = "✅ zgodny" if result["status"] == "ok" else "❌ błąd"
        lines.append(
            f"| {result['line_number']} | {route} | {result['stop_count']} | {result['valid_from']} | {status} |"
        )
    if report["errors"]:
        lines.extend(["", "## Błędy", ""])
        lines.extend(f"- {error}" for error in report["errors"])
    lines.extend([
        "",
        "## Zakres kontroli",
        "",
        "- Widok **Linie**: tablica `direction.stops`.",
        "- Widok **Mapa**: kolejność `direction.stops_full` i współrzędne każdego stanowiska.",
        "- Źródło: kolumny „Dworce i przystanki” dla obu kierunków w oficjalnych PDF PKS Gostynin.",
    ])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timetables", type=Path, default=ROOT / "public" / "timetables.json")
    args = parser.parse_args()
    timetables = json.loads(args.timetables.read_text(encoding="utf-8"))
    expected = json.loads(EXPECTED_PATH.read_text(encoding="utf-8"))
    report = audit(timetables, expected)
    (ROOT / "stop_order_pdf_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    write_markdown(report, ROOT / "STOP_ORDER_PDF_AUDIT.md")
    print(
        f"Kierunki zgodne: {report['ok_directions']}/{report['direction_count']}; "
        f"pozycje: {report['stop_occurrence_count']}; błędy: {report['error_count']}"
    )
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
