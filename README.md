# EQAO Explorer

A responsive dashboard for Ontario Grade 3 and Grade 6 reading, writing and mathematics achievement.

## What is included

- Official board, school and provincial results for **2021–22 through 2025–26**.
- Historical school results for **2017–18 and 2018–19**.
- English- and French-language systems, public and Catholic district boards, plus other authorities.
- Board trend comparisons, provincial benchmarks, participation counts, subject profiles, published student-group results, school histories, sortable/searchable tables, and filtered CSV exports.
- Direct downloads of all original source files and a provenance manifest.
- An open editorial layout with serif headings, restrained chart colors, direct series labels, exact data-driven findings, and inline annotations. Trend axes adapt to the displayed series; profile bars share a 0–100% scale.

The earliest complete province-wide raw download located in the current official catalogues was 2017–18. This is not a claim that earlier EQAO assessments did not exist. Older historical data may be obtainable through EQAO's data request process. See `docs/methodology.md` for the search boundary and measurement differences.

## Folder layout

```
data/
  raw/                Original publisher ZIPs and XLSX workbooks; catalogue snapshots
    extracted/        All original achievement CSV parts, grouped by archive
  processed/          Normalized JSON, board-results.csv, sources.json, validation.json
  download-plan.json  Source URLs and original catalogue metadata
docs/                 Methodology and coverage notes
scripts/              Download preparation, normalization and packaging
site/                 Deployable application, normalized data and original downloads
tests/                Browser verification, screenshots and a sample filtered export
releases/             Local deployment ZIP and records (excluded from Git)
```

## Source snapshot

Retrieved **6 October 2026**. The archive includes 31 publisher files (36,831,866 bytes):

- 10 Grade 3/6 achievement ZIPs, 2021–22 to 2025–26.
- 5 annual aggregate field-definition workbooks.
- 16 English/French Ontario school-information workbooks, 2017–18 to 2024–25.

`data/processed/sources.json` records the original URL, local path, byte size and SHA-256 digest of each file. French workbook editions are translations that also include both school systems, so they are downloaded but not double-counted. Questionnaire ZIPs are outside this achievement-results scope.

## Rebuild and preview

The web app is dependency-free HTML/CSS/JavaScript. Source extraction needs Python and `openpyxl` (read-only workbook extraction). Install the data extraction dependency with `python3 -m pip install openpyxl`.

From this folder:

```sh
python3 scripts/prepare_downloads.py
curl --config scripts/downloads.curl
python3 scripts/build_data.py
node --check site/app.js
python3 -m http.server 8766 --bind 127.0.0.1 --directory site
```

The first command rebuilds the download plan from the saved catalogue snapshots; it does not fetch new catalogues automatically. `build_data.py` intentionally validates this snapshot. A future source refresh should update dates, years, catalogue files and coverage labels together and recheck schema/methodology changes.

Browser verification uses Playwright (install with `npm install`) and its Chromium browser (install with `npx playwright install chromium`):

```sh
node tests/browser.mjs
```

## Publish with Tailnow

```sh
python3 scripts/package_site.py
curl --fail --form file=@releases/eqao-explorer.zip https://YOUR-TAILNOW-HOST/api/publish/eqao-explorer
```

Only the contents of `site/` are published. Tailnow's existing project publishing API replaces the deployed copy. Preserve a release ZIP before any later redeployment. No public hosting service or scheduled refresh is configured.

## Validation

Normalization checks that planned downloads exist, source keys are unique, achievement CSV parts join exactly, suppression is respected, and every current numeric achievement rate matches its source numerator/denominator within rounding tolerance. `validation.json` contains the row counts and completed checks.

Browser checks cover desktop and mobile, Grade 3/6, subjects, school systems, board types, search, sorting, missing states, CSV exports, school history, the legacy archive, source links and console errors. Screenshots are in `tests/`.
