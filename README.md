# EQAO Explorer

EQAO Explorer is a responsive dashboard for Ontario Grade 3 and Grade 6 reading, writing, and mathematics achievement. It brings official EQAO and Ontario Ministry of Education data into one interface for exploring schools, comparing boards, and viewing provincial trends.

The app is static HTML, CSS, and JavaScript. It has no backend, database, account system, or API key requirement. The repository includes the prepared data and original source downloads, so you can run or deploy it immediately without rebuilding the dataset. This is an independent project, not an official EQAO reporting tool.

## What you can explore

- Official school, board, and provincial results for **2021–22 through 2025–26**.
- A separate historical school archive for **2017–18 and 2018–19**.
- English- and French-language systems, public and Catholic district boards, and other authorities.
- Board trends, provincial benchmarks, participation counts, subject profiles, published student-group results, and school histories.
- Searchable, sortable tables and CSV exports of the current filtered board results.
- Downloads of all 31 original publisher files, with source URLs and checksums.

The data snapshot was retrieved on **6 October 2026**. There is no automatic refresh. Suppressed or missing results remain missing; the app does not estimate them. Historical school averages are not official board results and are kept separate from the current series. See [the methodology](docs/methodology.md) for coverage, definitions, and interpretation limits.

## Quick start: run the app locally

You need Git and Python 3. Node.js is only needed for the optional browser tests. Python 3.9 or later is needed if you also rebuild the data.

```sh
git clone https://github.com/palpen/eqao-explorer.git
cd eqao-explorer
python3 -m http.server 8766 --bind 127.0.0.1 --directory site
```

Open **http://127.0.0.1:8766/** in your browser. Keep the terminal running; press `Ctrl+C` to stop the server. On Windows, use `py -3` instead of `python3` if that is your installed Python launcher.

Serve the app over HTTP rather than opening `site/index.html` directly: the app fetches JSON files, which browsers can block under `file://`. If port 8766 is occupied, choose another port and use it in the browser URL.

You can also download this repository through GitHub's **Code → Download ZIP**, extract it, and run the same server command from the extracted folder.

## Download the data

### From the app

Open the **Sources** view and select an original ZIP or XLSX download. The board results table also has a CSV export for its current selection. Source downloads work locally and on any deployment that includes the complete `site/` folder.

### From this repository

| What you need | Where to find it |
| --- | --- |
| Original EQAO ZIPs, field-definition workbooks, and Ministry XLSX files | [data/raw/](data/raw/) |
| Extracted achievement CSV parts, grouped by source archive | [data/raw/extracted/](data/raw/extracted/) |
| Normalized board and school datasets | [data/processed/](data/processed/) |
| One CSV of current board results across grades, years, languages, and subjects | [board-results.csv](data/processed/board-results.csv) |
| Publisher URLs, retrieval dates, byte sizes, and SHA-256 checksums | [sources.json](data/processed/sources.json) |
| Download plan with publisher metadata | [download-plan.json](data/download-plan.json) |
| Copies of originals served by the app | [site/downloads/](site/downloads/) |

For a single file, open it on GitHub and use **Download raw file** or **Raw**, depending on the file type. To get the entire snapshot, clone the repository or download its ZIP as described above.

### From the original publishers

- [EQAO Open Data](https://www.eqao.com/about-eqao/open-data/): Grade 3/6 achievement ZIPs and aggregate field definitions.
- [Ontario school information and student demographics](https://data.ontario.ca/dataset/school-information-and-student-demographics): school-information XLSX workbooks.

The included snapshot contains 10 achievement ZIPs, 5 field-definition workbooks, and 16 English/French Ministry workbooks: **31 files, 36,831,866 bytes**. French workbook editions are retained as originals but are not ingested a second time. Questionnaire datasets are outside this app's scope. Consult the publishers' terms for reuse of their data.

## Re-download and rebuild the included snapshot

This is optional. The repository already contains everything needed to run the app.

You need Python 3.9+, `openpyxl`, and curl with parallel-download support (7.66.0+). Run these commands from the repository root:

```sh
python3 -m venv .venv
```

Activate the environment on macOS/Linux:

```sh
source .venv/bin/activate
```

Or activate it on Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Then install the extraction dependency, prepare the download list, download the original files, rebuild the app data, and validate it:

```sh
python -m pip install openpyxl
python scripts/prepare_downloads.py
curl --config scripts/downloads.curl
python scripts/build_data.py
python tests/data.py
```

On Windows PowerShell, use `curl.exe` for the download command to avoid older PowerShell's `curl` alias.

- `prepare_downloads.py` reads the **saved catalogue snapshots** and writes `data/download-plan.json` and the local `scripts/downloads.curl` configuration.
- curl downloads publisher files into `data/raw/`, replacing files with matching names. If a download fails, resolve the connection or publisher URL issue and rerun it before rebuilding.
- `build_data.py` extracts achievement CSVs, normalizes records into `data/processed/` and `site/data/`, and copies original downloads into `site/downloads/`.
- `tests/data.py` independently checks records against the original CSV/XLSX files and verifies download checksums.

This process rebuilds the included snapshot; it does **not** discover new school years. Refreshing the dataset requires updating catalogue snapshots, source years, snapshot dates, coverage labels, and validation expectations together, then checking for publisher schema and methodology changes. Re-downloaded files may differ if a publisher revises them; compare the source manifest before accepting a refreshed snapshot.

## Deploy the app yourself

Publish **the contents of `site/`** as the web root. The deployed root must contain:

```text
index.html
app.js
style.css
data/
downloads/
```

No build command or runtime dependencies are required. Keep both data folders: without `data/`, the dashboard cannot load results; without `downloads/`, original source links will fail. The app uses relative paths and can be served at a domain root or a subdirectory such as `/eqao-explorer/`.

### Any static web host

1. Clone or download this repository.
2. Choose a static hosting service or an existing web server.
3. Set its publish/output directory to `site`. If it requires a build command, leave it empty where supported; there is no compilation step.
4. Upload or publish the entire directory, including JSON, CSV, ZIP, and XLSX files.
5. Open the deployed URL and follow the verification steps below.

For a manual upload, you can create a deployment ZIP:

```sh
python3 scripts/package_site.py
```

This creates `releases/eqao-explorer.zip`, with `index.html` at the archive root, plus a size/checksum report at `releases/package.json`. Extract or upload the ZIP according to your host's requirements. Local release files are excluded from Git.

A public static host makes the app and included downloads publicly accessible. For private access, use a host with access controls or a private network.

### An existing web server

Copy the contents of `site/` into the directory your server serves for the intended URL. Configure the server to serve `index.html` as the directory index and to serve the data and download files as static files. Use your server's HTTPS setup for remote access. The Python quick-start server is intended for local preview; use a production static server for ongoing hosting.

### Optional: an existing Tailnow installation

If you already run Tailnow and have access to its project publishing API:

```sh
python3 scripts/package_site.py
curl --fail --form file=@releases/eqao-explorer.zip https://YOUR-TAILNOW-HOST/api/publish/eqao-explorer
```

Replace `YOUR-TAILNOW-HOST` with your own host. This requires a separately configured Tailnow service and its network/access requirements; Tailnow is not included in this repository. Publishing replaces that project's deployed copy, so retain the previous release ZIP if you need a rollback. Tailnow and Tailscale are optional; neither is required for ordinary static hosting.

## Verify your installation

Open the app and check that:

1. Board results load and Grade 3/6, subject, year, language, and board-type filters work.
2. School search and a school-history dialog load.
3. The historical archive and Sources view open.
4. A CSV export and an original source download succeed.
5. The layout fits a narrow browser window.

For automated browser checks, install Node.js 20+ and run:

```sh
npm ci
npx playwright install chromium
```

On Linux, Playwright may also require system browser dependencies; `npx playwright install --with-deps chromium` installs them where you have the required permissions.

Start the local server in one terminal using the quick-start command. In a second terminal at the repository root, run:

```sh
npm run check
npm test
```

To test a deployed installation instead:

```sh
node tests/browser.mjs https://YOUR-HOST/eqao-explorer/
```

Include a trailing slash for a directory URL. The browser suite checks desktop/mobile layouts, filters, charts, exports, school history, the archive, all 31 source download links, and uncaught browser errors. Screenshots and its report are written into `tests/` and excluded from Git. Set `CHROME_PATH` if you want to use an existing Chrome executable instead of Playwright's Chromium.

If results fail to load, confirm `data/core.json` and the school JSON files are reachable beneath the app URL. If source links fail, confirm `downloads/` was uploaded. When updating a deployment, replace the complete `site/` contents together so code and data stay consistent.

## Repository layout

```text
data/
  raw/                Original publisher files and saved catalogue snapshots
    extracted/        Achievement CSV parts grouped by source archive
  processed/          Normalized JSON, board CSV, provenance, validation report
  download-plan.json  Publisher URLs and catalogue metadata
docs/                 Coverage and methodology
scripts/              Download preparation, normalization, and packaging
site/                 Complete deployable app, data, and source downloads
tests/                Data and browser verification
releases/             Generated local deployment packages (Git-ignored)
```

For details on suppressed values, denominators, historical comparisons, and what the charts can support, read [docs/methodology.md](docs/methodology.md).
