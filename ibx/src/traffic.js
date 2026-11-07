import { Popup } from 'maplibre-gl';

export const TRAFFIC_REGISTRY = {
  'crashes':       ['crash-heat', 'crash-points'],
  'traffic':       ['crash-heat', 'crash-points'],
  'intersections': ['crash-heat', 'crash-points'],
  'buses':         ['bus-route', 'bus-stops'],
  'walkshed':      ['walkshed-fill', 'walkshed-line'],
};

function circle([lon, lat], meters, n = 64) {
  const dLat = meters / 111320, dLon = meters / (111320 * Math.cos(lat * Math.PI / 180));
  const ring = Array.from({ length: n + 1 }, (_, i) => { const a = 2 * Math.PI * i / n; return [lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]; });
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } };
}

export function addTraffic(map, beforeId, site) {
  map.addSource('crashes', { type: 'geojson', data: `${import.meta.env.BASE_URL}data/crashes.geojson` });
  map.addSource('bus', { type: 'geojson', data: `${import.meta.env.BASE_URL}data/bus.geojson` });
  map.addSource('walkshed', { type: 'geojson', data: circle(site, 800) });

  map.addLayer({ id: 'walkshed-fill', type: 'fill', source: 'walkshed', layout: { visibility: 'none' },
    paint: { 'fill-color': '#00c2d1', 'fill-opacity': 0.10 } }, beforeId);
  map.addLayer({ id: 'walkshed-line', type: 'line', source: 'walkshed', layout: { visibility: 'none' },
    paint: { 'line-color': '#00c2d1', 'line-width': 2, 'line-dasharray': [1, 2] } }, beforeId);

  map.addLayer({ id: 'crash-heat', type: 'heatmap', source: 'crashes', maxzoom: 17, layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': ['+', 0.4, ['*', 0.6, ['get', 'injured']], ['*', 3, ['get', 'killed']]],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 12, 0.6, 16, 1.6],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 28],
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.2, '#3b0a45', 0.45, '#b5179e', 0.7, '#f72585', 1, '#ffd166'],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0.85, 17, 0.3],
    } }, beforeId);
  map.addLayer({ id: 'crash-points', type: 'circle', source: 'crashes', minzoom: 15, layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 2.5, 18, 6],
      'circle-color': ['case', ['>', ['get', 'killed'], 0], '#ff1744', ['>', ['get', 'injured'], 0], '#ff9100', '#ffd166'],
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0.3, 17, 0.9],
      'circle-stroke-color': '#000', 'circle-stroke-width': 0.5,
    } }, beforeId);

  map.addLayer({ id: 'bus-route', type: 'line', source: 'bus', filter: ['==', ['geometry-type'], 'LineString'], layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#a78bfa', 'line-width': 3, 'line-opacity': 0.9 } }, beforeId);
  map.addLayer({ id: 'bus-stops', type: 'circle', source: 'bus', filter: ['==', ['get', 'highway'], 'bus_stop'], minzoom: 14, layout: { visibility: 'none' },
    paint: { 'circle-radius': 3.5, 'circle-color': '#a78bfa', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } });

  const pop = new Popup({ closeButton: false, offset: 10, maxWidth: '260px' });
  const hover = (layer, html) => {
    map.on('mouseenter', layer, e => { map.getCanvas().style.cursor = 'pointer'; pop.setLngLat(e.lngLat).setHTML(html(e.features[0].properties)).addTo(map); });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; pop.remove(); });
  };
  hover('crash-points', p => `<b>${p.street || 'Crash'}${p.cross ? ' & ' + p.cross : ''}</b><br><small>${p.date} · ${p.injured} injured${p.killed ? `, ${p.killed} killed` : ''}${p.ped ? ` · ${p.ped} pedestrian` : ''}<br>${p.factor || ''}</small>`);
  hover('bus-stops', p => `<b>${p.name || 'Bus stop'}</b><br><small>${p.route_ref || ''}</small>`);
}
