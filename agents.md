# agents.md

## Project Overview

**RoadShow** is a single-file web app that finds concerts and music festivals along a road trip route. Users enter a start city, destination, optional stops, a date range, and a search radius — the app geocodes the route, queries up to three concert APIs in parallel, and renders results on an interactive map alongside a filterable list.

The app works in demo mode without any API keys, generating realistic placeholder data so the UX can be evaluated before live credentials are provided.

## Repository Structure

```
roadshow-by-claude/
├── README.md            # One-line project description
├── agents.md            # This file
└── roadshow(2).html     # Entire application (HTML + CSS + JS, ~1000 lines)
```

**Everything lives in a single HTML file.** There is no build step, no package manager, no bundler, and no server-side code. All dependencies are loaded from CDNs at runtime.

## Tech Stack

| Layer | Technology |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 (custom properties, CSS Grid, animations) |
| Logic | Vanilla JavaScript (ES6+, async/await, Fetch API) |
| Mapping | Leaflet.js v1.9.4 via CDN |
| Tiles | OpenStreetMap / Carto |
| Fonts | Google Fonts (Bebas Neue, DM Mono, Playfair Display) |

### External APIs

| API | Purpose | Required |
|---|---|---|
| Ticketmaster Discovery | Major venue concerts | Optional (key stored in UI) |
| Jambase | Indie/regional shows | Optional |
| Eventbrite | DIY/self-promoted events | Optional |
| Spotify | Match user's top artists | Optional |
| Deezer | Import artist favorites | Optional |
| Nominatim (OSM) | Geocode city names → lat/lon | No key needed |
| OSRM | Calculate driving routes | No key needed |

API keys are entered through modal dialogs in the UI and stored in JavaScript state only — they are never persisted to disk or sent anywhere except the respective API.

## Key JavaScript Functions

| Function | File location (approx. line) | Purpose |
|---|---|---|
| `searchConcerts()` | ~line 400 | Main orchestrator: geocode → route → fetch concerts → render |
| `geocode(city)` | ~line 340 | Nominatim: city string → `{lat, lon}` |
| `getRoute(pts)` | ~line 360 | OSRM: array of points → GeoJSON route geometry |
| `fetchTM()` | ~line 450 | Ticketmaster API call |
| `fetchJB()` | ~line 510 | Jambase API call |
| `fetchEB()` | ~line 560 | Eventbrite API call |
| `mockData()` | ~line 620 | Demo mode: generate realistic fake concerts |
| `renderResults()` | ~line 700 | Populate the results panel with concert cards |
| `addConcertMarkers()` | ~line 750 | Place Leaflet markers for each concert |
| `cacheKey()` / `cacheDateCovers()` / `filterByDate()` | ~line 380 | Client-side cache to avoid redundant API calls |
| `openModal()` / `saveKey()` | ~line 800 | Modal UI for API key input |

## Layout

The app uses a fixed 3-column CSS Grid (`320px | 340px | 1fr`):

- **Left (320px)** — Controls sidebar: route inputs, date pickers, radius/buffer sliders, API key connectors
- **Center (340px)** — Results panel: filterable/sortable concert card list
- **Right (flex)** — Leaflet map with route, city markers, and concert markers

## Caching Behavior

Concert data is cached in memory keyed by `route + radius + connected API keys`. If the user searches the same route again with a date range that falls within the previously cached date range, the cache is reused and filtered client-side. This avoids redundant API calls.

## Making Changes

### What to read first

Before modifying anything, read the full `roadshow(2).html` file. Because all HTML, CSS, and JS are in one file, changes in one section can affect others. Pay attention to:

- CSS custom properties defined in `:root` — these are the design tokens used throughout
- The `state` object (near the top of the `<script>` section) — it holds all runtime state including API keys, cached results, the Leaflet map instance, and route geometry

### Adding a new API source

1. Add a new `.api-row` entry in the HTML sidebar for the API key UI
2. Add a `fetchXX()` function following the pattern of `fetchTM()` / `fetchJB()` / `fetchEB()`
3. Call `fetchXX()` in parallel inside `searchConcerts()` alongside the existing `Promise.all([...])` calls
4. Add a source filter toggle to the results panel header
5. Assign a distinct marker color in `addConcertMarkers()`

### Modifying the map

The Leaflet map instance is stored in the `state` object. Markers are cleared and redrawn on each search. Do not call `map.remove()` — reinitialize only if the map container is removed from the DOM.

### Styling conventions

- Use existing CSS custom properties (`--accent`, `--bg2`, `--text2`, etc.) rather than hardcoded colors
- Font sizes use `rem` units with very small values (`.56rem`, `.7rem`) — this is intentional for the dense UI
- The `DM Mono` monospace font is used for all body text; `Bebas Neue` for display/headings

### Demo mode

If no API keys are connected, `mockData()` is called instead of the live fetch functions. When testing UI changes, demo mode is the default — no credentials needed. Ensure changes degrade gracefully when `mockData()` is the data source.

## Common Tasks for AI Agents

### Debugging a broken search

1. Open browser DevTools console
2. Check for failed network requests to Nominatim or OSRM (no-key APIs — failures indicate network or CORS issues)
3. Check for 401/403 errors on Ticketmaster/Jambase/Eventbrite (bad or missing API key)
4. Verify the `state.cache` object to see if stale cached data is being returned

### Adding a new UI control

1. Add the HTML element inside the appropriate `.ss` (sidebar section) div
2. Wire an `oninput` or `onchange` handler that updates `state`
3. If the control should trigger a re-search, call `searchConcerts()` or `renderResults()` as appropriate

### Changing the route calculation

Route geometry comes from OSRM's public API (`router.project-osrm.org`). The `getRoute()` function sends waypoints and receives a GeoJSON LineString. The route is stored in `state.routeGeometry` and used both for drawing the map polyline and for filtering concerts by proximity.

## Constraints and Notes

- **No build step** — edits to `roadshow(2).html` take effect immediately on page reload
- **No tests** — validate changes manually in a browser
- **Single file** — keep it that way unless there is a strong reason to split; the simplicity is intentional
- **No server** — open `roadshow(2).html` directly in a browser (or serve with any static file server); there is no backend
- **API keys are ephemeral** — they exist only in JS memory and are lost on page reload; this is by design
- **CORS** — all external APIs must support CORS from a browser context; server-side proxying is not available
