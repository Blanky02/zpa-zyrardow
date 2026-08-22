#!/usr/bin/env python3
"""Porównuje każde fizyczne stanowisko ŻPA z przystankami OpenStreetMap.

Skrypt pobiera aktualne węzły i platformy OSM przez Overpass, dobiera najlepszy
punkt według odległości i podobieństwa nazwy, a następnie zapisuje raport JSON
i Markdown. Nie modyfikuje współrzędnych aplikacji automatycznie.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import time
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
OVERPASS_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)


def normalize_name(name: str) -> str:
    replacements = {
        "ŻYR.": "ŻYRARDÓW ",
        "ZYR.": "ŻYRARDÓW ",
        "AL.": "ALEJA ",
        "PDT": "",
        "D.A.": "DWORZEC AUTOBUSOWY",
        "PKP": "DWORZEC",
    }
    name = name.upper()
    for source, target in replacements.items():
        name = name.replace(source, target)
    name = re.sub(r"\s*\[\d+\]\s*$", "", name)
    name = unicodedata.normalize("NFKD", name)
    name = "".join(char for char in name if not unicodedata.combining(char))
    words = re.sub(r"[^A-Z0-9]+", " ", name).split()
    ignored = {"ZYRARDOW", "PRZYSTANEK", "UL", "ULICA"}
    return " ".join(word for word in words if word not in ignored)


def name_similarity(first: str, second: str) -> float:
    left, right = normalize_name(first), normalize_name(second)
    if not left or not right:
        return 0.0
    left_tokens, right_tokens = set(left.split()), set(right.split())
    token_score = len(left_tokens & right_tokens) / max(1, len(left_tokens | right_tokens))
    sequence_score = SequenceMatcher(None, left, right).ratio()
    containment = 1.0 if left in right or right in left else 0.0
    return max(token_score, sequence_score * 0.85, containment)


def distance_m(first: dict, second: dict) -> float:
    radius = 6_371_000
    lat1, lat2 = math.radians(first["lat"]), math.radians(second["lat"])
    dlat = math.radians(second["lat"] - first["lat"])
    dlon = math.radians(second["lon"] - first["lon"])
    value = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(value))


def load_platforms(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    seen: dict[str, dict] = {}
    for key, value in data.items():
        if not value.get("lat") or not value.get("lon"):
            continue
        identity = f"designator:{value.get('designator')}" if value.get("designator") is not None else f"id:{value.get('id') or key}"
        seen[identity] = {
            "id": value.get("id"),
            "designator": value.get("designator"),
            "name": value.get("name") or re.sub(r"\s*\[\d+\]\s*$", "", key),
            "lat": float(value["lat"]),
            "lon": float(value["lon"]),
            "source": value.get("source", "unknown"),
        }
    return list(seen.values())


def fetch_osm_stops(platforms: list[dict]) -> tuple[list[dict], str]:
    padding = 0.012
    south = min(stop["lat"] for stop in platforms) - padding
    north = max(stop["lat"] for stop in platforms) + padding
    west = min(stop["lon"] for stop in platforms) - padding
    east = max(stop["lon"] for stop in platforms) + padding
    bbox = f"{south},{west},{north},{east}"
    query = f"""
[out:json][timeout:90];
(
  nwr[\"highway\"=\"bus_stop\"]({bbox});
  nwr[\"public_transport\"=\"stop_position\"]({bbox});
  nwr[\"public_transport\"=\"platform\"]({bbox});
);
out center tags;
"""
    headers = {"User-Agent": "zpa-zyrardow-stop-audit/1.0 (GitHub Actions)"}
    last_error = None

    for attempt in range(4):
        for url in OVERPASS_URLS:
            try:
                response = requests.post(url, data={"data": query}, headers=headers, timeout=120)
                response.raise_for_status()
                payload = response.json()
                points = []
                for element in payload.get("elements", []):
                    lat = element.get("lat") or element.get("center", {}).get("lat")
                    lon = element.get("lon") or element.get("center", {}).get("lon")
                    if lat is None or lon is None:
                        continue
                    tags = element.get("tags", {})
                    points.append({
                        "osm_id": element.get("id"),
                        "osm_type": element.get("type"),
                        "name": tags.get("name", ""),
                        "lat": float(lat),
                        "lon": float(lon),
                        "public_transport": tags.get("public_transport"),
                        "highway": tags.get("highway"),
                    })
                return points, url
            except Exception as error:  # noqa: BLE001 - retry another public mirror
                last_error = error
        time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"Nie udało się pobrać danych Overpass: {last_error}")


def choose_match(platform: dict, osm_points: list[dict]) -> dict | None:
    nearby = []
    for point in osm_points:
        distance = distance_m(platform, point)
        if distance > 500:
            continue
        similarity = name_similarity(platform["name"], point["name"])
        # Prefer a close point, but penalize a completely unrelated stop name.
        score = distance + (1 - similarity) * 55
        nearby.append((score, distance, -similarity, point, similarity))
    if not nearby:
        return None
    _, distance, _, point, similarity = min(nearby, key=lambda item: (item[0], item[1]))
    return {**point, "distance_m": round(distance, 1), "name_similarity": round(similarity, 3)}


def classify(match: dict | None) -> str:
    if not match:
        return "missing"
    distance, similarity = match["distance_m"], match["name_similarity"]
    if distance <= 35 and (similarity >= 0.25 or distance <= 12):
        return "confirmed"
    if distance <= 60 and (similarity >= 0.2 or distance <= 20):
        return "probable"
    return "review"


def build_report(platforms: list[dict], osm_points: list[dict], endpoint: str) -> dict:
    entries = []
    for platform in sorted(platforms, key=lambda item: (normalize_name(item["name"]), item.get("designator") or 0)):
        match = choose_match(platform, osm_points)
        entries.append({
            "platform": platform,
            "osm": match,
            "status": classify(match),
        })
    counts = {status: sum(entry["status"] == status for entry in entries) for status in ("confirmed", "probable", "review", "missing")}
    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "overpass_endpoint": endpoint,
        "platform_count": len(platforms),
        "osm_candidate_count": len(osm_points),
        "counts": counts,
        "entries": entries,
    }


def write_markdown(report: dict, path: Path) -> None:
    counts = report["counts"]
    lines = [
        "# Audyt lokalizacji przystanków ŻPA względem OpenStreetMap",
        "",
        f"Wygenerowano: `{report['generated_at']}`  ",
        f"Stanowiska ŻPA: **{report['platform_count']}**  ",
        f"Kandydaci OSM w obszarze: **{report['osm_candidate_count']}**",
        "",
        "## Podsumowanie",
        "",
        f"- ✅ Potwierdzone: **{counts['confirmed']}**",
        f"- 🟡 Prawdopodobne: **{counts['probable']}**",
        f"- 🟠 Do kontroli: **{counts['review']}**",
        f"- 🔴 Brak odpowiednika OSM: **{counts['missing']}**",
        "",
        "## Stanowiska wymagające uwagi",
        "",
        "| Stanowisko | Nazwa API | Najlepszy punkt OSM | Odległość | Zgodność nazwy | Status |",
        "|---:|---|---|---:|---:|---|",
    ]
    attention = [entry for entry in report["entries"] if entry["status"] != "confirmed"]
    for entry in sorted(attention, key=lambda item: (item["status"], -(item.get("osm") or {}).get("distance_m", 9999))):
        platform, osm = entry["platform"], entry.get("osm")
        if osm:
            osm_label = f"{osm.get('name') or '(bez nazwy)'} (`{osm['osm_type']}/{osm['osm_id']}`)"
            distance = f"{osm['distance_m']:.1f} m"
            similarity = f"{osm['name_similarity']:.0%}"
        else:
            osm_label, distance, similarity = "—", "—", "—"
        lines.append(
            f"| {platform.get('designator') or '—'} | {platform['name']} | {osm_label} | {distance} | {similarity} | {entry['status']} |"
        )
    if not attention:
        lines.append("| — | Wszystkie stanowiska potwierdzone | — | — | — | confirmed |")
    lines.append("")
    lines.append("> Automatyczny wynik wskazuje kandydatów. Pozycje `review` należy sprawdzić wizualnie przed zmianą danych API.")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stops", type=Path, default=ROOT / "public/stops_gps.json")
    parser.add_argument("--json", type=Path, default=ROOT / "stop_location_osm_report.json")
    parser.add_argument("--markdown", type=Path, default=ROOT / "STOP_LOCATION_OSM_AUDIT.md")
    args = parser.parse_args()

    platforms = load_platforms(args.stops)
    osm_points, endpoint = fetch_osm_stops(platforms)
    report = build_report(platforms, osm_points, endpoint)
    args.json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_markdown(report, args.markdown)

    print(json.dumps(report["counts"], ensure_ascii=False))
    print("Stanowiska niepotwierdzone automatycznie:")
    attention = [entry for entry in report["entries"] if entry["status"] != "confirmed"]
    for entry in attention:
        platform, osm = entry["platform"], entry.get("osm")
        if osm:
            print(
                f"  [{entry['status']}] {platform.get('designator') or '?'} {platform['name']} -> "
                f"{osm.get('name') or '(bez nazwy)'} ({osm['distance_m']:.1f} m, OSM {osm['osm_type']}/{osm['osm_id']})"
            )
        else:
            print(f"  [missing] {platform.get('designator') or '?'} {platform['name']} -> brak punktu OSM")
    print(f"Raport Markdown: {args.markdown}")
    print(f"Raport JSON: {args.json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
