#!/usr/bin/env python3
"""
Skrypt aktualizujący dane przystanków z API pksgostynin.kiedyprzyjedzie.pl
- Pobiera aktualne dane z API
- Filtruje przystanki Żyrardowa
- Usuwa duplikaty (zachowuje wersję z kodem ID)
- Generuje pliki stops_gps.json i stops_gps.js
"""

import json
import requests
from datetime import datetime
import re

API_URL = "https://pksgostynin.kiedyprzyjedzie.pl/stops"

def fetch_stops():
    """Pobierz dane przystanków z API"""
    print(f"Pobieranie danych z {API_URL}...")
    response = requests.get(API_URL, timeout=30)
    response.raise_for_status()
    data = response.json()
    print(f"Liczba wszystkich przystanków: {len(data['stops'])}")
    return data['stops']

def filter_zyrardow_stops(stops):
    """Filtruj tylko przystanki Żyrardowa"""
    zyrardow_stops = []
    for stop in stops:
        # stop = [id, code, name, lon, lat, ...]
        name = stop[2]
        if 'ŻYRARDÓW' in name.upper() or 'ZYRARDOW' in name.upper():
            zyrardow_stops.append(stop)
    print(f"Liczba przystanków Żyrardowa: {len(zyrardow_stops)}")
    return zyrardow_stops

def normalize_name(name):
    """Normalizuj nazwę przystanku"""
    # Usuń podwójne spacje
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def deduplicate_stops(stops):
    """
    Usuń duplikaty przystanków.
    Strategia: 
    - Grupuj po normalizowanej nazwie
    - Zachowaj wersję z kodem ID w nawiasie jeśli istnieje
    - Jeśli brak kodu, zachowaj pierwszą wersję
    """
    # Grupowanie po nazwie (bez kodu w nawiasie)
    groups = {}
    
    for stop in stops:
        stop_id, code, name, lon, lat = stop[0], stop[1], stop[2], stop[3], stop[4]
        
        # Sprawdź czy nazwa zawiera kod w nawiasie np. "[6876]"
        match = re.match(r'^(.+?)\s*\[(\d+)\]$', name)
        if match:
            base_name = match.group(1).strip()
            stop_code = match.group(2)
        else:
            base_name = name.strip()
            stop_code = None
        
        # Normalizuj bazową nazwę
        normalized = normalize_name(base_name)
        
        if normalized not in groups:
            groups[normalized] = []
        
        groups[normalized].append({
            'full_name': name,
            'base_name': base_name,
            'code': stop_code,
            'stop_id': stop_id,
            'lat': lat / 1e6,
            'lon': lon / 1e6
        })
    
    # Wybierz najlepszą wersję z każdej grupy
    result = {}
    for normalized, variants in groups.items():
        # Priorytet: wersja z kodem > wersja bez kodu
        with_code = [v for v in variants if v['code']]
        without_code = [v for v in variants if not v['code']]
        
        if with_code:
            # Wybierz pierwszą wersję z kodem
            best = with_code[0]
            # Dodaj też wersję bez kodu jako alias (dla kompatybilności)
            result[f"{best['base_name']} [{best['code']}]"] = {
                'lat': best['lat'],
                'lon': best['lon']
            }
            # Dodaj alias bez kodu
            result[best['base_name']] = {
                'lat': best['lat'],
                'lon': best['lon']
            }
        elif without_code:
            best = without_code[0]
            result[best['full_name']] = {
                'lat': best['lat'],
                'lon': best['lon']
            }
    
    return result

def generate_files(stops_data, version):
    """Generuj pliki JSON i JS"""
    
    # stops_gps.json
    json_output = json.dumps(stops_data, ensure_ascii=False, indent=2)
    with open('stops_gps.json', 'w', encoding='utf-8') as f:
        f.write(json_output)
    print(f"Zapisano stops_gps.json ({len(stops_data)} przystanków)")
    
    # stops_gps.js
    js_content = f"""// Auto-generated from pksgostynin.kiedyprzyjedzie.pl API
// Generated: {datetime.now().isoformat()}
// Version: {version}
const STOP_COORDS = {json.dumps(stops_data, ensure_ascii=False, indent=2)};

if (typeof module !== 'undefined' && module.exports) {{
    module.exports = {{ STOP_COORDS }};
}}
"""
    with open('stops_gps.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"Zapisano stops_gps.js")

def main():
    print("=" * 60)
    print("Aktualizacja danych przystanków Żyrardowa")
    print("=" * 60)
    
    # Pobierz dane
    all_stops = fetch_stops()
    
    # Filtruj Żyrardów
    zyrardow_stops = filter_zyrardow_stops(all_stops)
    
    # Usuń duplikaty
    cleaned_stops = deduplicate_stops(zyrardow_stops)
    print(f"Liczba unikalnych przystanków po czyszczeniu: {len(cleaned_stops)}")
    
    # Generuj wersję
    version = datetime.now().strftime("%Y-%m-%d")
    
    # Generuj pliki
    generate_files(cleaned_stops, version)
    
    # Wyświetl przykładowe przystanki
    print("\nPrzykładowe przystanki:")
    for i, (name, coords) in enumerate(list(cleaned_stops.items())[:10]):
        print(f"  {name}: {coords['lat']:.6f}, {coords['lon']:.6f}")
    
    print("\n✓ Aktualizacja zakończona pomyślnie!")

if __name__ == "__main__":
    main()
