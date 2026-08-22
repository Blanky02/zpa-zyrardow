export function normalizeStopName(name = '') {
  return name
    .toLocaleUpperCase('pl')
    .replace(/ŻYR\.\s*/g, 'ŻYRARDÓW ')
    .replace(/ZYR\.\s*/g, 'ŻYRARDÓW ')
    .replace(/\s*\[\d+\]\s*$/, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

export function getPlatformKey(platform = {}) {
  if (platform.designator !== undefined && platform.designator !== null && platform.designator !== '') {
    return `designator:${platform.designator}`;
  }
  if (platform.id) return `id:${platform.id}`;
  const name = normalizeStopName(platform.name || platform.official_name || 'przystanek');
  const lat = Number(platform.lat || 0).toFixed(6);
  const lon = Number(platform.lon ?? platform.lng ?? 0).toFixed(6);
  return `location:${name}:${lat}:${lon}`;
}

export function getRoutePlatforms(busData) {
  const platforms = new Map();
  if (!busData?.lines) return [];

  busData.lines.forEach(line => {
    line.directions.forEach((direction, directionIndex) => {
      (direction.stops_full || []).forEach((stop, stopIndex) => {
        if (!stop?.lat || !stop?.lon) return;
        const platform = {
          id: stop.id || null,
          designator: stop.designator ?? null,
          name: stop.official_name || stop.name || direction.stops?.[stopIndex] || 'Przystanek',
          lat: Number(stop.lat),
          lon: Number(stop.lon),
          source: 'route',
          lineId: line.id,
          lineNumber: line.number,
          directionIndex,
          stopIndex,
        };
        const key = getPlatformKey(platform);
        if (!platforms.has(key)) platforms.set(key, platform);
      });
    });
  });

  return Array.from(platforms.values());
}

export function getUniqueStops(busData) {
  const map = new Map();
  if (!busData) return [];
  busData.lines.forEach(line => {
    line.directions.forEach(dir => {
      dir.stops.forEach(stopName => {
        const key = stopName.toLowerCase().replace(/[^a-z0-9ąćęłńóśżź ]/g, '').trim();
        if (!map.has(key)) {
          map.set(key, { name: stopName, count: 0, lines: new Set() });
        }
        const e = map.get(key);
        e.count++;
        e.lines.add(line.number);
      });
    });
  });
  return Array.from(map.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(v => ({ name: v.name, count: v.count, linesCount: v.lines.size, lines: Array.from(v.lines).join(', ') }));
}

export function findOccurrencesForStop(busData, stopSelection) {
  const results = [];
  if (!busData?.lines || !stopSelection) return results;

  const selection = typeof stopSelection === 'string'
    ? { name: stopSelection }
    : stopSelection;
  const selectedName = normalizeStopName(selection.name || selection.official_name || '');
  const selectedDesignator = selection.designator !== undefined && selection.designator !== null
    ? String(selection.designator)
    : null;
  const selectedId = selection.id ? String(selection.id) : null;
  const hasPlatformIdentity = Boolean(selectedDesignator || selectedId);

  busData.lines.forEach(line => {
    line.directions.forEach((dir, dirIdx) => {
      dir.stops.forEach((sName, stopIdx) => {
        const platform = dir.stops_full?.[stopIdx];
        const platformDesignator = platform?.designator !== undefined && platform?.designator !== null
          ? String(platform.designator)
          : null;
        const platformId = platform?.id ? String(platform.id) : null;
        const exactPlatform = (
          selectedDesignator && platformDesignator === selectedDesignator
        ) || (
          selectedId && platformId === selectedId
        );

        if (hasPlatformIdentity ? exactPlatform : normalizeStopName(sName) === selectedName) {
          results.push({ line, dir, dirIdx, stopIdx, stopName: sName, platform });
        }
      });
    });
  });

  return results;
}

export function findDirectRoutes(busData, fromName, toName, dayType) {
  const fromQ = fromName.toLowerCase();
  const toQ = toName.toLowerCase();
  const results = [];
  busData.lines.forEach(line => {
    line.directions.forEach(dir => {
      const fromIdx = dir.stops.findIndex(s => s.toLowerCase().includes(fromQ) || fromQ.includes(s.toLowerCase().split('/')[0].trim().toLowerCase()));
      const toIdx = dir.stops.findIndex(s => s.toLowerCase().includes(toQ) || toQ.includes(s.toLowerCase().split('/')[0].trim().toLowerCase()));
      if (fromIdx !== -1 && toIdx !== -1 && fromIdx < toIdx) {
        const baseTimes = dir.baseTimes[dayType] || dir.baseTimes['weekday'] || [];
        baseTimes.forEach(t => {
          const [h, m] = t.split(':').map(Number);
          const depMins = h * 60 + m + fromIdx * 2;
          const arrMins = h * 60 + m + toIdx * 2;
          const depTime = `${String(Math.floor(depMins / 60) % 24).padStart(2, '0')}:${String(depMins % 60).padStart(2, '0')}`;
          const arrTime = `${String(Math.floor(arrMins / 60) % 24).padStart(2, '0')}:${String(arrMins % 60).padStart(2, '0')}`;
          results.push({
            line, dir, fromIdx, toIdx,
            depTime, arrTime, depMins,
            duration: (toIdx - fromIdx) * 2,
            stopsCount: toIdx - fromIdx
          });
        });
      }
    });
  });
  results.sort((a, b) => a.depMins - b.depMins);
  return results;
}

export const LINE_COLOR_HEX = {
  'bg-teal-600': '#0d9488',
  'bg-emerald-600': '#059669',
  'bg-sky-600': '#0284c7',
  'bg-violet-600': '#7c3aed',
  'bg-blue-600': '#2563eb',
  'bg-orange-600': '#ea580c',
  'bg-emerald-500': '#10b981',
  'bg-sky-500': '#0ea5e9',
  'bg-rose-600': '#e11d48',
  'bg-amber-600': '#d97706',
  'bg-zinc-600': '#52525b'
};

export function getLineHex(twClass) {
  return LINE_COLOR_HEX[twClass] || '#006A60';
}
