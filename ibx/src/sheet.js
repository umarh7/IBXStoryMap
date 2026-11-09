import Papa from 'papaparse';

export const SHEET_ID = 'NEW_ID';
const url = tab => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

/** Fetch one tab as an array of row objects keyed by header. Falls back to /data/<tab>.json if Google is unreachable. */
export async function loadTab(tab) {
  try {
    const text = await fetch(url(tab), { cache: 'no-store' }).then(r => { if (!r.ok) throw r.status; return r.text(); });
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() });
    return data.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, (v ?? '').trim()])));
  } catch (e) {
    console.warn(`Sheet tab "${tab}" unavailable (${e}); using local fallback`);
    return fetch(`${import.meta.env.BASE_URL}data/${tab.toLowerCase()}.json`).then(r => r.ok ? r.json() : []);
  }
}

/** Options tab → { 'Storymap Title': '...', ... } */
export async function loadOptions() {
  const rows = await loadTab('Options');
  return Object.fromEntries(rows.filter(r => r.Setting).map(r => [r.Setting, r.Customize ?? '']));
}

export const num = v => { const n = parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
export const words = v => String(v ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
