// stops_corrected.js - Ręcznie skorygowane współrzędne przystanków ŻPA Żyrardów
// Ten plik ma priorytet nad danymi z API kiedyprzyjedzie.pl

const STOPS_CORRECTED = {
  "version": "2026-08-20-corrected",
  "note": "Ręcznie skorygowane współrzędne przystanków w Żyrardowie. Priorytet nad API.",
  "stops": [
    {
      "id": "DWORZEC_PKP",
      "name": "Dworzec PKP",
      "lat": 52.0495,
      "lon": 20.4465,
      "lines": ["A", "B", "C", "D", "E", "F", "G", "H", "N"]
    },
    {
      "id": "SZPITAL",
      "name": "Szpital",
      "lat": 52.0530,
      "lon": 20.4510,
      "lines": ["A", "B", "C"]
    },
    {
      "id": "LIMANOWSKIEGO",
      "name": "Limanowskiego",
      "lat": 52.0480,
      "lon": 20.4420,
      "lines": ["A", "D", "E"]
    },
    {
      "id": "KOSCIELNA",
      "name": "Kościelna",
      "lat": 52.0460,
      "lon": 20.4480,
      "lines": ["B", "C", "F"]
    },
    {
      "id": "SRODMIESCIE",
      "name": "Śródmieście",
      "lat": 52.0475,
      "lon": 20.4490,
      "lines": ["A", "B", "C", "D", "E", "F", "G", "H", "N"]
    },
    {
      "id": "WYSZYNSKIEGO",
      "name": "Wyszyńskiego",
      "lat": 52.0510,
      "lon": 20.4430,
      "lines": ["D", "E", "G"]
    },
    {
      "id": "REYMONTA",
      "name": "Reymonta",
      "lat": 52.0440,
      "lon": 20.4550,
      "lines": ["F", "H"]
    },
    {
      "id": "ZEROMSKIEGO",
      "name": "Żeromskiego",
      "lat": 52.0550,
      "lon": 20.4400,
      "lines": ["A", "B", "N"]
    },
    {
      "id": "MARII_KONOPNICKIEJ",
      "name": "Marii Konopnickiej",
      "lat": 52.0420,
      "lon": 20.4600,
      "lines": ["C", "F", "H"]
    },
    {
      "id": "GENERALNA",
      "name": "Generalna",
      "lat": 52.0390,
      "lon": 20.4350,
      "lines": ["D", "E", "G"]
    }
  ]
};

// Funkcja do ładowania poprawionych danych
function loadCorrectedStops() {
  if (typeof STOP_COORDS === 'undefined') {
    console.warn('[Corrected] STOP_COORDS nie zdefiniowane, pomijam korektę');
    return;
  }

  let correctedCount = 0;
  
  STOPS_CORRECTED.stops.forEach(stop => {
    // Szukaj przystanku po nazwie (różne warianty)
    const variants = [
      stop.name,
      stop.name.toUpperCase(),
      `ŻYRARDÓW ${stop.name.toUpperCase()}`,
      `${stop.name} [`,
    ];

    for (const variant of variants) {
      for (const key in STOP_COORDS) {
        if (key.includes(variant) || stop.name.toLowerCase().includes(key.toLowerCase())) {
          // Nadpisz współrzędne poprawionymi
          STOP_COORDS[key].lat = stop.lat;
          STOP_COORDS[key].lon = stop.lon;
          STOP_COORDS[key].corrected = true;
          STOP_COORDS[key].corrected_id = stop.id;
          correctedCount++;
          break;
        }
      }
    }
  });

  console.log(`[Corrected] Skorygowano ${correctedCount} współrzędnych przystanków`);
  
  // Zapisz metadane
  if (typeof STOP_COORDS_META !== 'undefined') {
    STOP_COORDS_META.corrected = correctedCount;
    STOP_COORDS_META.corrected_version = STOPS_CORRECTED.version;
  }
}

// Automatyczne ładowanie po załadowaniu strony
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadCorrectedStops);
} else {
  loadCorrectedStops();
}
