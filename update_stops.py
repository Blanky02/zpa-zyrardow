#!/usr/bin/env python3
"""Aktualizuje fizyczne stanowiska przystankowe używane przez linie ŻPA.

Priorytet danych:
1. aktualne API KiedyPrzyjedzie,
2. współrzędne ``stops_full`` zapisane w ``timetables.json``.

Każdy numer słupka (``designator``) pozostaje osobnym rekordem. Skrypt nie
scala przystanków o tej samej nazwie, ponieważ mogą leżeć po przeciwnych
stronach ulicy albo obsługiwać różne kierunki.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import requests

API_URL = "https://pksgostynin.kiedyprzyjedzie.pl/stops"
ROOT = Path(__file__).resolve().parent
TIMETABLES_PATH = ROOT / "timetables.json"


def normalize_name(name: str) -> str:
    name = name.upper().replace("ŻYR.", "ŻYRARDÓW").replace("ZYR.", "ŻYRARDÓW")
    name = re.sub(r"\s*\[\d+\]\s*$", "", name)
    name = unicodedata.normalize("NFKD", name)
    name = "".join(char for char in name if not unicodedata.combining(char))
    return re.sub(r"[^A-Z0-9]+", " ", name).strip()


def fetch_stops() -> tuple[list, int | None]:
    print(f"Pobieranie danych z {API_URL}...")
    response = requests.get(API_URL, timeout=30)
    response.raise_for_status()
    payload = response.json()
    print(f"Liczba wszystkich stanowisk w API: {len(payload.get('stops', []))}")
    return payload.get("stops", []), payload.get("revision")


def load_route_platforms(path: Path = TIMETABLES_PATH) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    platforms: dict[str, dict] = {}

    for line in data.get("lines", []):
        for direction in line.get("directions", []):
            for index, stop in enumerate(direction.get("stops_full") or []):
                lat, lon = stop.get("lat"), stop.get("lon")
                if not lat or not lon:
                    continue
                name = stop.get("name") or stop.get("official_name") or direction.get("stops", [])[index]
                designator = stop.get("designator")
                stop_id = stop.get("id")
                identity = f"designator:{designator}" if designator is not None else f"id:{stop_id}"
                platforms.setdefault(identity, {
                    "id": str(stop_id) if stop_id else None,
                    "designator": int(designator) if designator is not None else None,
                    "name": name,
                    "lat": float(lat),
                    "lon": float(lon),
                    "source": "route",
                })

    print(f"Liczba fizycznych stanowisk używanych przez trasy: {len(platforms)}")
    return list(platforms.values())


def select_relevant_api_stops(api_stops: list, route_platforms: list[dict]) -> list:
    route_designators = {str(stop["designator"]) for stop in route_platforms if stop["designator"] is not None}
    route_ids = {stop["id"] for stop in route_platforms if stop["id"]}
    route_names = {normalize_name(stop["name"]) for stop in route_platforms}

    selected = []
    for entry in api_stops:
        if len(entry) < 5:
            continue
        stop_id, designator, name, raw_lon, raw_lat = entry[:5]
        relevant = (
            str(designator) in route_designators
            or str(stop_id) in route_ids
            or normalize_name(name) in route_names
        )
        if relevant:
            selected.append(entry)

    print(f"Liczba aktualnych stanowisk API pasujących do tras ŻPA: {len(selected)}")
    return selected


def build_platform_map(api_stops: list, route_platforms: list[dict]) -> dict[str, dict]:
    result: dict[str, dict] = {}
    api_designators: set[str] = set()
    api_ids: set[str] = set()

    for entry in api_stops:
        stop_id, designator, name, raw_lon, raw_lat = entry[:5]
        lat = float(raw_lat) / 1_000_000
        lon = float(raw_lon) / 1_000_000
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue

        key = f"{name} [{designator}]"
        result[key] = {
            "id": str(stop_id),
            "designator": int(designator),
            "name": name,
            "lat": lat,
            "lon": lon,
            "source": "api",
        }
        api_designators.add(str(designator))
        api_ids.add(str(stop_id))

    # Jeżeli API chwilowo nie zawiera stanowiska obecnego w rozkładzie,
    # zachowaj je z dokładnych danych trasy zamiast całkowicie je usuwać.
    for stop in route_platforms:
        if (
            stop["designator"] is not None
            and str(stop["designator"]) in api_designators
        ) or (stop["id"] and stop["id"] in api_ids):
            continue
        suffix = stop["designator"] if stop["designator"] is not None else stop["id"]
        result[f"{stop['name']} [{suffix}]"] = stop

    return dict(sorted(result.items(), key=lambda item: (normalize_name(item[1]["name"]), item[1].get("designator") or 0)))


def generate_files(stops_data: dict[str, dict], revision: int | None) -> None:
    json_output = json.dumps(stops_data, ensure_ascii=False, indent=2)
    (ROOT / "stops_gps.json").write_text(json_output + "\n", encoding="utf-8")

    generated_at = datetime.now(timezone.utc).isoformat()
    js_content = f"""// Auto-generated from {API_URL}
// Generated: {generated_at}
// API revision: {revision or 'unknown'}
const STOP_COORDS = {json_output};

if (typeof module !== 'undefined' && module.exports) {{
  module.exports = {{ STOP_COORDS }};
}}
"""
    (ROOT / "stops_gps.js").write_text(js_content, encoding="utf-8")
    print(f"Zapisano {len(stops_data)} osobnych stanowisk do stops_gps.json i stops_gps.js")


def main() -> None:
    print("=" * 64)
    print("Aktualizacja stanowisk przystankowych ŻPA")
    print("=" * 64)
    route_platforms = load_route_platforms()
    api_stops, revision = fetch_stops()
    relevant_api_stops = select_relevant_api_stops(api_stops, route_platforms)
    platform_map = build_platform_map(relevant_api_stops, route_platforms)
    generate_files(platform_map, revision)

    print("\nKontrola kolejności przystanków względem PDF...")
    subprocess.run(
        [
            sys.executable,
            str(ROOT / "scraper" / "audit_stop_order.py"),
            "--timetables",
            str(ROOT / "timetables.json"),
        ],
        cwd=ROOT,
        check=True,
    )

    # GitHub Actions has unrestricted access to Overpass. Run the complete OSM
    # comparison there and expose every non-confirmed platform in the job log.
    if os.environ.get("GITHUB_ACTIONS") == "true":
        print("\nPorównanie wszystkich stanowisk z OpenStreetMap...")
        subprocess.run(
            [
                sys.executable,
                str(ROOT / "scraper" / "compare_stops_osm.py"),
                "--stops",
                str(ROOT / "stops_gps.json"),
            ],
            cwd=ROOT,
            check=True,
        )

    print("✓ Aktualizacja zakończona pomyślnie")


if __name__ == "__main__":
    main()
