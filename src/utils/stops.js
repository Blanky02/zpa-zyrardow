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

export function findOccurrencesForStop(busData, stopName) {
  const results = [];
  const q = stopName.toLowerCase();
  busData.lines.forEach(line => {
    line.directions.forEach((dir, dirIdx) => {
      dir.stops.forEach((sName, stopIdx) => {
        if (sName.toLowerCase() === q || sName.toLowerCase().includes(q) || q.includes(sName.toLowerCase())) {
          results.push({ line, dir, dirIdx, stopIdx, stopName: sName });
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
