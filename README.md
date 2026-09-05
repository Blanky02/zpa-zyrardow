# ŻPA Żyrardów - Rozkład Jazdy Live v3 MUI

Nowoczesna, responsywna aplikacja **Rozkład Jazdy** dla komunikacji miejskiej w Żyrardowie – **Mobile-First**, PWA, **Material UI (MUI) + React + Vite**.

## v3 MUI – Co nowego?

✅ **Przepisane na Vite + React + MUI v6** – zamiast monolitu 202KB w `index.html`, teraz moduły, HMR, code-splitting
✅ **Material Design 3 (Material You)** – TopAppBar, Cards 24-28px, Chips, FAB, Bottom Navigation, Snackbar, dynamic theme (light/dark)
✅ **UX dla mieszkańców** – szybki dostęp do ulubionych, ostatnich, next bus countdown, offline-first
✅ **Bottom Navigation na mobile** – Linie / Przystanki / Od→Do / Mapa (80px, jak w Android)
✅ **Zachowane dane** – `timetables.json`, `stops_gps.json`, godziny **wprost z PDF-ów** (również na przystankach pośrednich), OSRM routing

## Godziny z PDF-ów (nie „kiedy przyjedzie”)

Wszystkie godziny odjazdów **i przyjazdów na każdym przystanku** pochodzą z tabel
oficjalnych PDF-ów PKS Gostynin / ŻPA (`zpa.powiat-zyrardowski.pl`, `pksgostynin.pl`):

- scraper parsuje tabele PDF (pdfplumber) i zapisuje `direction.stopsTimes`:
  `{ weekday: [[kurs: HH:MM|null per przystanek], ...], saturday: [...], sunday: [...] }`,
- oznaczenia dni kursu (D / 6 / 7+ / C) czytane z nagłówków i legendy PDF,
- przy kilku wersjach rozkładu wybierany jest PDF „ważny od” aktualny na dziś,
- przybliżenie „+2 min na przystanek” zostało tylko jako fallback dla starych
  danych bez `stopsTimes` (offline fallback),
- API `kiedyprzyjedzie.pl` służy wyłącznie do współrzędnych GPS przystanków na mapie –
  **żadne godziny nie pochodzą z tej usługi**.

```
User -> Vite Dev Server (0.0.0.0:5173, allowedHosts: true)
  -> fetch timetables.json (public/) + stops_gps.json
  -> godziny z timetables.json (tabela PDF per przystanek)
  -> live fetch kiedyprzyjedzie.pl/stops (tylko współrzędne na mapę)
  -> localStorage cache + hash -> banner "Nowy rozkład!"
  -> MUI Theme (primary #006A60 ŻPA green)
```

## Struktura v3

```
/index.html          – Vite entry (root div)
/src/
  main.jsx           – React root
  App.jsx            – State, clock, PWA install, view switcher
  theme.js           – MUI M3 theme (light/dark, containers, typography)
  data/fallback.js   – BUS_DATA_FALLBACK (legacy)
  utils/
    time.js          – parseMinutes, addMinutes, getScheduleForStop
    storage.js       – localStorage helpers (state, favs, recents)
    stops.js         – getUniqueStops, findDirectRoutes, colors
  hooks/
    useTimetables.js – fetch timetables + live stops + offline fallback
  components/
    TopAppBar.jsx    – M3 TopAppBar + search + status + clock
    BottomNav.jsx    – M3 Bottom Navigation (mobile)
    LinesView.jsx    – Grid linii (MUI Cards), przystanki (List), rozkład (Chips), next bus (primary Card)
    StopsView.jsx    – Unikalne przystanki, odjazdy z przystanku
    RouteView.jsx    – Od→Do planner, swap, direct routes
    MapView.jsx      – react-leaflet + OSRM routing + CircleMarker
/public/
  timetables.json    – Baza rozkładów (generowana przez scraper z PDF-ów)
  stops_gps.json     – GPS przystanków
  manifest.json      – PWA
  sw.js              – Service Worker v9
  icons/             – PWA icons
/scraper/
  scraper.py         – Pobiera PDFy ZPA/PKS i parsuje tabele
  pdf_timetables.py  – Parser tabel PDF -> godziny per przystanek (stopsTimes)
  test_pdf_timetables.py – Testy parsera (python3 scraper/test_pdf_timetables.py)
archive/legacy.html  – Stara wersja v2 (backup)
```

## Jak uruchomić v3

```bash
npm install
npm run dev   # http://localhost:5173 – host 0.0.0.0 dla Arena preview
npm run build # dist/
npm run preview
```

Wymagania: Node 20+

Stary `index.html` v2 jest w `archive/legacy.html` – nadal działa jeśli otworzysz bezpośrednio.

## Material UI – decyzje

- **Primary #006A60** – ŻPA brand green zamiast Google purple #6750A4 (rozpoznawalność dla mieszkańców)
- **MUI v6** – AppBar, Card 24-28px radius, Chip 8px, Button 20px, elevation 0-2
- **Typography M3** – titleMedium, labelSmall, bodySmall itd. zdefiniowane w theme.js
- **Mobile-first** – BottomNav 80px, FAB odśwież, search w AppBar (desktop) + osobny na mobile
- **Residents** – ulubione ❤️, ostatnio, next bus countdown 56px mono, trip progress LinearProgress

## PWA – vite-plugin-pwa ✅

- **vite-plugin-pwa v1.3.0** – auto-generuje `dist/sw.js` + `workbox-*.js` + `manifest.webmanifest`
- `registerSW` z `virtual:pwa-register` w `main.jsx` – event `pwa-update-available` -> banner "Nowa wersja"
- Runtime caching:
  - `timetables.json` – NetworkFirst (5s timeout, 24h cache)
  - `stops_gps.json` – NetworkFirst (7 dni)
  - `kiedyprzyjedzie.pl` – NetworkFirst (1h)
  - `OSRM` + `OSM tiles` + `Google Fonts` – CacheFirst (30 dni / 1 rok)
- Install banner (beforeinstallprompt) + new data banner (hash timetables) + PWA update banner
- Offline: Workbox precache 26 entries (1.5MB) + localStorage cache + fallback.js

## Lazy loading ✅

- **Przed:** 1 chunk `index 623KB (188KB gzip)` – wszystko naraz
- **Po:** 
  - `mui 417KB (128KB gzip)` – cache'owany raz
  - `leaflet 155KB (45KB gzip)` – tylko dla mapy
  - `fallback 94KB (9KB gzip)`
  - `index 36KB (11KB gzip)` – LinesView (codzienne użycie mieszkańca)
  - `MapView 7KB`, `RouteView 6.5KB`, `StopsView 5.8KB` – ładowane lazy via `React.lazy() + Suspense`
- Mieszkaniec sprawdzający linię 1 pobiera ~200KB initial zamiast 623KB, mapa ładuje się dopiero po kliknięciu "Mapa"

```jsx
const MapView = lazy(() => import('./components/MapView.jsx'));
<Suspense fallback={<Skeleton />}><MapView /></Suspense>
```

## GitHub Actions cron ✅

- `.github/workflows/scrape.yml` – codziennie `0 4 * * *` UTC (05:00/06:00 PL)
- Steps: checkout, setup-python 3.11, pip install, test parsera, `scraper.py`
  (pobiera PDFy -> `stopsTimes` + raport `scraper/audits/pdf_times_report.json`),
  `update_stops.py` (współrzędne GPS), copy to `public/`, commit + push jeśli się zmieniło
- Drugi job `build-check` – `npm ci && npm run build` + upload artifact `dist/`
- Ręczne uruchomienie: `workflow_dispatch` z GitHub UI
- Efekt: użytkownik rano widzi banner "Nowy rozkład!" automatycznie

## Co dalej?

- [ ] Testy: Vitest dla time.js, stops.js
- [ ] GTFS export, live GPS autobusów (vehicle positions)
- [ ] WCAG AA audit, powiększanie czcionki, głosowe wyszukiwanie
- [ ] Deploy na GitHub Pages via `peaceiris/actions-gh-pages`

Autor: v3 MUI – Vite + React + MUI dla mieszkańców Żyrardowa.
