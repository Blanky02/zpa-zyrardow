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
export function getScheduleForStop(dir, idx, day) {
  return (dir.baseTimes[day] || []).map(t => addMinutes(t, idx * 2));
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
