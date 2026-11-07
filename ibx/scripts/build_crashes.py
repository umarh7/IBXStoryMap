import json, urllib.request, urllib.parse
BOX = (40.610, -73.995, 40.645, -73.955)
q = urllib.parse.urlencode({
  '$where': f"crash_date >= '2022-01-01' AND within_box(location,{BOX[2]},{BOX[1]},{BOX[0]},{BOX[3]})",
  '$select': 'crash_date,latitude,longitude,number_of_persons_injured,number_of_persons_killed,number_of_pedestrians_injured,number_of_cyclist_injured,contributing_factor_vehicle_1,on_street_name,cross_street_name',
  '$limit': 50000})
req = urllib.request.Request('https://data.cityofnewyork.us/resource/h9gi-nx95.json?' + q, headers={'User-Agent': 'ibx-storymap/0.1'})
rows = json.load(urllib.request.urlopen(req, timeout=120))
feats = []
for r in rows:
    try: lat, lon = float(r['latitude']), float(r['longitude'])
    except (KeyError, ValueError): continue
    if not (BOX[0] <= lat <= BOX[2] and BOX[1] <= lon <= BOX[3]): continue
    inj = int(r.get('number_of_persons_injured', 0) or 0); killed = int(r.get('number_of_persons_killed', 0) or 0)
    feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [round(lon, 5), round(lat, 5)]},
                  'properties': {'date': r['crash_date'][:10], 'injured': inj, 'killed': killed,
                                 'ped': int(r.get('number_of_pedestrians_injured', 0) or 0), 'cyc': int(r.get('number_of_cyclist_injured', 0) or 0),
                                 'factor': r.get('contributing_factor_vehicle_1', ''), 'street': r.get('on_street_name', '').strip(), 'cross': r.get('cross_street_name', '').strip()}})
json.dump({'type': 'FeatureCollection', 'features': feats}, open('public/data/crashes.geojson', 'w'), separators=(',', ':'))
print(f'{len(feats)} crashes since 2022 in box; injured={sum(f["properties"]["injured"] for f in feats)}, killed={sum(f["properties"]["killed"] for f in feats)}')
