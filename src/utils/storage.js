const LS_KEY = 'zpa_state_v3';
const FAV_KEY = 'zpa_favorites_v1';
const RECENT_KEY = 'zpa_recents';

export function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY));
    return s || null;
  } catch { return null; }
}
export function saveState(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

export function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}
export function saveFavorites(favs) {
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
}

export function getRecents() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
export function saveRecents(recents) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(recents.slice(0, 5)));
}

export function addRecent(line, dirIdx, stopIdx, stop) {
  const recents = getRecents();
  const entry = { lineId: line.id, dirIdx, stopIdx, stop, lineNumber: line.number, lineColor: line.color, ts: Date.now() };
  const filtered = recents.filter(r => !(r.lineId === entry.lineId && r.stop === stop));
  filtered.unshift(entry);
  saveRecents(filtered);
  return filtered;
}
