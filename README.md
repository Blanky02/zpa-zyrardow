# ŻPA Żyrardów - Rozkład Jazdy SPA v2 AUTO

Nowoczesna, responsywna aplikacja typu **Rozkład Jazdy** dla komunikacji miejskiej w Żyrardowie - Mobile-First, instalowalna na Android.

## Wersja 2 - AUTO

✅ **Główna zmiana:** Rozkład nie jest już na stałe w HTML. Aplikacja przy starcie pobiera `./timetables.json`.

Jeśli plik na serwerze się zmieni (bo scraper wykrył nowy PDF na `pksgostynin.pl/zyrardowskie-przewozy-autobusowe/`), użytkownicy widzą baner **"Nowy rozkład!"** automatycznie.

```
Użytkownik otwiera index.html
   -> fetch timetables.json?v=timestamp (no-cache)
   -> jeśli sukces: zapisz do localStorage + pokaż LIVE badge
   -> jeśli offline: weź z localStorage cache
   -> jeśli brak cache: użyj BUS_DATA_FALLBACK (demo)
```

## Struktura projektu

```
/index.html          - APLIKACJA v2 (fetchuje timetables.json)
/timetables.json     - BAZA DANYCH rozkładów (generowana przez scraper)
/scraper/
  scraper.py         - Python scraper PDFów ZPA/PKS
  requirements.txt
/.github/workflows/
  scrape.yml         - Cron codziennie 04:00, auto-commit JSON
```

## Jak uruchomić

1. Otwórz `index.html` w przeglądarce lub wrzuć na dowolny hosting statyczny (GitHub Pages, Vercel, Cloudflare Pages)
   - Musisz serwować przez HTTP, żeby `fetch('./timetables.json')` działał (nie `file://`). 
   - W tym środowisku Arena preview działa.
2. Edycja ręczna: podmień `timetables.json`
3. Edycja automatyczna: `python scraper/scraper.py`

## Jak działa scraper

1. Pobiera listę PDFów z:
   - https://zpa.powiat-zyrardowski.pl/75,rozklady
   - http://pksgostynin.pl/zyrardowskie-przewozy-autobusowe/
2. Dla każdego PDF liczy hash, jeśli inny niż poprzednio -> parsuje via `pdfplumber`
3. Wyciąga przystanki i godziny regexami (docelowo tabele)
4. Nadpisuje `timetables.json` z nowym `meta.version = YYYY-MM-DD`

## Android

- Działa w Chrome / Samsung Internet
- Dodaj do ekranu głównego: menu ⋮ -> Zainstaluj aplikację
- Działa offline dzięki cache localStorage

## Co dalej?

- Dodać PWA manifest + Service Worker dla pełnego offline
- Podpiąć prawdziwe API KiedyPrzyjedzie (GPS live)
- Dodać współrzędne przystanków z OSM i mapę
- Eksport GTFS dla Google Maps

Autor: Agent Mode - wersja koncepcyjna dla ŻPA.
