# Full data and calculation audit

Snapshot audited: **6 October 2026**. The audit covers every school record included in this application, including the historical archive. It does not sample school achievement data.

**Result:** all included achievement, participation, registration, achievement-level, subgroup, identity and location values reconcile with their original publisher records. No unsupported school results or discrepancies in the tested calculation formulas were found. All 31 original files also match fresh downloads from their official publisher URLs byte for byte.

## Coverage

| Source-backed records | Verified |
| --- | ---: |
| Current school records, 2021–22 through 2025–26 | 35,292 |
| Historical school records, 2017–18 and 2018–19 | 14,810 |
| Total school records | 50,102 |
| Distinct schools across both series | 3,906 |
| Current school index entries | 3,845 |
| Official board records | 769 |
| Official Ontario records | 20 |
| Percentage/count rounding checks | 709,551 |
| Preserved originals matched to fresh publisher downloads | 31 / 31 |

The source audit performs more than 1.19 million field comparisons. It reads the original ZIP members and XLSX cells directly, independently of the extraction script. It checks that no source rows were added, dropped or duplicated; preserves suppression and bounded markers; checks joins between CSV parts; and reconciles every deployed dataset, extracted CSV and original download with its local counterpart. Every reporting school has a coverage entry in the source audit report.

Percentages with numeric counts and nonzero denominators agree exactly with the rational count/denominator calculation after EQAO’s documented banker’s rounding. This is a verification only: the application continues to use the publisher’s percentages and never reconstructs suppressed or bounded results.

## Calculations checked

The calculation suite executes the actual functions from the application and compares their outputs with independently computed expectations. It covers both grades, all three subjects and every selected year for every current school: **115,350 school/subject/period combinations**, **346,050 benchmark comparisons**, and **115,350 chart series**. It checks all **67,328 generated findings**, **300 board filter/subject selections**, **120 historical filter/subject selections**, and **6,062,217 same-language coordinate pairs**.

| Calculation | Basis verified |
| --- | --- |
| Annual change | Selected-year published percentage minus the immediately previous year’s percentage; unavailable if either is missing |
| Ontario or board gap | School percentage minus the matching language/grade/year benchmark; board membership follows each school-year record |
| Annual relative progress | School’s annual change minus the benchmark’s annual change, equivalently the change in their gap |
| Longer-period change | Current percentage minus the earliest numeric prior result; relative progress starts at the earliest paired result |
| Median board | Middle numeric board result, or mean of the two middle results; each filtered board counts equally |
| Historical school mean | Arithmetic mean of numeric school percentages, with the correct reporting/listed school counts; unavailable markers excluded |
| Achievement distribution | Published level percentages retained; segment widths normalized by their rounded total for display |
| School distance | Haversine distance from published coordinates, checked independently using unit-vector central angles and the same 6,371 km Earth-radius approximation |
| Generated questions | Two consecutive declines, three consecutive below/above-Ontario results, or a latest relative change of at least five points; each figure and year checked against the relevant results |
| Charts and sorting | Numeric plotted values and coordinates, breaks at missing years, complete source-row membership, and unavailable values kept at the end of numeric sorts |
| CSV exports | Published source values, signed numeric differences, benchmark gaps, participants and source filenames |

Arbitrary peer comparisons use the same verified arithmetic. The exhaustive history checks include one deterministic real peer per school/grade/selected year. Full comparison-table export rendering is tested on a distributed selection of schools plus every school without location-source metadata; it is separate from exhaustive testing of the numerical helpers. The browser suites check real downloads, rendering, controls, French benchmarks, suppression, missing records, and desktop/mobile layouts.

## Corrections made

- Negative calculated values now remain numbers in exported CSVs. Previously, the formula-protection prefix also converted negative numeric changes and gaps into text. Formula-like text remains escaped.
- A school without location-source metadata now shows that its location source is unavailable. Previously, it could receive a default workbook link and year suggesting evidence that was not present for that school.
- Source-file totals and byte sizes now come from the manifest rather than hardcoded display values.

No achievement percentages or student counts needed changing.

## Evidence and repeatable checks

- [Source reconciliation and per-school coverage](../data/processed/audit.json), including dataset hashes and verifier hash.
- [Calculation report](../data/processed/calculation-audit.json), including hashes of the actual application code tested.
- [Fresh publisher download verification](../data/processed/publisher-audit.json), including URLs, timestamps and matched hashes.
- [Source manifest](../data/processed/sources.json), including original publisher URLs and local checksums.
- [Methodology](methodology.md), including reporting definitions and interpretation limits.

The same reports can be downloaded from the app’s Sources view. Reports describe their audited snapshot and code; rerun validation after changing data or calculations.

The live dashboard’s 18 published data files were also downloaded and matched the audited local datasets byte for byte; see [live snapshot comparison](../data/processed/live-snapshot-audit.json). The export and location-source display corrections are deployed on Tailnow and Vercel.

From the repository root, with the README’s Python dependency and browser setup:

```sh
python3 tests/data.py
npm run check
npm test
```

The browser suites need the local server described in the README. `npm run test:calculations` runs calculations without a browser/server, and `npm run test:browser` runs only the interaction suites. Optional fresh online verification:

```sh
python3 tests/publishers.py
```

Online verification downloads into memory and never replaces originals. A future publisher revision or unavailable download makes this check fail explicitly instead of silently updating the snapshot.

## Scope limits

Source agreement verifies this application’s handling of published data; it cannot certify how publishers collected their underlying student data. EQAO itself notes that the 2021–22 CSVs can differ from its interactive dashboards. Coordinates have their own publication years, and distances are approximate straight-line distances. Five-point question thresholds are display rules, not significance tests. Annual cohorts differ, and the results do not establish causal school effects. Missing and suppressed values remain unavailable.

Publisher references: [EQAO Open Data](https://www.eqao.com/about-eqao/open-data/) and [Ontario school information and student demographics](https://data.ontario.ca/dataset/school-information-and-student-demographics).
