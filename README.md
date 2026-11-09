# IBX Storymap — McDonald Avenue at the proposed Interborough Express stop

MCHC 2001 field research story map. Live site: https://umarh7.github.io/IBXStoryMap/

## Edit the story (no coding)

All content lives in one Google Sheet. Edit a cell, refresh the site.

**Sheet: https://docs.google.com/spreadsheets/d/1GwFD3xJSq5wqUit-ZQm4mX3OrzQrjRwxOF_7k7nKKu4/edit**

| Tab | What it controls |
|---|---|
| Chapters | One row = one scrolling chapter: Chapter, Description (HTML ok), Media Link (image / YouTube embed / mp3), Media Credit, Latitude, Longitude, Zoom, Pitch (tilt 0-60), Bearing (rotation), Layers, Chart |
| Options | Title, subtitle, basemap (dark / liberty), Title Stats, Research Area corners, credits |
| Stores | One row per business: name, category, lat/lon, Interviewed yes/no, quote, photo |
| Notes | Editing guide and layer vocabulary |

**Layers** - comma-separated words that fade in for that chapter:
ibx, f-line, stations, buses, walkshed, research-area, stores, interviewed, crashes, income, transit-share, no-car, commute-time, race, fit-ibx

**Chart** - income, transit-share, no-car or commute-time adds a bar chart (near the stop vs. corridor).

**Finding coordinates:** open the site with ?edit on the end of the URL, click anywhere on the map, paste the copied values into Latitude / Longitude.

## How it works

Vite + MapLibre GL (3D vector map, OpenFreeMap tiles) + Scrollama. Data layers are built by scripts in ibx/scripts/:
build_tracts.py (US Census ACS 2019-2023 by tract, needs CENSUS_KEY), build_crashes.py (NYPD collisions 2022+),
Overpass queries for the F line, Bay Ridge Branch (IBX alignment), stations, B11 and bus stops.
snapshot_sheet.py caches the Sheet as a JSON fallback at every deploy.

## Run locally

    cd ibx && npm install && npm run dev

Pushing to main deploys to GitHub Pages via .github/workflows/deploy.yml.

## Credits

Original scaffold: Leaflet Storymaps with Google Sheets by HandsOnDataViz (Ilya Ilyankou and Jack Dougherty).
Map data (c) OpenStreetMap contributors, OpenFreeMap / OpenMapTiles. Census data: US Census Bureau ACS. Crash data: NYC Open Data.
