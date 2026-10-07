# Data coverage and interpretation

Snapshot: 6 October 2026.

## Primary sources

1. [EQAO Open Data](https://www.eqao.com/about-eqao/open-data/) — Grade 3 and Grade 6 achievement archives and aggregate field definitions, 2021–22 to 2025–26.
2. [Ontario: School information and student demographics](https://data.ontario.ca/dataset/school-information-and-student-demographics) — XLSX resources, 2017–18 to 2024–25, including both language editions.
3. [EQAO reporting FAQ](https://www.eqao.com/frequently-asked-questions/faq-eqao-reporting/) — identifies the reporting tool's results as 2021–22 onward.
4. [EQAO data request form](https://www.eqao.com/wp-content/uploads/2025/03/data-requests-form-en-Feb-25-2025.pdf) — route for historical data not in the public repository. No request was submitted and nobody was contacted.
5. [McMaster SEAL dataset listing](https://facsocsci.mcmaster.ca/seal/information-for-potential-clients/seal-datasets) — identifies its EQAO dataset as restricted, not a downloadable public substitute.

The source search covered EQAO's current official repository, Ontario's current CKAN catalogue and full resource metadata, the federal open-data mirror, Ontario's board-achievements catalogue, and targeted searches for earlier province-wide CSV/XLSX releases. Earlier individual-board PDFs and historical research references were found; they were not presented as a complete province-wide raw dataset. No pre-2017–18 complete raw download was located. The catalogue's 2014–15 to 2020–21 dates under EQAO's **Agency Expenses** are expense data, not older achievement results.

## Current series

Use `pctOverallR_L34`, `pctOverallW_L34` and `pctOverallM_L34` directly. These fields are the published percentage of fully participating students at or above the provincial standard (Levels 3 and 4). The denominator is subject-specific. Board and provincial values use the publisher's corresponding `OrgType=B` and `OrgType=P` rows; never average schools to obtain these results.

`Language` (`Lang` in 2021–22) separates English/French systems. `BoardMident` and `SchoolMident` are stable identifiers for joins; historical Ministry board IDs have a leading B removed. Ministry school identifiers retain six digits, including leading zeros. Organisation type plus organisation ID plus language joins CSV parts 1 and 2 within a grade/year. Names displayed for current records come from EQAO; board type and city context come from the latest downloaded Ministry workbook where possible.

All source rows have `ApplySuppression=1`. `Suppressed=0` indicates reportable results; other statuses are retained but numerical chart values are nulled. Counts are not used to recover suppressed achievement percentages. N/R or S. R. indicates suppressed small groups; N/D or A/D indicates no data; W indicates withheld. Bounded percentages remain text, not exact numerical chart values. Source definitions describe banker’s rounding and the `<1%` display convention. Published whole percentages are preserved; differences use percentage points of those rounded values.

The 2021–22 repository note warns that CSV values may differ from Power BI values because of calculation methods. The dashboard consistently uses CSVs. The 2021–22 registered-count definition also excludes exempt students, unlike subsequent dictionaries; registered counts are stored but no across-year participation-rate calculation is inferred from them.

Board subgroups come from published percentages: G1 male, G2 female, E1 English/French language learners, S1 special education needs excluding gifted. Groups overlap and are not additive. Provincial benchmarks cover public and provincial schools (`FundingType=1 & 3`). “All district boards” lists Public/Catholic districts; “Other authorities” exposes the remaining available board organisations separately. The Ontario benchmark never changes when a board-type filter is applied.

## Historical archive

The 2017–18 and 2018–19 Ministry workbooks contain school results and three-year change columns. Only the reported achievement percentages are used. Earlier values are **not back-calculated** from rounded change fields. No grade-specific participant counts are supplied, so official board percentages cannot be reconstructed.

Historical board summaries explicitly show unweighted arithmetic means of numeric school percentages, with the number of reporting schools and number listed. Missing, withheld, suppressed and bounded values are excluded from these means. The full school list preserves their original markers. These school means are not official board results or student-weighted estimates. Schools marked NA in all three subjects for a grade are excluded from that grade's archive list.

Current assessments differ in format, curriculum and reporting basis. The historical archive is therefore a separate interface and chart series, not a continuous line with 2021–22 onward.

The 2019–20 and 2020–21 Ministry resources explicitly say their EQAO results are based on 2018–19. They are downloaded as originals but do not create new assessment years. More recent Ministry copies overlap EQAO's current files and are retained as source originals, not appended as duplicate achievement observations.

## Interpretation

These are different student cohorts each year. Changes are descriptive and do not estimate the causal effect of a school or board. Cohort composition and participation matter. No composite score, causal ranking, missing-data imputation or longitudinal student tracking is used. English and French systems are shown separately.

## Chart presentation

Trend lines use a labelled vertical scale fitted to the displayed numeric series, with at least 30 percentage points of range and bounds between 0% and 100%. Adding boards can change that range. Subject-profile bars always use a common 0–100% scale. Missing and suppressed values remain gaps in lines and retain their source markers in tables.

The board-view headline compares Ontario's selected-year result with the first year in the current series. The annotation identifies the lowest numeric Ontario result across the displayed series (the earliest year if tied). Neither makes a causal claim. Shading identifies the selected year; the full current series remains visible. Labels beside line ends show the latest reported numeric result for each series, with its school year when earlier than the last displayed year. On narrow screens these labels become a compact list immediately below the chart.

## Reproducibility

`scripts/build_data.py` creates board/province metadata, lazy-loaded grade/year school files, a long-form board CSV, and a validation report. Original bytes are preserved. `data/processed/sources.json` contains SHA-256 checksums, publisher URLs and retrieval dates. The public dashboard includes copies of all 31 original resources. The source archive remains local and organized by publisher filename; extracted CSVs are grouped by original archive name.
