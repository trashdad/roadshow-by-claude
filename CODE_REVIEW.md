# Code Review — RoadShow

Reviewed: 2026-02-23
File: `roadshow(2).html` (~1000 lines, single-file vanilla JS/HTML/CSS)

---

## Critical

### 1. XSS — API data injected into `innerHTML`

`mkCard()` (line 979) and `mkPopup()` (line 918) inject API-returned strings directly into the DOM without sanitization. A malicious event name from Ticketmaster, Jambase, or Eventbrite would execute JS in the user's browser.

The city marker popup (line 837) also injects user-typed city names via `bindPopup()`.

**Fix:** Use `textContent` for string insertion, or sanitize with DOMPurify before using `innerHTML`.

---

## High

### 2. Stops parsing bug — commas in city names

Line 777 splits stops on `,`:
```js
const names = [sc, ...st.split(',').map(s=>s.trim()).filter(Boolean), ec];
```

The placeholder `"e.g. Memphis, TN, Baton Rouge, LA"` produces 4 tokens instead of 2 cities. The input format is fundamentally broken.

**Fix:** Use a different delimiter (`;` or newlines), or add per-stop input fields.

---

## Medium

### 3. API keys in URL query strings

All three API integrations (`fetchTM`, `fetchEB`) send credentials as GET parameters, where they appear in browser history and network logs. For a client-side-only app this is hard to avoid entirely, but it should be documented clearly.

### 4. 30 concurrent API requests

`searchConcerts()` fires up to 10 waypoints × 3 APIs = 30 simultaneous requests (line 848–854). Free API keys (especially Ticketmaster) will hit rate limits quickly. Consider batching requests or using a single bounding-box query instead of per-waypoint queries.

### 5. No mobile layout

The three-column grid (`320px 340px 1fr`) has no responsive breakpoints. Unusable on screens under ~800px.

---

## Low

### 6. Date UTC offset edge case

`new Date("YYYY-MM-DD")` is parsed as UTC midnight. Users in negative UTC offsets will see trip-length calculations off by one day.

**Fix:** Parse as local time: `new Date(ds + 'T00:00:00')`.

### 7. `alert()` for validation (lines 765–768)

`alert()` is blocking, unstyled, and disabled in some contexts. Inline validation messages are preferable.

### 8. No map marker clustering

Individual `L.circleMarker` instances for 50+ shows make the map unreadable. Add `Leaflet.markercluster`.

### 9. `p-off` pill state not restored

`saveKey()` removes `p-off` from header pills when a key is added, but there's no way to re-dim them since keys can only be overwritten, not deleted.

---

## Positives

- Cache fingerprinting (route + radius + key presence) is well-designed and correctly invalidates on relevant changes.
- `dedupe()` using `artist+venue+date` as composite key is a reasonable cross-source heuristic.
- OSRM fetch uses `AbortController` with an 8s timeout — good defensive practice.
- Nominatim is called correctly with `User-Agent` and `Accept-Language` headers.
- Demo mode with realistic mock data is a good developer experience touch.
