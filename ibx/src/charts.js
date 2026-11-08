import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { METRICS } from './demographics.js';
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const dist = ([lon1, lat1], [lon2, lat2]) => {
  const dx = (lon2 - lon1) * 111320 * Math.cos(lat1 * Math.PI / 180), dy = (lat2 - lat1) * 111320; return Math.hypot(dx, dy);
};
const centroid = g => {
  const pts = []; (function walk(c) { typeof c[0] === 'number' ? pts.push(c) : c.forEach(walk); })(g.coordinates);
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
};
const popMean = (fs, prop) => { let n = 0, d = 0; for (const f of fs) { const v = f.properties[prop], w = f.properties.pop || 0; if (v != null && w) { n += v * w; d += w; } } return d ? n / d : null; };

/** Build a chart in `canvas` for metric key, comparing tracts near `site` vs all. */
export async function renderChart(canvas, key, site, baseUrl) {
  const m = METRICS[key]; if (!m) return;
  const gj = await (renderChart._tracts ??= fetch(`${baseUrl}data/tracts.geojson`).then(r => r.json()));
  const near = gj.features.filter(f => dist(site, centroid(f.geometry)) <= 800);
  const a = popMean(near, m.prop), b = popMean(gj.features, m.prop);
  if (a == null || b == null) return;
  const css = getComputedStyle(document.documentElement);
  new Chart(canvas, {
    type: 'bar',
    data: { labels: ['Within 10-min walk of the stop', 'Brooklyn–Queens corridor'],
            datasets: [{ data: [a, b], backgroundColor: [css.getPropertyValue('--accent').trim(), css.getPropertyValue('--rail').trim()], borderRadius: 3, barThickness: 26 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => m.fmt(c.raw) } } },
      scales: { x: { ticks: { color: '#a9a89f', callback: v => m.fmt(v) }, grid: { color: 'rgba(255,255,255,.08)' } },
                y: { ticks: { color: '#ecebe4', font: { size: 12 } }, grid: { display: false } } } },
  });
  canvas.closest('figure').querySelector('figcaption').textContent =
    `${m.title}: ${m.fmt(a)} near the stop vs ${m.fmt(b)} corridor-wide (${near.length} tracts, population-weighted). US Census ACS 2019–2023.`;
}
