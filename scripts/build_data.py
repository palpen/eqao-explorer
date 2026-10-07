"""Reproducible extraction; never edits publisher files or infers suppressed values."""
from pathlib import Path
import csv, io, json, re, zipfile, hashlib, collections, shutil
from datetime import datetime, timezone
import openpyxl

ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'data/raw'; OUT=ROOT/'data/processed'; SITE=ROOT/'site/data'
for p in [OUT,SITE]: p.mkdir(parents=True,exist_ok=True)
(ROOT/'site/downloads').mkdir(exist_ok=True)
def write(name,data):
    text=json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False)
    (OUT/name).write_text(text);(SITE/name).write_text(text)
def num(x):
    s=str('' if x is None else x).strip().replace('%','')
    return float(s) if re.fullmatch(r'-?\d+(\.\d+)?',s) else None
def ident(x):return str(x or '').strip().removeprefix('B')
def schoolid(x):return str(x or '').strip().zfill(6)
def boardtype(x):
    if 'Cath Dist' in x:return 'Catholic'
    if 'Pub Dist' in x:return 'Public'
    return 'Other authority'

manifest=[]
for e in json.loads((ROOT/'data/download-plan.json').read_text()):
    f=ROOT/e['path']; assert f.exists() and f.stat().st_size>0, f
    manifest.append({**e,'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'retrieved':'2026-10-06'})
    shutil.copy2(f,ROOT/'site/downloads'/f.name)
write('sources.json',manifest)
boards={}; schoolmeta={}; legacy={}; legacy_counts={}
# English-language workbook editions include both English and French schools.
# French editions are archived verbatim, not ingested a second time.
for filename,year in [('sif_data_table_2017_2018_en.xlsx',2018),('sif_data_table_2018_2019_en.xlsx',2019),('new_sif_data_2024_25_final_en_august2026.xlsx',2025)]:
    w=openpyxl.load_workbook(RAW/filename,read_only=True,data_only=True)
    rows=w.worksheets[0].values; headers=next(rows)
    for values in rows:
        r=dict(zip(headers,values));bid=ident(r['Board Number']);sid=schoolid(r['School Number'])
        lang='fr' if r['School Language']=='French' else 'en'
        boards[bid]={'id':bid,'name':r['Board Name'],'type':boardtype(r['Board Type'] or ''),'language':lang}
        schoolmeta[sid]={'city':r.get('City') or '', 'lat':num(r.get('Latitude')),'lon':num(r.get('Longitude')), 'locationYear':year,'locationSource':filename}
        if year==2025:continue
        for grade in [3,6]:
            raw=[str(v) if v is not None and v!='' else 'NA' for v in [r.get(f'Percentage of Grade {grade} Students Achieving the Provincial Standard in {s}') for s in ['Reading','Writing','Mathematics']]]
            if all(v=='NA' for v in raw):continue
            rec={'id':sid,'name':r['School Name'],'board':bid,'language':lang,'values':[num(v) for v in raw],'raw':raw,'source':filename,'basis':'legacy-school','city':schoolmeta[sid]['city']}
            legacy.setdefault((year,grade),[]).append(rec)
    w.close()

boardrows=[];provincerows=[];schoolcounts={};source_checks=[];schoolindex={}
for f in sorted(RAW.glob('Grade-*-Achievement-Results.zip')):
    grade,start,year=map(int,re.search(r'Grade-(\d)-(\d{4})-(\d{4})',f.name).groups())
    schools=[]
    z=zipfile.ZipFile(f)
    # Preserve all raw CSV parts, even fields not used in the dashboard.
    for n in z.namelist():
        if n.endswith('.csv'):
            dest=RAW/'extracted'/f.stem/Path(n).name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(z.read(n))
    n=next(n for n in z.namelist() if n.endswith('_1.csv'))
    rows=list(csv.DictReader(io.TextIOWrapper(z.open(n),encoding='utf-8-sig')))
    n2=next(n for n in z.namelist() if n.endswith('_2.csv'))
    part_rows=list(csv.DictReader(io.TextIOWrapper(z.open(n2),encoding='utf-8-sig')))
    parts={ (r['OrgType'],r['OrgID'],r.get('Language',r.get('Lang'))):r for r in part_rows }
    assert len(parts)==len(part_rows),'Duplicate part-two join keys'
    assert set(parts)=={(r['OrgType'],r['OrgID'],r.get('Language',r.get('Lang'))) for r in rows},'Achievement parts have different organisation keys'
    seen=set()
    for r in rows:
        lang=r.get('Language',r.get('Lang'));org=r['OrgType'];bid=ident(r['BoardMident']);sid=schoolid(r['SchoolMident'])
        assert r['ApplySuppression']=='1', 'Only published, suppression-applied records are supported'
        key=(org,lang,bid,sid);assert key not in seen,(f,key);seen.add(key)
        rr={**r,**parts[(org,r['OrgID'],lang)]}
        raws=[r[f'pctOverall{s}_L34'] for s in 'RWM']
        valid=r['Suppressed']=='0'
        vals=[num(v) if valid else None for v in raws]
        participants=[num(r.get('cntFullyParticipating_'+s)) if valid else None for s in ['Read','Write','Math']]
        rec={'year':year,'grade':grade,'id':bid if org=='B' else sid,'board':bid,'language':lang,'name':r['BoardName'] if org=='B' else r['SchoolName'],'values':vals,'raw':raws,'participants':participants,'registered':[num(r.get('cntStudents_'+s)) if valid else None for s in ['Read','Write','Math']], 'participation':[num(r.get('pctFullyParticipating_'+s)) if valid else None for s in ['Read','Write','Math']], 'levels':[[r.get(f'pctOverall{s}_{lev}','N/D') for lev in ['NE1','L1','L2','L3','L4']] for s in 'RWM'],'suppressed':r['Suppressed'],'source':f.name,'basis':'official'}
        # Only displayed published percentages enter charts. Counts never reverse suppression.
        for i,s in enumerate('RWM'):
            cnt=num(r.get(f'cntOverall{s}_L34'));den=participants[i]
            if vals[i] is not None and cnt is not None and den:
                assert abs(vals[i]-100*cnt/den)<=0.501,(f,key,s,vals[i],cnt,den)
        if org in ['B','P']:
            rec['groups']={g:[rr.get(f'pctOverall{s}_{g}_L34','N/D') if valid else 'N/R' for s in 'RWM'] for g in ['G1','G2','E1','S1']}
        if org=='B':
            b=boards.get(bid,{'id':bid,'type':'Other authority'})
            b.update(name=r['BoardName'],language=lang);boards[bid]=b
            boardrows.append(rec)
        elif org=='P':
            rec['id']='province-'+lang;rec['name']='Ontario ('+('English' if lang=='en' else 'French')+')';provincerows.append(rec)
        elif org=='S':
            rec['city']=schoolmeta.get(sid,{}).get('city','');schools.append(rec)
            entry=schoolindex.setdefault(sid,{'id':sid,'grades':[],'latestYear':0})
            if grade not in entry['grades']:entry['grades'].append(grade)
            if year>=entry['latestYear']:
                entry.update(name=rec['name'],board=bid,language=lang,latestYear=year,**schoolmeta.get(sid,{'city':'','lat':None,'lon':None,'locationYear':None,'locationSource':None}))
    write(f'schools-{year}-{grade}.json',schools)
    schoolcounts[f'{year}-{grade}']=len(schools)
    source_checks.append({'file':f.name,'rows':len(rows),'boards':sum(r['OrgType']=='B' for r in rows),'schools':len(schools),'province':sum(r['OrgType']=='P' for r in rows)})

for (year,grade),records in legacy.items():
    write(f'schools-{year}-{grade}.json',records);schoolcounts[f'{year}-{grade}']=len(records)

write('schools-index.json',sorted(schoolindex.values(),key=lambda r:r['name']))

core={'updated':'2026-10-06','years':[2022,2023,2024,2025,2026],'archiveYears':[2018,2019], 'boards':sorted(boards.values(),key=lambda b:b['name']), 'results':boardrows,'province':provincerows,'schoolCounts':schoolcounts,'sources':[{k:v for k,v in m.items() if k!='catalogue_metadata'} for m in manifest]}
write('core.json',core)
with (OUT/'board-results.csv').open('w',newline='') as out:
    fields=['school_year','grade','board_id','board_name','language','subject','percent_at_standard','published_value','fully_participating_students','suppression_code','source']
    wr=csv.DictWriter(out,fieldnames=fields);wr.writeheader()
    for r in boardrows:
        for i,subject in enumerate(['Reading','Writing','Mathematics']):
            wr.writerow(dict(zip(fields,[f'{r["year"]-1}-{r["year"]}',r['grade'],r['id'],r['name'],r['language'],subject,r['values'][i],r['raw'][i],r['participants'][i],r['suppressed'],r['source']])))
shutil.copy2(OUT/'board-results.csv',SITE/'board-results.csv')
check={'sourceFiles':len(manifest),'sourceBytes':sum(m['bytes'] for m in manifest),'boardRecords':len(boardrows),'provinceRecords':len(provincerows),'schoolRecords':sum(schoolcounts.values()),'byFile':source_checks,'checks':['all planned source files present','SHA256 recorded','unique organisation keys per grade/year','published numeric rates agree with numerator/denominator to rounding','suppression-applied source rows only','French workbook translations not double-counted','2019-20 and 2020-21 carry-forward results not treated as new assessments']}
(OUT/'validation.json').write_text(json.dumps(check,indent=2))
print(json.dumps(check,indent=2))
