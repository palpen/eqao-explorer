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

These are different student cohorts each year. Changes are descriptive and do not estimate the causal effect of a school or board. Cohort composition and participation matter. The School trends view offers a descriptive equal-weight mean of subject changes, explicitly labelled; it is not a school-quality score. No causal ranking, missing-data imputation or longitudinal student tracking is used. English and French systems are shown separately.

## School trends

The School trends tab compares the selected year with the immediately preceding year in the current series, separately for each grade and language system. The earliest included year has no annual comparison; historical results are never substituted. School identifiers and language join the two year files. The current year's board membership determines board filters.

Reading, writing and mathematics ranks use their own published percentage-point changes. Across all three uses the equal-weight arithmetic mean of the three subject changes, requiring exact numeric percentages in every subject in both years. Its previous/current subject means are averages across subjects, not the percentage of students meeting all three standards. Suppressed, bounded and missing results are excluded, never inferred. Sorting uses unrounded calculated changes; displayed changes and means use one decimal place when needed.

An optional minimum-participant filter requires the selected subject's count to meet the threshold in both years; the combined measure requires each of the three counts to meet it. Unknown counts cannot satisfy a positive threshold. All reported group sizes is the default and does not impose a count threshold. In the combined view, the optional same-direction filter requires all three changes to be strictly positive or all three strictly negative. Zero or mixed changes do not pass it. These are descriptive display filters, not statistical significance tests.

Each largest-increase/decrease list shows at most ten schools and excludes zero changes. Equal unrounded changes share a competition rank (1, 1, 3). Ties are ordered by school name and then identifier, including at the tenth row. Both panels use one common magnitude scale; signed labels identify direction. School names open the existing school dashboard. Subject results and participant counts for both years can be expanded on every row.

All aggregate statistics and the CSV use the complete eligible selection, not just the top ten. Median change gives each school equal weight. Direction shares use eligible schools as the denominator, with exact zero classified as unchanged. The all-three-improving share uses eligible schools with exact paired values in all three subjects; in a subject-specific view this denominator can be smaller than the eligible count. Coverage reports eligible schools out of all current-year schools in the selected language, board type and board filters, with sequential exclusions for absent numeric pairs, participant counts and direction. Distribution bins partition unrounded changes as ≤ −10; (−10, −5]; (−5, 0); exactly 0; (0, +5); [+5, +10); ≥ +10 pp.

Ontario change comes from published provincial records for the matching language/grade/year pair. The combined benchmark uses the equal-weight mean of the three published provincial changes; it does not average schools or change with board filters. Exports include both years' subject values, counts, changes, source filenames and school change minus Ontario change. Small groups can produce large movements, and annual groups differ; these rankings describe results rather than school effectiveness.

## Chart presentation

The **My child’s school** charts share a fixed 0–100% scale across reading, writing and mathematics, including expanded comparisons. They show the current assessment series only through the selected year, so later results do not enter the displayed patterns. Default charts show the school and its language-system Ontario result; expanded charts add the school’s board and chosen schools, with benchmark switches. Board membership follows each school-year record. No equal-weight school average is substituted for Ontario.

The separate board explorer uses a labelled scale fitted to the displayed numeric series, with at least 30 percentage points of range and bounds between 0% and 100%. Adding boards can change that range. Subject-profile bars always use a common 0–100% scale. Missing and suppressed values remain gaps in lines and retain their source markers in tables.

The board-view headline compares Ontario's selected-year result with the first year in the current series. The annotation identifies the lowest numeric Ontario result across the displayed series (the earliest year if tied). Neither makes a causal claim. Shading identifies the selected year; the full current series remains visible. Labels beside line ends show the latest reported numeric result for each series, with its school year when earlier than the last displayed year. On narrow screens these labels become a compact list immediately below the chart.

## Reproducibility

`scripts/build_data.py` creates board/province metadata, the school identity/location index, lazy-loaded grade/year school files, a long-form board CSV, and a validation report. Original bytes are preserved. `data/processed/sources.json` contains SHA-256 checksums, publisher URLs and retrieval dates. The public dashboard includes copies of all 31 original resources. The source archive remains local and organized by publisher filename; extracted CSVs are grouped by original archive name.

## School-first comparisons and questions

Annual change requires numeric values in both the selected school year and the immediately preceding year. The benchmark gap is school percentage minus the corresponding published benchmark percentage. Relative annual progress is this year’s gap minus last year’s gap, calculated separately for Ontario, the board and each selected school. A positive value means the school gained ground; a negative value means it lost ground. A school increasing by 2 points while Ontario increases by 8 loses 6 points of ground. Longer-period changes use the first available paired numeric result before the selected endpoint and label that starting year explicitly; they require a reported endpoint and never imply that intervening gaps were observed.

Repeated strengths or gaps require three consecutive recent school years with numeric school and Ontario results in all three, all strictly above or all strictly below the matching benchmark. A repeated decline or increase means two consecutive annual changes across three fully reported years. A missing middle year cannot produce a repeated-pattern finding. Questions prioritize repeated declines, persistent gaps, sustained strengths, then a one-year relative change of at least 5 percentage points (labelled as a one-year change). That last threshold is a display rule, not a statistical significance test. Selected peers are described as holding steady or improving only if all three recent values are available and unchanged or strictly increasing. Patterns frame questions and do not identify causes.

Questions use fixed templates, selected by these rules in the browser. The first qualifying rule per subject wins, with at most three subject findings displayed. Schools with the same pattern receive similar question wording with their corresponding grade, subject, figures and years. No language-model service generates questions at runtime. A general learning-priorities question is used when none of the rules qualify. The panel’s “How these questions are chosen” disclosure explains these rules.

School identities in `schools-index.json` are the union of current-series EQAO records, with the latest published name, board and language and the grades represented in the collection. School coordinates come from the latest available ingested Ministry school-information workbook for that identifier, generally 2024–25. When an older 2017–18 or 2018–19 location is used, the table identifies its year. Coordinates are contextual metadata and can lag an assessment year.

Nearby comparisons use the haversine straight-line distance between school coordinates, with a selectable 1–50 km radius and explicit language-system and board-type membership. Only schools reporting an organisation record for the selected grade/year enter the nearby table, including suppressed records. Schools without coordinates are excluded from distance results and counted; when the selected school lacks coordinates, the interface shows same-city schools if its city is known, or offers manual selection. These are neither attendance boundaries nor travel distances. Comparisons can be selected beyond the distance or board-type filter and remain visible as saved chips. Exports include the focal school, selected peers, and all nearby rows matching the current search, with roles, subject-specific counts and source filenames. No comparison-group average is calculated.

Achievement-level labels preserve the five published percentages (below Level 1, Levels 1–4). Stacked bars are shown only when every value is an exact numeric published percentage for a reportable record. Segment widths are normalized because rounded percentages may not total 100%; the exact source labels remain visible. Bounded percentages, suppressed results, participation and registered counts are not imputed. Grade 3 and Grade 6 use their own corresponding Ontario benchmarks.

The chosen school, peer identifiers, radius, board type and grade/year are stored in local browser storage; the URL can override these choices. No account or server-side profile is created. Interest/confidence questionnaires and broader school-life evidence are future work, clearly identified as unavailable in the current collection. Board subgroups are not presented as school-specific student context.
