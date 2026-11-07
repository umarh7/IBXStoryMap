import { Popup } from 'maplibre-gl';

/** Sheet word → { prop, title, fmt, stops:[value,color]... } */
export const METRICS = {
  'income':        { prop: 'income',       title: 'Median household income', fmt: v => '$' + Math.round(v / 1000) + 'k',
                     stops: [30000, '#fde725', 60000, '#5ec962', 90000, '#21918c', 120000, '#3b528b', 160000, '#440154'] },
  'transit-share': { prop: 'pct_transit',  title: 'Workers commuting by transit', fmt: v => Math.round(v * 100) + '%',
                     stops: [0.2, '#f7fbff', 0.4, '#9ecae1', 0.6, '#4292c6', 0.8, '#08306b'] },
  'no-car':        { prop: 'pct_nocar',    title: 'Households with no vehicle', fmt: v => Math.round(v * 100) + '%',
                     stops: [0.1, '#fff5eb', 0.3, '#fdae6b', 0.5, '#e6550d', 0.8, '#7f2704'] },
  'commute-time':  { prop: 'mean_commute', title: 'Mean commute (minutes)', fmt: v => Math.round(v) + ' min',
                     stops: [25, '#f1eef6', 35, '#bdc9e1', 45, '#74a9cf', 55, '#0570b0', 65, '#023858'] },
};
const RACE = { prop: null, title: 'Largest group (non-Hispanic unless noted)' };

export const DEMO_REGISTRY = Object.fromEntries([
  ...Object.keys(METRICS).map(k => [k, [`tract-${k}`, 'tract-outline']]),
  ['race', ['tract-race', 'tract-outline']],
]);

export function addDemographics(map, beforeId) {
  map.addSource('tracts', { type: 'geojson', data: `${import.meta.env.BASE_URL}data/tracts.geojson`, generateId: true });

  for (const [key, m] of Object.entries(METRICS)) {
    map.addLayer({
      id: `tract-${key}`, type: 'fill', source: 'tracts', layout: { visibility: 'none' },
      paint: {
        'fill-color': ['case', ['==', ['get', m.prop], null], 'rgba(0,0,0,0)',
                       ['interpolate', ['linear'], ['get', m.prop], ...m.stops]],
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.9, 0.65],
      },
    }, beforeId);
  }
  // race/ethnicity: color by largest share
  const share = k => ['coalesce', ['get', k], 0];
  const mx = ['max', share('pct_white'), share('pct_black'), share('pct_asian'), share('pct_hispanic')];
  map.addLayer({
    id: 'tract-race', type: 'fill', source: 'tracts', layout: { visibility: 'none' },
    paint: {
      'fill-color': ['case',
        ['==', mx, share('pct_white')], '#60a5fa',
        ['==', mx, share('pct_black')], '#34d399',
        ['==', mx, share('pct_asian')], '#f472b6',
        '#fbbf24'],
      'fill-opacity': ['interpolate', ['linear'], mx, 0.3, 0.25, 0.9, 0.8],
    },
  }, beforeId);
  map.addLayer({ id: 'tract-outline', type: 'line', source: 'tracts', layout: { visibility: 'none' },
    paint: { 'line-color': '#fff', 'line-width': 0.4, 'line-opacity': 0.35 } }, beforeId);

  // hover popup on whichever tract layer is visible
  const pop = new Popup({ closeButton: false, offset: 8, maxWidth: '260px' });
  let hovered = null;
  const f = (v, fn) => v == null ? '—' : fn(v);
  map.on('mousemove', e => {
    const ids = [...Object.keys(METRICS).map(k => `tract-${k}`), 'tract-race'].filter(id => map.getLayoutProperty(id, 'visibility') === 'visible');
    const hit = ids.length ? map.queryRenderedFeatures(e.point, { layers: ids })[0] : null;
    if (hovered !== null) map.setFeatureState({ source: 'tracts', id: hovered }, { hover: false });
    if (!hit) { hovered = null; pop.remove(); return; }
    hovered = hit.id; map.setFeatureState({ source: 'tracts', id: hovered }, { hover: true });
    const p = hit.properties;
    pop.setLngLat(e.lngLat).setHTML(`<b>${p.nta ?? 'Tract'} · ${p.geoid.slice(5)}</b><br>
      <small>Pop ${f(p.pop, v => v.toLocaleString())} · Income ${f(p.income, METRICS.income.fmt)}<br>
      Transit ${f(p.pct_transit, METRICS['transit-share'].fmt)} · No car ${f(p.pct_nocar, METRICS['no-car'].fmt)} · Commute ${f(p.mean_commute, METRICS['commute-time'].fmt)}<br>
      White ${f(p.pct_white, v => Math.round(v*100)+'%')} · Black ${f(p.pct_black, v => Math.round(v*100)+'%')} · Asian ${f(p.pct_asian, v => Math.round(v*100)+'%')} · Hispanic ${f(p.pct_hispanic, v => Math.round(v*100)+'%')}</small>`).addTo(map);
  });
}

// ---- legend ----
const legend = document.createElement('aside'); legend.id = 'legend'; document.body.appendChild(legend);
export function showLegend(wanted) {
  const key = wanted.find(w => METRICS[w] || w === 'race');
  if (!key) { legend.hidden = true; return; }
  legend.hidden = false;
  if (key === 'race') {
    legend.innerHTML = `<h4>${RACE.title}</h4><ul class="cat">
      <li><i style="background:#60a5fa"></i>White</li><li><i style="background:#34d399"></i>Black</li>
      <li><i style="background:#f472b6"></i>Asian</li><li><i style="background:#fbbf24"></i>Hispanic (any race)</li></ul>
      <small>Source: ACS 2019–2023 5-yr, B03002</small>`;
    return;
  }
  const m = METRICS[key], colors = m.stops.filter((_, i) => i % 2), vals = m.stops.filter((_, i) => !(i % 2));
  legend.innerHTML = `<h4>${m.title}</h4>
    <div class="bar" style="background:linear-gradient(90deg,${colors.join(',')})"></div>
    <div class="ticks"><span>${m.fmt(vals[0])}</span><span>${m.fmt(vals[vals.length - 1])}</span></div>
    <small>Source: US Census ACS 2019–2023 5-yr, by tract</small>`;
}
