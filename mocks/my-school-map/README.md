# My school search-map preview

An isolated review mock-up using the real public school directory and published 2025–26 Grade 3/6 results. Production files, app state, analytics and deployments are not changed.

Run `python3 mocks/my-school-map/build.py`, then serve `mocks/my-school-map/dist/` with a local HTTP server. School data, styles and application code are embedded in `dist/index.html`. Use the HTTP preview for the phone iframe, keyboard controls and browser storage. MapLibre and OpenFreeMap require internet access.

## Try the interaction

- Search a school name, city, board or school number. Name matches are ranked first; accents and punctuation are normalized.
- Hover a result or use arrow keys to fly to its location. Enter, a result click or a map pin selects the school. A preview never changes the chosen school.
- Search matches become map pins and clusters. Click a cluster to zoom in. Use Show matches to frame the matching schools.
- Switch Quiet / Street detail to change the background while retaining matches, selection and camera position.
- Schools without published coordinates stay searchable and selectable. Their location is explicitly unavailable. Failed map assets leave search/results usable.
- Narrow/mobile screens put the map between search and results. Animations respect the operating system's reduced-motion preference.
- Every list row has a separate Save button. Saving does not choose the school or change the search. Saved schools opens the persistent browser-local list; choose a school to return to its map/results, or remove it with Undo.
- Use **Phone view → Show keyboard** to try the compact search/map layout. The keyboard preview has working letter, space, delete and Done keys; normal typing in the search field also works. The map and scrollable result/save controls remain above it. Done restores navigation so you can browse Saved schools.

## Mobile keyboard and saved-list boundaries

The normal mobile layout removes the repeated My school heading, example searches and visible help text. Native keyboard layouts listen to the VisualViewport height/offset and resize the map/results workspace to the visible area; Chromium also receives `interactive-widget=resizes-content`. Pin animations and background swaps still pass through the existing renderer adapter.

The review controls are outside the depicted product. Phone view renders the same page in a 390px-wide iframe. Opening the preview keyboard reduces that iframe from 760px to 490px and activates the same compact layout. This is a review simulation, not a substitute for eventual iOS/Android device checks.

`src/saved-schools.js` uses only the prototype key `eqao-map-mockup-saved-schools-v1`. It stores a versioned list of up to 100 school IDs, refreshes other preview tabs via storage events and falls back to an in-memory list if browser storage is unavailable. The real app's shortlist is untouched. No account or cross-device sync is introduced.

Viewport references: [VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport) and [Chrome keyboard resize behavior](https://developer.chrome.com/blog/viewport-resize-behavior).

## Two independent migration boundaries

1. **Background provider** — `src/map-providers.js` stores a background registry, with a label, kind and style URL. The style menu is generated from that registry. Both demo styles use OpenFreeMap. Another compatible vector-style provider can replace/add registry entries without changing search, school data, preview or selection logic. Preserve each provider's attribution and account/token requirements.
2. **Interactive renderer and animation** — `createSchoolMap()` delegates to an engine factory. The UI in `src/app.js` uses only the adapter contract below, never MapLibre classes, GeoJSON layers or camera calls. To migrate to Mapbox, Google Maps or another renderer, implement this contract and register the new factory; keep school search and UI unchanged. Provider licensing and capabilities still need evaluation; this is an architectural boundary, not a promise of drop-in compatibility.

The async factory receives `{container, background, onSchoolPreview, onSchoolChoose, onStatus}` and returns:

| Method | Meaning |
| --- | --- |
| `setSchools(schools)` | Display the current matching schools; adapter handles markers/clustering. |
| `highlight(schoolOrNull)` | Highlight a preview without committing selection. |
| `focus(school, {animate})` | Move to one school; return false when coordinates are unavailable. |
| `fit(schools, {animate})` | Frame available locations; return false when none exist. |
| `setBackground(key)` | Change the backdrop while preserving school overlays and camera. |
| `camera()` | Return provider-neutral `{lat, lon, zoom}`. |
| `resize()` / `destroy()` | Manage the map's lifecycle. |

Coordinates in the app are always named `lat` and `lon`. Converting them to provider-specific coordinate order and representing overlays belong exclusively to the adapter. Search, selected-school state and result formatting belong to the UI. Callbacks carry plain school objects.

The two live background choices exercise the provider boundary now. A future renderer adapter would additionally need its own contract/browser checks. This preview does not add a production framework, backend, geocoder or search service.
