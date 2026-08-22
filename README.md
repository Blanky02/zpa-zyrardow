# ŻPA Żyrardów - Rozkład Jazdy Live v3 MUI

Nowoczesna, responsywna aplikacja **Rozkład Jazdy** dla komunikacji miejskiej w Żyrardowie – **Mobile-First**, PWA, **Material UI (MUI) + React + Vite**.

## v3 MUI – Co nowego?

✅ **Przepisane na Vite + React + MUI v6** – zamiast monolitu 202KB w `index.html`, teraz moduły, HMR, code-splitting
✅ **Material Design 3 (Material You)** – TopAppBar, Cards 24-28px, Chips, FAB, Bottom Navigation, Snackbar, dynamic theme (light/dark)
✅ **UX dla mieszkańców** – szybki dostęp do ulubionych, ostatnich, next bus countdown, offline-first
✅ **Bottom Navigation na mobile** – Linie / Przystanki / Od→Do / Mapa (80px, jak w Android)
✅ **Zachowane dane** – `timetables.json`, `stops_gps.json`, live GPS z `kiedyprzyjedzie.pl`, OSRM routing

```
User -> Vite Dev Server (0.0.0.0:5173, allowedHosts: true)
  -> fetch timetables.json (public/) + stops_gps.json
  -> live fetch kiedyprzyjedzie.pl/stops (merge)
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
  timetables.json    – Baza rozkładów (generowana przez scraper)
  stops_gps.json     – GPS przystanków
  manifest.json      – PWA
  sw.js              – Service Worker v9
  icons/             – PWA icons
/scraper/
  scraper.py         – Python scraper PDFów ZPA/PKS
legacy.html          – Stara wersja v2 (backup)
```

## Jak uruchomić v3

```bash
npm install
npm run dev   # http://localhost:5173 – host 0.0.0.0 dla Arena preview
npm run build # dist/
npm run preview
```

Wymagania: Node 18+

Stary `index.html` v2 jest w `legacy.html` – nadal działa jeśli otworzysz bezpośrednio.

## Material UI – decyzje

- **Primary #006A60** – ŻPA brand green zamiast Google purple #6750A4 (rozpoznawalność dla mieszkańców)
- **MUI v6** – AppBar, Card 24-28px radius, Chip 8px, Button 20px, elevation 0-2
- **Typography M3** – titleMedium, labelSmall, bodySmall itd. zdefiniowane w theme.js
- **Mobile-first** – BottomNav 80px, FAB odśwież, search w AppBar (desktop) + osobny na mobile
- **Residents** – ulubione ❤️, ostatnio, next bus countdown 56px mono, trip progress LinearProgress

## PWA

- `manifest.json` + `sw.js` w `public/` – kopiowane do `dist/` przez Vite
- Install banner (beforeinstallprompt) + new data banner
- Offline: localStorage cache + fallback.js
- W dev SW może być wyłączony – w prod rejestrujemy w App.jsx (TODO)

## Co dalej? (roadmapa z ANALIZA.md)

- [ ] Dodać Workbox + vite-plugin-pwa dla auto-generacji SW
- [ ] Code-split: lazy() dla MapView (ciężki Leaflet)
- [ ] GitHub Actions: scrape.yml + update_stops.yml (cron 04:00)
- [ ] Testy: Vitest dla time.js, stops.js
- [ ] GTFS export, live GPS autobusów
- [ ] WCAG AA audit, powiększanie czcionki

Autor: v3 MUI – Vite + React + MUI dla mieszkańców Żyrardowa.
