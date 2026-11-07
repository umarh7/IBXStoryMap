import csv, io, json, urllib.request
SHEET = '1GwFD3xJSq5wqUit-ZQm4mX3OrzQrjRwxOF_7k7nKKu4'
for tab in ('Chapters', 'Options', 'Stores'):
    url = f'https://docs.google.com/spreadsheets/d/{SHEET}/gviz/tq?tqx=out:csv&sheet={tab}'
    text = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'ibx-storymap/0.1'}), timeout=60).read().decode('utf-8')
    rows = [{k.strip(): (v or '').strip() for k, v in r.items()} for r in csv.DictReader(io.StringIO(text))]
    rows = [r for r in rows if any(r.values())]
    json.dump(rows, open(f'public/data/{tab.lower()}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'{tab}: {len(rows)} rows')
