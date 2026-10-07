from pathlib import Path
import zipfile, hashlib, json

root=Path(__file__).resolve().parents[1]
release=root/'releases';release.mkdir(exist_ok=True)
out=release/'eqao-explorer.zip'
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in sorted((root/'site').rglob('*')):
        if p.is_file() and not p.name.startswith('.'):
            z.write(p,p.relative_to(root/'site'))
report={'archive':out.name,'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}
(release/'package.json').write_text(json.dumps(report,indent=2))
assert out.stat().st_size<100*1024*1024,'Tailnow upload limit exceeded'
print(json.dumps(report,indent=2))
