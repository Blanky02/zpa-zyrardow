export function parseMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
export function minutesToTime(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
export function addMinutes(t, delta) {
  return minutesToTime(parseMinutes(t) + delta);
}
export function dayLabel(t) {
  return t === 'weekday' ? 'Dzień powszedni' : t === 'saturday' ? 'Sobota' : 'Niedziela';
}

const TIME_RE = /^ ?([01]?\d|2[0-4]):[0-5]\d ?$/;

function isValidTime(t) {
  return typeof t === 'string' && TIME_RE.test(t.trim());
}

export function normalizeTime(t) {
  return isValidTime(t) ? t.trim().replace(/^(\d):/, '0$1:') : null;
}

/**
 * Czy kierunek ma rzeczywiste godziny z PDF-ów (tabela per przystanek)?
 * stopsTimes: { weekday: [[HH:MM|null, ...], ...], ... } – kursy jak w baseTimes.
 */
export function hasPdfSchedule(dir, day) {
  const perStop = dir?.stopsTimes?.[day];
  return Array.isArray(perStop) && perStop.length > 0 && Array.isArray(perStop[0]);
}

/**
 * Kursy danego dnia. Z PDF-ów: pełne godziny na każdym przystanku.
 * Bez PDF-ów: jednoelementowe kursy [godzina odjazdu] z baseTimes (stare zachowanie).
 */
export function getCoursesForDay(dir, day) {
  if (hasPdfSchedule(dir, day)) return dir.stopsTimes[day];
  return (dir?.baseTimes?.[day] || []).map(t => [t]);
}

/**
 * Godziny na przystanku `idx` danego dnia.
 * Priorytet: oficjalny rozkład z PDF (stopsTimes – godzina tego przystanku).
 * Fallback: przybliżenie „godzina odjazdu z pętli + 2 min na przystanek”
 * (dla danych bez stopsTimes, np. offline fallback).
 */
export function getScheduleForStop(dir, idx, day) {
  if (hasPdfSchedule(dir, day)) {
    const times = dir.stopsTimes[day]
      .map(course => (Array.isArray(course) ? course[idx] : null))
      .map(normalizeTime)
      .filter(Boolean);
    times.sort((a, b) => parseMinutes(a) - parseMinutes(b));
    return times;
  }
  return (dir?.baseTimes?.[day] || []).map(t => addMinutes(t, idx * 2));
}

export function formatNow() {
  const now = new Date();
  return {
    h: String(now.getHours()).padStart(2, '0'),
    m: String(now.getMinutes()).padStart(2, '0'),
    s: String(now.getSeconds()).padStart(2, '0'),
    day: ['ND', 'PN', 'WT', 'ŚR', 'CZ', 'PT', 'SB'][now.getDay()],
    minutes: now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60,
    date: now,
  };
}
