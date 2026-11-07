import './style.css';
import { Map as MLMap, Marker, Popup, NavigationControl, LngLatBounds, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import scrollama from 'scrollama';
import { loadTab, loadOptions, num, words } from './sheet.js';
import { addDemographics, DEMO_REGISTRY, showLegend } from './demographics.js';
import { addTraffic, TRAFFIC_REGISTRY } from './traffic.js';
setWorkerUrl(workerUrl);

const SITE = [-73.9764, 40.6273];                       // proposed IBX stop at McDonald Ave
const STYLES = { dark: 'https://tiles.openfreemap.org/styles/dark', liberty: 'https://tiles.openfreemap.org/styles/liberty',
                 positron: 'https://tiles.openfreemap.org/styles/positron', bright: 'https://tiles.openfreemap.org/styles/bright' };

// ---------- 1. data ----------
const [options, chaptersRaw, storesRaw, rail] = await Promise.all([
  loadOptions(), loadTab('Chapters'), loadTab('Stores'), fetch('/data/rail.geojson').then(r => r.json()),
]);
const chapters = chaptersRaw.filter(c => c.Chapter || c.Description);
const stores = storesRaw.filter(s => num(s.Latitude) !== null && !/delete me/i.test(s.Name));

document.title = options['Storymap Title'] || 'IBX Storymap';

// ---------- 2. map ----------
export const map = new MLMap({
  container: 'map', style: STYLES[(options['Basemap Tiles'] || 'dark').toLowerCase()] ?? STYLES.dark,
  center: SITE, zoom: 13, pitch: 45, bearing: -20,
  cooperativeGestures: true, attributionControl: { compact: true },
});
map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');

// ---------- 3. narrative DOM ----------
function mediaHTML(c) {
  const link = c['Media Link']; if (!link) return '';
  const credit = c['Media Credit']
    ? `<figcaption>${c['Media Credit Link'] ? `<a href="${c['Media Credit Link']}" target="_blank" rel="noopener">${c['Media Credit']}</a>` : c['Media Credit']}</figcaption>` : '';
  const ext = link.split('?')[0].split('.').pop().toLowerCase();
  let el;
  if (/youtube\.com|youtu\.be/.test(link)) el = `<iframe src="${link}" allow="autoplay; encrypted-media" allowfullscreen loading="lazy"></iframe>`;
  else if (['mp3', 'ogg', 'wav'].includes(ext)) el = `<audio controls src="${link}"></audio>`;
  else el = `<img src="${link}" alt="${c.Chapter}" loading="lazy">`;
  return `<figure>${el}${credit}</figure>`;
}

document.getElementById('story').innerHTML = `
  <header class="title-card">
    ${options['Storymap Logo'] ? `<img class="logo" src="${options['Storymap Logo']}" alt="">` : ''}
    <h1>${options['Storymap Title'] || ''}</h1>
    <div class="subtitle">${options['Storymap Subtitle'] || ''}</div>
  </header>` +
  chapters.map((c, i) => `
  <section class="step" data-step="${i}" id="ch${i + 1}"><div class="card">
    <h2><span class="num">${i + 1}</span>${c.Chapter}</h2>
    ${mediaHTML(c)}
    <div class="description">${c.Description}</div>
  </div></section>`).join('') +
  `<footer class="end-card"><a href="#ch1">↑ Back to top</a></footer>`;

// ---------- 4. layer registry: Sheet word → map layer ids ----------
const REGISTRY = {
  'ibx':           ['ibx-glow', 'ibx'],
  'f-line':        ['f-line'],
  'stations':      ['stations'],
  'research-area': ['research-area-fill', 'research-area-line'],
  'stores':        ['stores'],
  'interviewed':   ['stores-interviewed'],
  'buildings-3d':  ['buildings-3d'],
  ...DEMO_REGISTRY,
  ...TRAFFIC_REGISTRY,
};
const ALWAYS = new Set(['buildings-3d']);

function showLayers(wanted) {
  const on = new Set();
  for (const w of wanted) (REGISTRY[w] ?? []).forEach(id => on.add(id));
  for (const [w, ids] of Object.entries(REGISTRY)) {
    const vis = ALWAYS.has(w) || ids.some(id => on.has(id));
    ids.forEach(id => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', vis ? 'visible' : 'none'));
  }
  showLegend(wanted);
}

// ---------- 5. research-area polygon (override via Options "Research Area" = "lat,lon; lat,lon; ...") ----------
function researchArea() {
  const txt = options['Research Area'];
  const pts = txt ? txt.split(';').map(p => p.split(',').map(num)).filter(p => p.length === 2 && p.every(v => v !== null)).map(([la, lo]) => [lo, la]) : null;
  const ring = pts?.length >= 3 ? pts : [[-73.9792, 40.6238], [-73.9738, 40.6238], [-73.9738, 40.6322], [-73.9792, 40.6322]];
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } };
}

// ---------- 6. camera ----------
let ibxBounds;
function goTo(i) {
  const c = chapters[i];
  document.querySelectorAll('.step').forEach((s, k) => s.classList.toggle('active', k === i));
  const layers = words(c.Layers);
  showLayers(layers);
  markers.forEach((m, k) => m?.getElement().classList.toggle('active', k === i));
  location.hash = `ch${i + 1}`;

  if ((i === 0 || layers.includes('fit-ibx')) && ibxBounds) {
    map.fitBounds(ibxBounds, { padding: { top: 80, bottom: 80, left: 480, right: 80 }, pitch: num(c.Pitch) ?? 35, bearing: num(c.Bearing) ?? -20, duration: 2000 });
    return;
  }
  const lat = num(c.Latitude), lon = num(c.Longitude);
  if (lat === null || lon === null) return;              // chapter without a place: keep camera
  map.flyTo({ center: [lon, lat], zoom: num(c.Zoom) ?? 15, pitch: num(c.Pitch) ?? 50, bearing: num(c.Bearing) ?? -20, duration: 1800, essential: true });
}

// ---------- 7. markers ----------
const markers = chapters.map((c, i) => {
  const lat = num(c.Latitude), lon = num(c.Longitude);
  if (lat === null || lon === null || /hidden/i.test(c.Marker)) return null;
  const el = document.createElement('div'); el.className = 'ch-marker';
  el.textContent = /numbered/i.test(c.Marker) || !c.Marker ? i + 1 : (/plain/i.test(c.Marker) ? '' : c.Marker);
  el.style.setProperty('--c', c['Marker Color'] || '#ff6319');
  el.addEventListener('click', () => document.getElementById(`ch${i + 1}`).scrollIntoView({ behavior: 'smooth', block: 'center' }));
  return new Marker({ element: el, anchor: 'bottom' }).setLngLat([lon, lat]).addTo(map);
});

// ---------- 8. data layers ----------
map.on('load', () => {
  const isLine = ['==', ['geometry-type'], 'LineString'];
  const F_NAMES = ['IND Culver Line', 'IND Sixth Avenue Line', 'IND Queens Boulevard Line', 'IND 63rd Street Line'];
  map.addSource('rail', { type: 'geojson', data: rail });
  map.addSource('area', { type: 'geojson', data: researchArea() });
  map.addSource('stores', { type: 'geojson', data: { type: 'FeatureCollection', features: stores.map(s => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [num(s.Longitude), num(s.Latitude)] },
    properties: { ...s, interviewed: /^y/i.test(s.Interviewed) } })) } });

  const firstLabel = map.getStyle().layers.find(l => l.type === 'symbol')?.id;
  addDemographics(map, firstLabel);
  addTraffic(map, firstLabel, SITE);
  if (!map.getLayer('building-3d')) map.addLayer({
    id: 'buildings-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14,
    paint: { 'fill-extrusion-color': '#6b7280', 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 12],
             'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': 0.7 } }, firstLabel);

  map.addLayer({ id: 'research-area-fill', type: 'fill', source: 'area', paint: { 'fill-color': '#ff6319', 'fill-opacity': 0.12 } });
  map.addLayer({ id: 'research-area-line', type: 'line', source: 'area', paint: { 'line-color': '#ff6319', 'line-width': 2.5, 'line-dasharray': [3, 2] } });
  map.addLayer({ id: 'f-line', type: 'line', source: 'rail', filter: ['all', isLine, ['in', ['get', 'name'], ['literal', F_NAMES]]],
    layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ff6319', 'line-width': 4 } });
  map.addLayer({ id: 'ibx-glow', type: 'line', source: 'rail', filter: ['all', isLine, ['==', ['get', 'name'], 'Bay Ridge Branch']],
    layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#00c2d1', 'line-width': 14, 'line-blur': 10, 'line-opacity': 0.5 } });
  map.addLayer({ id: 'ibx', type: 'line', source: 'rail', filter: ['all', isLine, ['==', ['get', 'name'], 'Bay Ridge Branch']],
    layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#00c2d1', 'line-width': 5, 'line-dasharray': [2, 1.5] } });
  map.addLayer({ id: 'stations', type: 'circle', source: 'rail', filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'railway'], 'station']],
    paint: { 'circle-radius': 4.5, 'circle-color': '#111', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
  map.addLayer({ id: 'stores', type: 'circle', source: 'stores',
    paint: { 'circle-radius': 6, 'circle-color': '#fbbf24', 'circle-stroke-color': '#111', 'circle-stroke-width': 1.5 } });
  map.addLayer({ id: 'stores-interviewed', type: 'circle', source: 'stores', filter: ['==', ['get', 'interviewed'], true],
    paint: { 'circle-radius': 9, 'circle-color': '#22c55e', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });

  // bounds of the IBX line for the opening shot
  ibxBounds = rail.features.filter(f => f.geometry.type === 'LineString' && f.properties.name === 'Bay Ridge Branch')
    .flatMap(f => f.geometry.coordinates).reduce((b, c) => b.extend(c), new LngLatBounds());

  // popups
  const pop = new Popup({ closeButton: false, offset: 12, maxWidth: '280px' });
  const hover = (layer, html) => {
    map.on('mouseenter', layer, e => { map.getCanvas().style.cursor = 'pointer'; pop.setLngLat(e.lngLat).setHTML(html(e.features[0].properties)).addTo(map); });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; pop.remove(); });
  };
  hover('stations', p => `<b>${p.name ?? 'Station'}</b>`);
  const storeHTML = p => `<b>${p.Name}</b><br><small>${p.Category || ''}${p.interviewed === 'true' || p.interviewed === true ? ' · interviewed' : ''}</small>${p.Quote ? `<blockquote>“${p.Quote}”</blockquote>` : ''}`;
  hover('stores', storeHTML); hover('stores-interviewed', storeHTML);

  scrollama().setup({ step: '.step', offset: 0.55 }).onStepEnter(({ index }) => goTo(index));
  goTo(0);
});
