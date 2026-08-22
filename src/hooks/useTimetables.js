import { useEffect, useState } from 'react';
import { getRoutePlatforms, normalizeStopName } from '../utils/stops.js';

const LIVE_STOPS_URL = 'https://pksgostynin.kiedyprzyjedzie.pl/stops';

function decorateStaticStops(data) {
  return Object.fromEntries(Object.entries(data || {}).map(([key, value]) => {
    const designatorMatch = key.match(/\[(\d+)\]\s*$/);
    return [key, {
      ...value,
      name: value.name || key.replace(/\s*\[\d+\]\s*$/, '').trim(),
      designator: value.designator ?? (designatorMatch ? Number(designatorMatch[1]) : null),
      id: value.id || null,
      source: value.source || 'static',
    }];
  }));
}

function relevantPlatformSets(busData) {
  const platforms = getRoutePlatforms(busData);
  return {
    designators: new Set(platforms.filter(stop => stop.designator !== null).map(stop => String(stop.designator))),
    ids: new Set(platforms.filter(stop => stop.id).map(stop => String(stop.id))),
    names: new Set(platforms.map(stop => normalizeStopName(stop.name))),
  };
}

export function useTimetables() {
  const [busData, setBusData] = useState(null);
  const [stopCoords, setStopCoords] = useState({});
  const [status, setStatus] = useState('loading');
  const [meta, setMeta] = useState(null);
  const [newData, setNewData] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStaticStops() {
      try {
        const response = await fetch(`/stops_gps.json?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = decorateStaticStops(await response.json());
        if (!cancelled) setStopCoords(data);
      } catch {}
    }

    async function loadTimetables() {
      try {
        setStatus('loading');
        const response = await fetch(`/timetables.json?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.lines) throw new Error('Invalid timetable payload');

        const newHash = JSON.stringify(data).length + (data.meta?.version || '');
        const oldHash = localStorage.getItem('zpa_data_hash');
        if (oldHash && oldHash !== String(newHash) && localStorage.getItem('zpa_data')) setNewData(true);
        localStorage.setItem('zpa_data_hash', String(newHash));
        localStorage.setItem('zpa_data', JSON.stringify(data));
        localStorage.setItem('zpa_data_updated', new Date().toISOString());
        return { data, nextStatus: 'live' };
      } catch (error) {
        console.warn('Fetch timetables failed', error);
        const cached = localStorage.getItem('zpa_data');
        if (cached) {
          try { return { data: JSON.parse(cached), nextStatus: 'offline' }; } catch {}
        }

        try {
          const fallback = await import('../data/fallback.js');
          return { data: fallback.BUS_DATA_FALLBACK, nextStatus: 'fallback' };
        } catch {
          return { data: null, nextStatus: 'fallback' };
        }
      }
    }

    async function loadLiveStops(currentBusData) {
      if (!currentBusData) return;
      const relevant = relevantPlatformSets(currentBusData);

      try {
        const response = await fetch(`${LIVE_STOPS_URL}?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const liveStops = {};

        (payload.stops || []).forEach(entry => {
          const [id, designator, name, rawLon, rawLat] = entry;
          const lat = Number(rawLat) / 1e6;
          const lon = Number(rawLon) / 1e6;
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

          const relevantToRoutes = relevant.designators.has(String(designator))
            || relevant.ids.has(String(id))
            || relevant.names.has(normalizeStopName(name));
          if (!relevantToRoutes) return;

          const key = `${name} [${designator}]`;
          liveStops[key] = {
            id: String(id),
            designator: Number(designator),
            name,
            lat,
            lon,
            source: 'api',
          };
        });

        if (!cancelled) setStopCoords(previous => ({ ...previous, ...liveStops }));
        try {
          localStorage.setItem('kiedy_stops_cache', JSON.stringify({
            revision: payload.revision || null,
            savedAt: Date.now(),
            data: liveStops,
          }));
        } catch {}
      } catch (error) {
        console.warn('Live stops failed', error);
        try {
          const cached = JSON.parse(localStorage.getItem('kiedy_stops_cache') || '{}');
          if (cached.data && !cancelled) setStopCoords(previous => ({ ...previous, ...cached.data }));
        } catch {}
      }
    }

    async function load() {
      loadStaticStops();
      const { data, nextStatus } = await loadTimetables();
      if (cancelled || !data) return;
      setBusData(data);
      setMeta(data.meta);
      setStatus(nextStatus);
      loadLiveStops(data);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { busData, stopCoords, status, meta, newData, setNewData };
}
