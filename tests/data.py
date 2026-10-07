"""Independent checks of app records against original CSVs and historical XLSX."""
from pathlib import Path
import json,csv,io,zipfile,hashlib,re
import openpyxl
root=Path(__file__).resolve().parents[1]
core=json.loads((root/'site/data/core.json').read_text())
for source in core['sources']:
    raw=root/source['path'];pub=root/'site/downloads'/raw.name
    assert hashlib.sha256(raw.read_bytes()).hexdigest()==source['sha256']
    assert raw.read_bytes()==pub.read_bytes()
checks=0
for f in sorted((root/'data/raw').glob('Grade-*-Achievement-Results.zip')):
    grade,_,year=map(int,re.search(r'Grade-(\d)-(\d{4})-(\d{4})',f.name).groups())
    z=zipfile.ZipFile(f)
    parts={}
    for part in [1,2]:
        n=next(n for n in z.namelist() if n.endswith(f'_{part}.csv'))
        parts[part]={(r['OrgType'],r['OrgID'],r.get('Language',r.get('Lang'))):r for r in csv.DictReader(io.TextIOWrapper(z.open(n),encoding='utf-8-sig'))}
    for r in core['results']:
        if r['year']!=year or r['grade']!=grade:continue
        key=('B',r['id'],r['language']);raw=parts[1][key];group=parts[2][key]
        assert r['name']==raw['BoardName']
        assert r['raw']==[raw[f'pctOverall{s}_L34'] for s in 'RWM']
        for g in ['G1','G2','E1','S1']:
            assert r['groups'][g]==[group.get(f'pctOverall{s}_{g}_L34','N/D') if raw['Suppressed']=='0' else 'N/R' for s in 'RWM']
        if raw['Suppressed']!='0':assert r['values']==[None,None,None]
        checks+=1
assert checks==769
for year in [2018,2019]:
    w=openpyxl.load_workbook(root/f'data/raw/sif_data_table_{year-1}_{year}_en.xlsx',read_only=True,data_only=True)
    it=w.worksheets[0].values;heads=next(it);source={str(r[3]).zfill(6):dict(zip(heads,r)) for r in it}
    for grade in [3,6]:
        for r in json.loads((root/f'site/data/schools-{year}-{grade}.json').read_text()):
            original=source[r['id']]
            assert r['raw']==[str(original[f'Percentage of Grade {grade} Students Achieving the Provincial Standard in {s}']) if original[f'Percentage of Grade {grade} Students Achieving the Provincial Standard in {s}'] is not None else 'NA' for s in ['Reading','Writing','Mathematics']]
    w.close()
assert not any((root/f'site/data/schools-{y}-3.json').exists() for y in [2020,2021])
print(f'PASS: {checks} board records and subgroup joins match original CSVs; historical school percentages match XLSX; 31 download hashes match; carry-forward years absent.')
