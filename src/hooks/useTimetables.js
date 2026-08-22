import { useState, useEffect } from 'react';

export function useTimetables() {
  const [busData, setBusData] = useState(null);
  const [stopCoords, setStopCoords] = useState({});
  const [status, setStatus] = useState('loading'); // loading | live | offline | fallback
  const [meta, setMeta] = useState(null);
  const [newData, setNewData] = useState(false);

  useEffect(() => {
    async function load() {
      // Load static GPS first
      try {
        const res = await fetch('./stops_gps.json?v=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          setStopCoords(json);
        }
      } catch {}

      // Try live API for stops
      try {
        const res = await fetch('https://pksgostynin.kiedyprzyjedzie.pl/stops?v=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.stops) {
            const liveCoords = {};
            json.stops.forEach(entry => {
              const name = entry[2];
              const lat = entry[4] / 1e6;
              const lng = entry[3] / 1e6;
              if (!(52.0 <= lat && lat <= 52.15 && 20.0 <= lng && lng <= 20.6)) return;
              if (!name.toLowerCase().includes('żyrardów')) return;
              liveCoords[name] = { lat, lon: lng, id: entry[0], designator: entry[1] };
              liveCoords[`${name} [${entry[1]}]`] = { lat, lon: lng, id: entry[0], designator: entry[1] };
            });
            setStopCoords(prev => ({ ...prev, ...liveCoords }));
            try { localStorage.setItem('kiedy_stops_cache', JSON.stringify({ ts: Date.now(), data: liveCoords })); } catch {}
          }
        }
      } catch (e) {
        console.warn('Live stops failed', e);
        try {
          const cached = JSON.parse(localStorage.getItem('kiedy_stops_cache') || '{}');
          if (cached.data) setStopCoords(prev => ({ ...prev, ...cached.data }));
        } catch {}
      }

      // Load timetables
      try {
        setStatus('loading');
        const res = await fetch('./timetables.json?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        if (!json.lines) throw new Error('Invalid');
        const newHash = JSON.stringify(json).length + (json.meta?.version || '');
        const oldHash = localStorage.getItem('zpa_data_hash');
        if (oldHash && oldHash !== String(newHash) && localStorage.getItem('zpa_data')) {
          setNewData(true);
        }
        localStorage.setItem('zpa_data_hash', String(newHash));
        localStorage.setItem('zpa_data', JSON.stringify(json));
        localStorage.setItem('zpa_data_updated', new Date().toISOString());
        setBusData(json);
        setMeta(json.meta);
        setStatus('live');
      } catch (e) {
        console.warn('Fetch timetables failed', e);
        const cached = localStorage.getItem('zpa_data');
        if (cached) {
          try {
            const json = JSON.parse(cached);
            setBusData(json);
            setMeta(json.meta);
            setStatus('offline');
          } catch {
            setStatus('fallback');
          }
        } else {
          setStatus('fallback');
          // Will use fallback embedded via import
          try {
            const mod = await import('../data/fallback.js');
            setBusData(mod.BUS_DATA_FALLBACK);
            setMeta(mod.BUS_DATA_FALLBACK.meta);
          } catch {}
        }
      }
    }
    load();
  }, []);

  return { busData, stopCoords, status, meta, newData, setNewData };
}
