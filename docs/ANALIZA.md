# Analiza repozytorium `zpa-zyrardow`

Data analizy: 2026-08-22
Branch: `arena/01a02ab3-zpa-zyrardow` (z main `38f0017`)

## 1. Cel projektu

**ŻPA Żyrardów – Rozkład Jazdy Live v2 AUTO** – nowoczesna, mobile-first aplikacja SPA (Single Page Application) pokazująca rozkład jazdy Żyrardowskich Przewozów Autobusowych.

- Źródło danych: PDFy ze stron `zpa.powiat-zyrardowski.pl` i `pksgostynin.pl`, plus live API `pksgostynin.kiedyprzyjedzie.pl/stops` dla GPS przystanków.
- Hosting: statyczny (GitHub Pages / Vercel / Cloudflare) – wystarczy serwować pliki, bez backendu.
- PWA: instalowalna na Android, działa offline.

## 2. Struktura plików

```
/index.html              – CAŁA aplikacja (1419 linii, 202KB), JS + HTML + CSS inline
/manifest.json           – PWA manifest
/sw.js                   – Service Worker v9
/timetables.json         – Baza rozkładów (11 linii, 537 wpisów, 190KB)
/stops_gps.json + .js    – 70+ przystanków Żyrardowa z GPS z API kiedyprzyjedzie.pl
/stops_corrected.json/.js – 10 ręcznie poprawionych punktów (placeholder, niepełne)
/scraper/
  scraper.py             – scraper PDFów (requests + bs4 + pdfplumber)
  requirements.txt
/update_stops.py         – skrypt aktualizujący stops_gps.* z API
/icons/                  – 5 ikon PWA (192, 512, maskable, 180)
/README.md
/.gitignore              – zawiera dziwny wpis: "Nothing should be ignored..."
```

Brak `.github/workflows/scrape.yml` opisanego w README – workflow nie istnieje.

## 3. Architektura & technologie

- **Frontend**: Vanilla JS (bez frameworka, bez builda), TailwindCSS via CDN (`cdn.tailwindcss.com`), Leaflet 1.9.4 dla map, Geist font z Google Fonts.
- **Dane**: 
  - `timetables.json` – format `{meta, lines[]}`, gdzie `lines[].directions[].baseTimes = {weekday, saturday, sunday}` + `stops[]` + `stops_full[]` z `lat/lon`, `id`, `designator`.
  - Fallback: `BUS_DATA_FALLBACK` zaszyty w `index.html` (~150KB) jeśli fetch zawiedzie.
  - Cache: `localStorage` – `zpa_data`, `zpa_data_hash`, `zpa_state_v2`, `zpa_favorites_v1`, `zpa_recents`, `kiedy_stops_cache`, `osrm_*`.
- **PWA**: `manifest.json` (standalone, theme #059669), `sw.js` z 3 strategiami: NETWORK_FIRST dla JSON i kiedyprzyjedzie, STALE-WHILE-REVALIDATE dla CDN, CACHE_FIRST dla shell.
- **Mapa**: OSM tiles + OSRM public server (`router.project-osrm.org`) do rysowania tras wzdłuż ulic (z cache w localStorage).
- **Backend**: brak – całość statyczna. Scraper w Pythonie ma być odpalany cronem.

## 4. Jak działa aplikacja (przepływ)

```
loadKiedyLiveStops() -> fetch https://pksgostynin.kiedyprzyjedzie.pl/stops
   -> filtr Żyrardów + merge do STOP_COORDS (global z stops_gps.js)
loadTimetables() -> fetch ./timetables.json?v=timestamp no-cache
   -> sukces: save localStorage + LIVE badge + porównaj hash -> banner "Nowy rozkład!"
   -> fail: weź localStorage cache, albo BUS_DATA_FALLBACK
-> renderAll():
   linie, kierunki, przystanki, rozkład godzinowy (grupowany per godzina), nextBus countdown, trip progress
-> 4 widoki (view-tab):
   - Linie (domyślny): grid linii, lista przystanków, rozkład, next bus panel
   - Przystanki: unikalne przystanki (78 unikalnych), wszystkie linie przez przystanek, najbliższe odjazdy
   - Od→Do: wyszukiwanie bezpośrednich połączeń (fuzzy match), szacowanie czasu +2min/przystanek
   - Mapa: Leaflet, pinezki, filtrowanie per linia, rysowanie tras via OSRM, locateBtn
-> PWA install banner (beforeinstallprompt), Service Worker registration, online/offline indicators
```

Logika czasu: `baseTimes` to godziny odjazdu z pierwszego przystanku; dla przystanku `idx` dodawane jest `idx*2 minuty` (`addMinutes(t, idx*2)`).

## 5. Funkcjonalności

- 11 linii (0,1,2,3,4,5,7,8,9,10), miejska/podmiejska, kolory Tailwind
- 3 typy dnia: weekday/saturday/sunday
- Wyszukiwanie przystanków (desktop + mobile)
- Ulubione (localStorage), Ostatnio sprawdzane, udostępnianie (Web Share API)
- Zegar live, countdown do następnego autobusu
- Mapa z real GPS (62 zweryfikowanych wg opisu), trasy wzdłuż ulic, numeracja przystanków w kolejności
- Responsywność, dark mode (class toggle + localStorage)

## 6. Mocne strony

- Zero zależności build – działa po wrzuceniu na statyczny hosting.
- Pomysł z `timetables.json` + bannerem "Nowy rozkład!" – prosty, skuteczny auto-update bez backendu.
- Bogate dane GPS: `stops_full` z id/designator/lat/lon per kierunek, uwzględnia obie strony ulicy.
- PWA komplet: manifest, sw.js z precache, install prompt, offline fallback.
- UX mobile-first: duże tap targety, glass header, Tailwind, animacje.
- Mapa: integracja z OSM + OSRM to duży plus – trasy nie są prostymi liniami.
- Obsługa dayTypes (D/C realne oznaczenia z PKS) w timetables.json.

## 7. Słabe strony / dług techniczny / bugi

**Krytyczne:**
1. **Monolit `index.html` 202KB / 1419 linii** – cały JS w jednym `<script>`, trudny do utrzymania, brak modułów, brak testów, brak lintera. Fallback data duplikuje `timetables.json`.
2. **Tailwind CDN w produkcji** – `cdn.tailwindcss.com` generuje CSS runtime, duży, nie cachowany efektywnie, nie nadaje się na prod. Brak purge.
3. **Brak workflow** – README opisuje `.github/workflows/scrape.yml` (cron 04:00), ale plik nie istnieje. Scraper nie działa automatycznie.
4. **`stops_corrected.*` niekompletny** – 10 placeholderów z fikcyjnymi ID (DWORZEC_PKP, SZPITAL) nie mapuje się na realne nazwy ŻPA. Funkcja `loadCorrectedStops()` ma słabą logikę fuzzy i może nadpisać złe przystanki.
5. **OSRM public demo** – `router.project-osrm.org` ma rate limit, brak SLA, może zablokować. Brak fallback do straight line jeśli fetch zawiedzie (częściowo jest, ale popup "Rysuję trasę..." może wisieć).
6. **CORS dla `kiedyprzyjedzie.pl`** – fetch do `pksgostynin.kiedyprzyjedzie.pl/stops` i `/kiedyprzyjedzie.pl` może być blokowany; SW próbuje cache'ować, ale bez `Access-Control-Allow-Origin` może failować w niektórych przeglądarkach.
7. **`.gitignore` błędny** – zawiera zdanie zamiast patternów; `scraper/__pycache__` jest ztrackowany.
8. **Brak walidacji danych** – `timetables.json` ma duplikaty nazw (`ŻYRARDÓW D` występuje 3x pod rząd, `KORYTÓW` 5x), brak normalizacji.
9. **Wydajność**: `getUniqueStops()` iteruje po wszystkich liniach za każdym razem, bez memoizacji; mapa tworzy 70+ markerów + polylines bez klasteryzacji – na słabych Androidach może lagować.
10. **Bezpieczeństwo**: `innerHTML` z danymi z JSON bez sanitizacji (XSS jeśli PDF zawiera HTML), `verify=False` w scraperze (ignorowanie certyfikatów).
11. **Dostępność**: brak ARIA, brak keyboard nav dla mapy, brak lang dla dynamicznych treści.
12. **i18n**: tylko PL, ale meta `lang=pl` ok.

**Mniejsze:**
- `stops_gps.js` i `stops_corrected.js` ładowane synchronicznie w `<head>` – blokują render.
- `BUS_DATA_FALLBACK` w HTML sprawia, że każda zmiana wymaga edycji 2 plików.
- Brak wersjonowania cache w localStorage poza hash długości – kolizje możliwe.
- Brak GTFS, brak eksportu do Google Maps (wspomniane w TODO).

## 8. Scraper – ocena

- `scraper.py`: pobiera listę PDFów via BeautifulSoup, liczy hash (opisowo), parsuje via `pdfplumber` (tabele + regex na godziny). Obecnie tylko aktualizuje `meta` – pełny parser TODO.
- `update_stops.py`: lepszy – pobiera JSON z API, filtruje ŻYRARDÓW, deduplikuje po nazwie z kodem `[1234]`, generuje `stops_gps.json/js`.
- Brak testów, brak obsługi błędów sieci (retry), brak logowania.
- `requirements.txt` ok, ale brak `requirements` dla `update_stops.py` (requests).

## 9. PWA / SW

- `sw.js` v9 – dobre strategie, ale `SHELL_ASSETS` zawiera `/index.html` i `./index.html` (duplikat) oraz absolutne `/` co może failować na GitHub Pages z subpath (np. `/zpa-zyrardow/`). Powinien używać `self.registration.scope`.
- Brak `skipWaiting` UI – użytkownik nie wie, że jest nowa wersja SW (tylko console + status badge).
- Icons: brak `icon-180.png` w manifest (jest tylko apple-touch-icon), ale jest w precache.

## 10. Rekomendacje

**Krótkoterminowe (1-2 dni):**
- Rozbić `index.html` na `app.js`, `styles.css`, `data.js` – wprowadzić Vite lub Parcel.
- Zamienić Tailwind CDN na build z purge.
- Naprawić `.gitignore`: `__pycache__/`, `*.pyc`, `.venv`, `node_modules/`, `dist/`.
- Dodać brakujący workflow `scrape.yml` + `update_stops.yml`.
- Usunąć `stops_corrected.*` placeholder lub uzupełnić realnymi korektami (np. D.A. = 52.0524,20.4473 już jest ok).
- Dodać `leaflet.markercluster` dla mapy.
- Dodać fallback dla OSRM: jeśli fetch fail -> rysuj straight line, bez popup blokującego.
- Dodać sanitizację `textContent` zamiast `innerHTML` gdzie możliwe.

**Średnioterminowe:**
- Walidator `timetables.json` (JSON schema) + skrypt czyszczący duplikaty.
- Wprowadzić TypeScript + testy (Vitest) dla logiki `addMinutes`, `findDirectRoutes`.
- PWA: dodać Workbox, background sync dla timetables.
- Mapa: przenieść OSRM na własny backend lub użyć GraphHopper / OSRM self-hosted.
- Dodać GTFS export – pozwoli dodać ŻPA do Google Maps.
- Dodać CI: `python -m py_compile`, `jsonlint`.

**Długoterminowe:**
- Backend API (np. Cloudflare Worker) proxy dla `kiedyprzyjedzie.pl` – rozwiązuje CORS + cache.
- Live GPS autobusów – integracja z API KiedyPrzyjedzie (jeśli mają vehicle positions).
- Aplikacja React/Next.js PWA z offline-first IndexedDB zamiast localStorage.

## 11. Podsumowanie

Projekt jest **bardzo pomysłowy i funkcjonalny jak na statyczny hosting** – pokazuje, że można zrobić użyteczną PWA dla komunikacji miejskiej bez backendu. Największa wartość to **realne dane GPS i rozkłady z dayTypes**. Główny problem to **monolityczny `index.html` i brak automatyzacji scrapera**. Po rozbiciu na moduły, naprawieniu `.gitignore` i dodaniu workflow, będzie gotowy do produkcji na GitHub Pages.

Ocena ogólna: 7/10 – działa, ma PWA, ma mapę, ale wymaga refaktoru przed skalowaniem.

---
Wygenerowano automatycznie przez analizę repo.
