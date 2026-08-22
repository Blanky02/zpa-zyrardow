#!/usr/bin/env python3
"""Naprawia rekordy przystanków, które API zwraca pod techniczną nazwą.

Kolejność i nazwy pochodzą z aktualnych tabel PDF PKS Gostynin. Współrzędne,
identyfikatory i numery słupków pochodzą z API KiedyPrzyjedzie. Skrypt jest
idempotentny i aktualizuje jednocześnie root oraz public/timetables.json.
"""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PLATFORMS = {
    2678: {"name": "Działki - Młyńska", "official_name": "DZIAŁKI - MŁYŃSKA", "id": "2030190:2103478", "designator": 2678, "lat": 52.065029, "lon": 20.406735},
    2679: {"name": "Działki - Młyńska", "official_name": "DZIAŁKI - MŁYŃSKA", "id": "2030190:2103479", "designator": 2679, "lat": 52.065104, "lon": 20.406333},
    2437: {"name": "Działki Małe", "official_name": "DZIAŁKI MAŁE", "id": "2030032:2103237", "designator": 2437, "lat": 52.071512, "lon": 20.393871},
    2438: {"name": "Działki Małe", "official_name": "DZIAŁKI MAŁE", "id": "2030032:2103238", "designator": 2438, "lat": 52.071555, "lon": 20.394167},
    2439: {"name": "Działki OSP", "official_name": "DZIAŁKI OSP", "id": "2030033:2103239", "designator": 2439, "lat": 52.067063, "lon": 20.395722},
    2440: {"name": "Działki OSP", "official_name": "DZIAŁKI OSP", "id": "2030033:2103240", "designator": 2440, "lat": 52.067050, "lon": 20.395969},
    2114: {"name": "Międzyborów", "official_name": "MIĘDZYBORÓW", "id": "2029859:2102914", "designator": 2114, "lat": 52.058387, "lon": 20.485516},
    2705: {"name": "Nowe Kozłowice 53", "official_name": "NOWE KOZŁOWICE 53", "id": "2030210:2103505", "designator": 2705, "lat": 52.082772, "lon": 20.433107},
    2337: {"name": "Stare Kozłowice 1/2 / I", "official_name": "STARE KOZŁOWICE 1/2 / I", "id": "2029978:2103137", "designator": 2337, "lat": 52.071841, "lon": 20.420523},
    2355: {"name": "Korytów(A)-Szkoła", "official_name": "KORYTÓW(A)-SZKOŁA", "id": "2029987:2103155", "designator": 2355, "lat": 52.029543, "lon": 20.467277},
    2356: {"name": "Korytów(A)-Szkoła", "official_name": "KORYTÓW(A)-SZKOŁA", "id": "2029987:2103156", "designator": 2356, "lat": 52.029754, "lon": 20.466590},
    2357: {"name": "Korytów Straż", "official_name": "KORYTÓW STRAŻ", "id": "2029988:2103157", "designator": 2357, "lat": 52.024764, "lon": 20.474937},
    2358: {"name": "Korytów Straż", "official_name": "KORYTÓW STRAŻ", "id": "2029988:2103158", "designator": 2358, "lat": 52.025081, "lon": 20.474508},
    2359: {"name": "Korytów Polna", "official_name": "KORYTÓW POLNA", "id": "2029989:2103159", "designator": 2359, "lat": 52.020817, "lon": 20.480616},
    2360: {"name": "Korytów Polna", "official_name": "KORYTÓW POLNA", "id": "2029989:2103160", "designator": 2360, "lat": 52.020358, "lon": 20.481797},
    2732: {"name": "Korytów Las", "official_name": "KORYTÓW LAS", "id": "2030233:2103532", "designator": 2732, "lat": 52.017650, "lon": 20.487241},
    2733: {"name": "Korytów Las", "official_name": "KORYTÓW LAS", "id": "2030233:2103533", "designator": 2733, "lat": 52.017479, "lon": 20.487627},
}

# (line id, direction index, zero-based stop index, PDF display name, designator)
PATCHES = [
    ("2", 0, 19, "NOWE KOZŁOWICE 53", 2705),
    ("2", 0, 21, "STARE KOZŁOWICE 1/2 / I", 2337),
    ("3", 0, 0, "DZIAŁKI OSP", 2439),
    ("3", 0, 1, "DZIAŁKI - MŁYŃSKA", 2678),
    ("3", 0, 37, "MIĘDZYBORÓW", 2114),
    ("3", 1, 0, "MIĘDZYBORÓW", 2114),
    ("3", 1, 35, "DZIAŁKI - MŁYŃSKA", 2679),
    ("3", 1, 36, "DZIAŁKI OSP", 2440),
    ("4", 0, 2, "DZIAŁKI MAŁE", 2437),
    ("4", 0, 3, "DZIAŁKI OSP", 2439),
    ("4", 0, 4, "DZIAŁKI - MŁYŃSKA", 2678),
    ("4", 1, 18, "DZIAŁKI - MŁYŃSKA", 2679),
    ("4", 1, 19, "DZIAŁKI OSP", 2440),
    ("4", 1, 20, "DZIAŁKI MAŁE", 2438),
    ("8", 0, 2, "DZIAŁKI MAŁE", 2437),
    ("8", 0, 3, "DZIAŁKI - MŁYŃSKA", 2678),
    ("8", 1, 19, "DZIAŁKI - MŁYŃSKA", 2679),
    ("8", 1, 20, "DZIAŁKI MAŁE", 2438),
    ("10", 0, 38, "KORYTÓW(A)-SZKOŁA", 2355),
    ("10", 0, 39, "KORYTÓW STRAŻ", 2357),
    ("10", 0, 40, "KORYTÓW POLNA", 2359),
    ("10", 0, 41, "KORYTÓW LAS", 2732),
    ("10", 1, 0, "KORYTÓW LAS", 2733),
    ("10", 1, 1, "KORYTÓW POLNA", 2360),
    ("10", 1, 2, "KORYTÓW STRAŻ", 2358),
    ("10", 1, 3, "KORYTÓW(A)-SZKOŁA", 2356),
]


def apply(data: dict) -> dict:
    lines = {line["id"]: line for line in data["lines"]}
    for line_id, direction_index, stop_index, display_name, designator in PATCHES:
        direction = lines[line_id]["directions"][direction_index]
        direction["stops"][stop_index] = display_name
        direction["stops_full"][stop_index] = deepcopy(PLATFORMS[designator])

    lines["3"]["name"] = "Linia 3 Działki OSP - Międzyborów"
    for line in data["lines"]:
        for direction in line["directions"]:
            direction["stops"] = [
                stop.replace("ŻEROMKSIEGO", "ŻEROMSKIEGO").replace("Żeromksiego", "Żeromskiego")
                for stop in direction["stops"]
            ]
            start, end = direction["stops"][0], direction["stops"][-1]
            direction["label"] = f"{start} → {end}"
            direction["short"] = f"{start} → {end}"
    return data


def write_route_fallback(data: dict) -> None:
    platforms: dict[str, dict] = {}
    for line in data["lines"]:
        for direction in line["directions"]:
            for stop in direction.get("stops_full") or []:
                if not stop.get("lat") or not stop.get("lon"):
                    continue
                identity = f"designator:{stop.get('designator')}" if stop.get("designator") is not None else f"id:{stop.get('id')}"
                platforms.setdefault(identity, {
                    "id": str(stop.get("id")) if stop.get("id") else None,
                    "designator": stop.get("designator"),
                    "name": stop.get("name") or stop.get("official_name"),
                    "lat": float(stop["lat"]),
                    "lon": float(stop["lon"]),
                    "source": "route",
                })

    records = {}
    for platform in sorted(platforms.values(), key=lambda item: (item["name"], item.get("designator") or 0)):
        suffix = platform.get("designator") if platform.get("designator") is not None else platform.get("id")
        records[f"{platform['name']} [{suffix}]"] = platform
    json_text = json.dumps(records, ensure_ascii=False, indent=2) + "\n"
    (ROOT / "stops_gps.json").write_text(json_text, encoding="utf-8")
    (ROOT / "public" / "stops_gps.json").write_text(json_text, encoding="utf-8")
    js_text = (
        "// Offline fallback generated from PDF-verified route platforms.\n"
        f"const STOP_COORDS = {json_text.strip()};\n\n"
        "if (typeof module !== 'undefined' && module.exports) {\n"
        "  module.exports = { STOP_COORDS };\n"
        "}\n"
    )
    (ROOT / "stops_gps.js").write_text(js_text, encoding="utf-8")


def main() -> None:
    source = ROOT / "timetables.json"
    data = apply(json.loads(source.read_text(encoding="utf-8")))
    serialized = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    source.write_text(serialized, encoding="utf-8")
    (ROOT / "public" / "timetables.json").write_text(serialized, encoding="utf-8")
    write_route_fallback(data)
    print(f"Zastosowano {len(PATCHES)} korekt nazw i stanowisk z tabel PDF.")


if __name__ == "__main__":
    main()
