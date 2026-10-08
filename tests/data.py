"""Reconcile every app record with original publisher files, independently of the builder."""
from pathlib import Path
from collections import Counter, defaultdict
from fractions import Fraction
import csv, hashlib, io, json, re, zipfile
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
RAW, SITE = ROOT / 'data/raw', ROOT / 'site/data'
core = json.loads((SITE / 'core.json').read_text())
index = json.loads((SITE / 'schools-index.json').read_text())
counts, files = Counter(), []
coverage = defaultdict(lambda: {'currentRecords': 0, 'historicalRecords': 0, 'sources': set()})

def check(actual, expected, context):
    if actual != expected:
        if isinstance(actual, set) and isinstance(expected, set):
            raise AssertionError(f'{context}: extra={list(actual - expected)[:5]!r}, missing={list(expected - actual)[:5]!r}')
        raise AssertionError(f'{context}: {str(actual)[:250]!r} != {str(expected)[:250]!r}')
    counts['fieldComparisons'] += 1

def number(value):
    text = str(value if value is not None else '').strip()
    if text.endswith('%'):
        text = text[:-1]
    return float(text) if re.fullmatch(r'-?\d+(?:\.\d+)?', text) else None

def sid(value):
    return str(value).strip().zfill(6)

def bid(value):
    return str(value).strip().lstrip('B')

def rawkey(row):
    return row['OrgType'], row['OrgID'], row.get('Language', row.get('Lang'))

plan = json.loads((ROOT / 'data/download-plan.json').read_text())
manifest = json.loads((SITE / 'sources.json').read_text())
check([s['path'] for s in manifest], [s['path'] for s in plan], 'source membership')
check(core['sources'], [{k: v for k, v in s.items() if k != 'catalogue_metadata'} for s in manifest], 'core manifest')
for expected, source in zip(plan, manifest):
    for key, value in expected.items():
        check(source[key], value, f'manifest {source["path"]} {key}')
    raw = ROOT / source['path']
    check(raw.stat().st_size, source['bytes'], f'{raw.name} bytes')
    check(hashlib.sha256(raw.read_bytes()).hexdigest(), source['sha256'], f'{raw.name} hash')
    check((ROOT / 'site/downloads' / raw.name).read_bytes(), raw.read_bytes(), f'{raw.name} download copy')
    counts['sourceFiles'] += 1
counts['sourceBytes'] = sum(s['bytes'] for s in manifest)
for path in (ROOT / 'data/processed').iterdir():
    if path.name not in ('validation.json', 'audit.json', 'calculation-audit.json'):
        check((SITE / path.name).read_bytes(), path.read_bytes(), f'{path.name} deploy copy')

# School IDs, metadata and historical results read from named workbook columns.
metadata, ministry_boards, workbooks = {}, {}, {}
for filename, year in [('sif_data_table_2017_2018_en.xlsx', 2018),
                       ('sif_data_table_2018_2019_en.xlsx', 2019),
                       ('new_sif_data_2024_25_final_en_august2026.xlsx', 2025)]:
    workbook = openpyxl.load_workbook(RAW / filename, read_only=True, data_only=True)
    rows = workbook.worksheets[0].values
    headers = next(rows)
    originals = {}
    for values in rows:
        row = dict(zip(headers, values))
        school, board = sid(row['School Number']), bid(row['Board Number'])
        assert school not in originals, (filename, school, 'duplicate school')
        originals[school] = row
        metadata[school] = dict(city=row['City'] or '', lat=number(row['Latitude']),
                                lon=number(row['Longitude']), locationYear=year,
                                locationSource=filename)
        ministry_boards[board] = row
    workbooks[year] = originals
    workbook.close()

current, board_originals = defaultdict(list), defaultdict(list)
expected_board_keys, expected_province_keys = set(), set()
for archive in sorted(RAW.glob('Grade-*-Achievement-Results.zip')):
    grade, _, year = map(int, re.search(r'Grade-(\d)-(\d{4})-(\d{4})', archive.name).groups())
    with zipfile.ZipFile(archive) as z:
        parts, row_numbers = {}, {}
        for part in (1, 2):
            names = [n for n in z.namelist() if n.endswith(f'_{part}.csv')]
            assert len(names) == 1, archive.name
            name = names[0]
            check((RAW / 'extracted' / archive.stem / Path(name).name).read_bytes(), z.read(name), f'{archive.name} part {part} extraction')
            rows = list(csv.DictReader(io.TextIOWrapper(z.open(name), encoding='utf-8-sig')))
            parts[part] = {rawkey(r): r for r in rows}
            row_numbers[part] = {rawkey(r): n for n, r in enumerate(rows, 2)}
            check(len(parts[part]), len(rows), f'{archive.name} part {part} unique keys')
        check(set(parts[1]), set(parts[2]), f'{archive.name} CSV join membership')
        record_counts = Counter()
        for org, records in [('S', json.loads((SITE / f'schools-{year}-{grade}.json').read_text())),
                             ('B', [r for r in core['results'] if (r['year'], r['grade']) == (year, grade)]),
                             ('P', [r for r in core['province'] if (r['year'], r['grade']) == (year, grade)])]:
            # Normalize display IDs while joining CSV parts by original OrgID.
            actual = {(org, r['language'] if org == 'P' else r['id'], r['language']): r for r in records}
            expected = {(org, r.get('Language', r.get('Lang')) if org == 'P' else bid(r['BoardMident']) if org == 'B' else sid(r['SchoolMident']), r.get('Language', r.get('Lang'))): r for r in parts[1].values() if r['OrgType'] == org}
            check(len(actual), len(records), f'{archive.name} {org} app uniqueness')
            check(set(actual), set(expected), f'{archive.name} {org} complete row coverage')
            for key, record in actual.items():
                raw = expected[key]
                groups = parts[2][rawkey(raw)]
                context = f'{archive.name}:{row_numbers[1][rawkey(raw)]} {org} {record["id"]}'
                valid = raw['Suppressed'] == '0'
                check(raw['Grade'], str(grade), context + ' source grade')
                for field in ['Grade', 'ApplySuppression', 'Suppressed', 'BoardMident', 'SchoolMident']:
                    check(groups[field], raw[field], context + ' CSV parts agree on ' + field)
                fields = dict(year=year, grade=grade, board=bid(raw['BoardMident']),
                              language=raw.get('Language', raw.get('Lang')), source=archive.name,
                              basis='official', suppressed=raw['Suppressed'])
                fields['name'] = raw['BoardName'] if org == 'B' else raw['SchoolName']
                fields['id'] = bid(raw['BoardMident']) if org == 'B' else sid(raw['SchoolMident'])
                if org == 'P':
                    fields['name'] = 'Ontario (' + ('English' if record['language'] == 'en' else 'French') + ')'
                    fields['id'] = 'province-' + record['language']
                    expected_province_keys.add((year, grade, record['id']))
                check(raw['ApplySuppression'], '1', context + ' suppression applied')
                for field, value in fields.items():
                    check(record[field], value, context + ' ' + field)
                for i, (subject, count_subject) in enumerate(zip('RWM', ['Read', 'Write', 'Math'])):
                    field = f'pctOverall{subject}_L34'
                    check(record['raw'][i], raw[field], context + ' ' + field + ' marker')
                    check(record['values'][i], number(raw[field]) if valid else None, context + ' ' + field)
                    for app_field, raw_field in [('participants', f'cntFullyParticipating_{count_subject}'),
                                                  ('registered', f'cntStudents_{count_subject}'),
                                                  ('participation', f'pctFullyParticipating_{count_subject}')]:
                        check(record[app_field][i], number(raw[raw_field]) if valid else None, context + ' ' + raw_field)
                    check(record['levels'][i], [raw.get(f'pctOverall{subject}_{level}', 'N/D') for level in ['NE1', 'L1', 'L2', 'L3', 'L4']], context + ' levels')
                    # Exact rational arithmetic, not a recomputed replacement
                    # for published percentages or suppressed/bounded values.
                    rate_fields = [(field, f'cntOverall{subject}_L34', f'cntFullyParticipating_{count_subject}')]
                    rate_fields += [(f'pctOverall{subject}_{level}', f'cntOverall{subject}_{level}', f'cntFullyParticipating_{count_subject}') for level in ['NE1', 'L1', 'L2', 'L3', 'L4']]
                    rate_fields += [(f'pctFullyParticipating_{count_subject}', f'cntFullyParticipating_{count_subject}', f'cntStudents_{count_subject}')]
                    for rate_field, numerator_field, denominator_field in rate_fields:
                        rate, numerator, denominator = [number(raw.get(f)) for f in [rate_field, numerator_field, denominator_field]]
                        if valid and rate is not None and numerator is not None and denominator:
                            assert rate == round(Fraction(int(numerator) * 100, int(denominator))), (context, rate_field, rate, numerator, denominator)
                            counts['roundedRatioChecks'] += 1
                    for value in [record['values'][i], record['participation'][i]]:
                        assert value is None or 0 <= value <= 100, context
                    for value in [record['participants'][i], record['registered'][i]]:
                        assert value is None or value >= 0 and value.is_integer(), context
                if org in ('B', 'P'):
                    for group in ['G1', 'G2', 'E1', 'S1']:
                        check(record['groups'][group], [groups.get(f'pctOverall{s}_{group}_L34', 'N/D') if valid else 'N/R' for s in 'RWM'], context + ' group ' + group)
                if org == 'S':
                    check(record['city'], metadata.get(record['id'], {}).get('city', ''), context + ' city')
                    current[record['id']].append(record)
                    coverage[record['id']]['currentRecords'] += 1
                    coverage[record['id']]['sources'].add(archive.name)
                if org == 'B':
                    expected_board_keys.add((year, grade, record['id'], record['language']))
                    board_originals[record['id']].append(raw)
                record_counts[org] += 1
                counts[{'S': 'currentSchoolRecords', 'B': 'boardRecords', 'P': 'provinceRecords'}[org]] += 1
        check(core['schoolCounts'][f'{year}-{grade}'], record_counts['S'], archive.name + ' school count')
        files.append({'source': archive.name, 'grade': grade, 'year': year, 'schoolRecords': record_counts['S'], 'boardRecords': record_counts['B'], 'provinceRecords': record_counts['P'], 'passed': True})
check(len(expected_board_keys), len(core['results']), 'all board years covered')
check(len(expected_province_keys), len(core['province']), 'all province years covered')
check(set(core['years']), {entry['year'] for entry in files}, 'available current years')

for year in core['archiveYears']:
    filename = f'sif_data_table_{year-1}_{year}_en.xlsx'
    for grade in (3, 6):
        records = json.loads((SITE / f'schools-{year}-{grade}.json').read_text())
        fields = [f'Percentage of Grade {grade} Students Achieving the Provincial Standard in {s}' for s in ['Reading', 'Writing', 'Mathematics']]
        originals = {school: r for school, r in workbooks[year].items() if any(r.get(field) not in (None, '', 'NA') for field in fields)}
        check({r['id'] for r in records}, set(originals), f'{filename} Grade {grade} complete historical coverage')
        check(len(records), len(originals), f'{filename} Grade {grade} unique rows')
        for record in records:
            raw = originals[record['id']]
            context = f'{filename} Grade {grade} {record["id"]}'
            expected = dict(name=raw['School Name'], board=bid(raw['Board Number']),
                            language='fr' if raw['School Language'] == 'French' else 'en',
                            source=filename, basis='legacy-school', city=raw['City'] or '',
                            raw=[str(raw[f]) if raw.get(f) not in (None, '') else 'NA' for f in fields],
                            values=[number(raw.get(f)) for f in fields])
            for field, value in expected.items():
                check(record[field], value, context + ' ' + field)
            coverage[record['id']]['historicalRecords'] += 1
            coverage[record['id']]['sources'].add(filename)
            counts['historicalSchoolRecords'] += 1
        check(core['schoolCounts'][f'{year}-{grade}'], len(records), f'{filename} Grade {grade} count')
        files.append({'source': filename, 'grade': grade, 'year': year, 'schoolRecords': len(records), 'passed': True})

check({s['id'] for s in index}, set(current), 'school index membership')
check(len(index), len(current), 'school index uniqueness')
for school in index:
    records = current[school['id']]
    check(school['latestYear'], max(r['year'] for r in records), school['id'] + ' latest year')
    check(set(school['grades']), {r['grade'] for r in records}, school['id'] + ' grades')
    assert any((school['name'], school['board'], school['language']) == (r['name'], r['board'], r['language']) for r in records if r['year'] == school['latestYear'])
    expected = metadata.get(school['id'], dict(city='', lat=None, lon=None, locationSource=None, locationYear=None))
    for field, value in expected.items():
        check(school[field], value, school['id'] + ' ' + field)
    assert school['lat'] is None or -90 <= school['lat'] <= 90
    assert school['lon'] is None or -180 <= school['lon'] <= 180
    counts['schoolIndexEntries'] += 1

for board in core['boards']:
    raw = ministry_boards.get(board['id'])
    label = (raw['Board Type'] or '') if raw else ''
    expected_type = 'Catholic' if 'Cath Dist' in label else 'Public' if 'Pub Dist' in label else 'Other authority'
    check(board['type'], expected_type, board['id'] + ' board type')
    candidates = [(r['BoardName'], r.get('Language', r.get('Lang'))) for r in board_originals[board['id']]]
    if raw:
        candidates.append((raw['Board Name'], 'fr' if raw['School Language'] == 'French' else 'en'))
    assert (board['name'], board['language']) in candidates, board

with (SITE / 'board-results.csv').open(newline='') as stream:
    reader = csv.DictReader(stream)
    export_fields = ['school_year', 'grade', 'board_id', 'board_name', 'language', 'subject', 'percent_at_standard', 'published_value', 'fully_participating_students', 'suppression_code', 'source']
    check(reader.fieldnames, export_fields, 'board CSV header')
    exported = list(reader)
check(len(exported), len(core['results']) * 3, 'board CSV row count')
for line, (record, i) in zip(exported, [(r, i) for r in core['results'] for i in range(3)]):
    expected = dict(zip(export_fields, [f'{record["year"]-1}-{record["year"]}', record['grade'], record['id'], record['name'], record['language'], ['Reading', 'Writing', 'Mathematics'][i], record['values'][i], record['raw'][i], record['participants'][i], record['suppressed'], record['source']]))
    check(line, {k: '' if v is None else str(v) for k, v in expected.items()}, 'board CSV ' + record['id'])
assert not any((SITE / f'schools-{y}-{g}.json').exists() for y in (2020, 2021) for g in (3, 6))
report = {'passed': True, 'snapshot': core['updated'], 'scope': 'Every included school, board, province, grade and year; original publisher files, not a sample.',
          'counts': dict(counts), 'byFile': files,
          'verifier': {'file': 'tests/data.py', 'sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
          'datasets': [{'file': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(SITE.iterdir()) if p.suffix in ('.json', '.csv') and not p.name.endswith('audit.json')],
          'schools': [{'id': school, **{k: sorted(v) if isinstance(v, set) else v for k, v in value.items()}} for school, value in sorted(coverage.items())],
          'checks': ['Complete row membership and unique identities', 'Every achievement value and suppression/bounded marker', 'All participation, registration and achievement-level fields', 'Board and province subgroup joins', 'Exact rational percentage/count checks with bankers rounding', 'Historical school percentages and metadata', 'School index and location provenance', 'Board classifications', 'Every board CSV export field', 'Original hashes and deployed/extracted copies'],
          'limitations': ['Reconciles the included snapshot; does not certify publisher collection or automatically refresh online sources.', 'Coordinates are dated metadata; distances are spherical straight-line estimates.', 'Rounded percentages support descriptive differences, not statistical significance or causal effects.']}
for destination in (ROOT / 'data/processed/audit.json', SITE / 'audit.json'):
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'passed': True, 'counts': report['counts'], 'uniqueSchoolsAcrossCurrentAndArchive': len(coverage)}, indent=2))
