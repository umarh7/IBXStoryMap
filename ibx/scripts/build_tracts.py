"""Build public/data/tracts.geojson: NYC 2020 tracts + ACS 2023 5-yr metrics, clipped to the IBX corridor."""
import json, os, sys, urllib.request, urllib.parse
KEY = os.environ.get('CENSUS_KEY') or sys.exit('set CENSUS_KEY first: export CENSUS_KEY=yourkey')

OUT = 'public/data/tracts.geojson'
BBOX = (-74.05, 40.58, -73.80, 40.76)          # lon_min, lat_min, lon_max, lat_max  (IBX corridor)
COUNTIES = {'047': 'Brooklyn', '081': 'Queens'}  # FIPS
BORO_TO_COUNTY = {'1': '061', '2': '005', '3': '047', '4': '081', '5': '085'}

VARS = {
  'pop':        'B01003_001E',   # total population
  'income':     'B19013_001E',   # median household income
  'workers':    'B08301_001E',   # workers 16+ (means of transport universe)
  'transit':    'B08301_010E',   # ... who take public transit
  'hh':         'B08201_001E',   # households
  'hh_nocar':   'B08201_002E',   # ... with no vehicle
  'commuters':  'B08303_001E',   # workers not working at home (travel-time universe)
  'agg_min':    'B08135_001E',   # aggregate travel time (minutes)
  'race_tot':   'B03002_001E',
  'white_nh':   'B03002_003E',
  'black_nh':   'B03002_004E',
  'asian_nh':   'B03002_006E',
  'hispanic':   'B03002_012E',
}

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'ibx-storymap/0.1'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)

# ---- 1. ACS numbers ----
acs = {}
for fips in COUNTIES:
    q = urllib.parse.urlencode({'get': ','.join(VARS.values()), 'for': 'tract:*', 'in': f'state:36 county:{fips}', 'key': KEY})
    rows = get(f'https://api.census.gov/data/2023/acs/acs5?{q}')
    hdr, body = rows[0], rows[1:]
    for row in body:
        rec = dict(zip(hdr, row))
        geoid = rec['state'] + rec['county'] + rec['tract']
        num = {k: (float(rec[v]) if rec[v] not in (None, '') and float(rec[v]) > -1e6 else None) for k, v in VARS.items()}
        pct = lambda a, b: round(num[a] / num[b], 4) if num[a] is not None and num[b] else None
        acs[geoid] = {
            'pop': num['pop'], 'income': num['income'],
            'pct_transit':  pct('transit', 'workers'),
            'pct_nocar':    pct('hh_nocar', 'hh'),
            'mean_commute': round(num['agg_min'] / num['commuters'], 1) if num['agg_min'] and num['commuters'] else None,
            'pct_white':    pct('white_nh', 'race_tot'),
            'pct_black':    pct('black_nh', 'race_tot'),
            'pct_asian':    pct('asian_nh', 'race_tot'),
            'pct_hispanic': pct('hispanic', 'race_tot'),
        }
print(f'ACS: {len(acs)} tracts')

# ---- 2. tract polygons ----
gj = get('https://data.cityofnewyork.us/api/geospatial/63ge-mke6?method=export&format=GeoJSON')
print('tract geojson keys sample:', list(gj['features'][0]['properties'].keys()))

def geoid_of(p):
    for k, v in p.items():
        if isinstance(v, str) and len(v) == 11 and v.isdigit() and v.startswith('36'):
            return v
    boro = str(p.get('boro_code') or p.get('borocode') or '')
    ct = str(p.get('ct2020') or p.get('ct') or '').replace('.', '').zfill(6)
    return '36' + BORO_TO_COUNTY.get(boro, '') + ct

def in_bbox(geom):
    def walk(c):
        if isinstance(c[0], (int, float)): yield c
        else:
            for x in c: yield from walk(x)
    pts = list(walk(geom['coordinates']))
    cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
    return BBOX[0] <= cx <= BBOX[2] and BBOX[1] <= cy <= BBOX[3]

def rnd(c):
    return [round(c[0], 5), round(c[1], 5)] if isinstance(c[0], (int, float)) else [rnd(x) for x in c]

# ---- 3. join + clip ----
out, missing = [], 0
for f in gj['features']:
    gid = geoid_of(f['properties'])
    if gid[2:5] not in COUNTIES or not in_bbox(f['geometry']): continue
    d = acs.get(gid)
    if not d: missing += 1; continue
    out.append({'type': 'Feature', 'geometry': {'type': f['geometry']['type'], 'coordinates': rnd(f['geometry']['coordinates'])},
                'properties': {'geoid': gid, 'nta': f['properties'].get('ntaname') or f['properties'].get('nta_name'), **d}})

json.dump({'type': 'FeatureCollection', 'features': out}, open(OUT, 'w'), separators=(',', ':'))
print(f'wrote {OUT}: {len(out)} tracts in corridor, {missing} without ACS data')
