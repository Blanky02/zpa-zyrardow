#!/usr/bin/env python3
"""Audyt spójności nazw i współrzędnych stanowisk ŻPA.

Uruchom z katalogu głównego repozytorium:
    python scraper/audit_stop_locations.py
"""

from __future__ import annotations

import json
import math
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def normalize_name(name: str) -> str:
    name = name.upper().replace("ŻYR.", "ŻYRARDÓW").replace("ZYR.", "ŻYRARDÓW")
    name = re.sub(r"\s*\[\d+\]\s*$", "", name)
    name = unicodedata.normalize("NFKD", name)
    name = "".join(char for char in name if not unicodedata.combining(char))
    return re.sub(r"[^A-Z0-9]+", " ", name).strip()


def distance_m(first: tuple[float, float], second: tuple[float, float]) -> float:
    radius = 6_371_000
    lat1, lon1 = map(math.radians, first)
    lat2, lon2 = map(math.radians, second)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    value = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(value))


def collect_route_platforms(timetables: dict) -> tuple[dict[str, dict], set[str], list[str]]:
    platforms: dict[str, dict] = {}
    schedule_names: set[str] = set()
    errors: list[str] = []

    for line in timetables.get("lines", []):
        for direction_index, direction in enumerate(line.get("directions", [])):
            names = direction.get("stops", [])
            full = direction.get("stops_full") or []
            if len(names) != len(full):
                errors.append(
                    f"Linia {line.get('number')}, kierunek {direction_index}: "
                    f"{len(names)} nazw i {len(full)} rekordów stops_full"
                )
            schedule_names.update(normalize_name(name) for name in names)

            for index, stop in enumerate(full):
                if not stop.get("lat") or not stop.get("lon"):
                    errors.append(f"Brak GPS: linia {line.get('number')}, pozycja {index}")
                    continue
                designator = stop.get("designator")
                stop_id = stop.get("id")
                identity = f"designator:{designator}" if designator is not None else f"id:{stop_id}"
                record = {
                    "id": str(stop_id) if stop_id else None,
                    "designator": designator,
                    "name": stop.get("official_name") or stop.get("name") or names[index],
                    "lat": float(stop["lat"]),
                    "lon": float(stop["lon"]),
                }
                previous = platforms.get(identity)
                if previous and distance_m((previous["lat"], previous["lon"]), (record["lat"], record["lon"])) > 1:
                    errors.append(f"Sprzeczne współrzędne dla {identity}")
                platforms.setdefault(identity, record)

    return platforms, schedule_names, errors


def main() -> int:
    timetables = json.loads((ROOT / "public/timetables.json").read_text(encoding="utf-8"))
    fallback = json.loads((ROOT / "public/stops_gps.json").read_text(encoding="utf-8"))
    platforms, schedule_names, errors = collect_route_platforms(timetables)

    fallback_by_designator = {
        str(value.get("designator")): value
        for value in fallback.values()
        if value.get("designator") is not None
    }
    missing_fallback = [
        stop for stop in platforms.values()
        if stop.get("designator") is not None and str(stop["designator"]) not in fallback_by_designator
    ]
    errors.extend(f"Brak stanowiska {stop['designator']} w public/stops_gps.json" for stop in missing_fallback)

    platform_names = {normalize_name(stop["name"]) for stop in platforms.values()}
    missing_names = sorted(schedule_names - platform_names)
    errors.extend(f"Brak współrzędnych dla nazwy: {name}" for name in missing_names)

    by_name: dict[str, list[dict]] = defaultdict(list)
    for stop in platforms.values():
        by_name[normalize_name(stop["name"])].append(stop)
    multi_platform = {name: stops for name, stops in by_name.items() if len(stops) > 1}

    separated = []
    for name, stops in multi_platform.items():
        max_distance = max(
            distance_m((first["lat"], first["lon"]), (second["lat"], second["lon"]))
            for index, first in enumerate(stops)
            for second in stops[index + 1:]
        )
        if max_distance >= 100:
            separated.append((max_distance, name, stops))

    print("Audyt stanowisk ŻPA")
    print(f"  Nazwy rozkładowe:       {len(schedule_names)}")
    print(f"  Fizyczne stanowiska:    {len(platforms)}")
    print(f"  Nazwy wielostanowiskowe:{len(multi_platform):>5}")
    print(f"  Rekordy fallback:       {len(fallback)}")
    print(f"  Błędy krytyczne:        {len(errors)}")

    if separated:
        print("\nStanowiska o tej samej nazwie oddalone o co najmniej 100 m (do ręcznej kontroli):")
        for max_distance, name, stops in sorted(separated, reverse=True):
            numbers = ", ".join(str(stop.get("designator") or "?") for stop in stops)
            print(f"  {max_distance:6.1f} m  {name}  [{numbers}]")

    if errors:
        print("\nBłędy:")
        for error in errors:
            print(f"  - {error}")
        return 1

    print("\n✓ Dane są strukturalnie spójne; lista odległych par wymaga tylko kontroli geograficznej.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
