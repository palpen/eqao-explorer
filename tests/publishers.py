"""Read-only verification of the snapshot against fresh official downloads.

Never updates raw files. Run separately from offline tests; publishers can
revise resources or temporarily block downloads.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
import hashlib, json, subprocess

root = Path(__file__).resolve().parents[1]
sources = json.loads((root / 'site/data/sources.json').read_text())

def verify(source):
    url = source['url']
    assert urlparse(url).scheme == 'https'
    assert urlparse(url).hostname in ('www.eqao.com', 'data.ontario.ca')
    result = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location',
                             '--max-time', '60', '--retry', '1', url], capture_output=True)
    record = {'file': Path(source['path']).name, 'url': url, 'expectedSHA256': source['sha256']}
    if result.returncode:
        record.update(passed=False, available=False, error=result.stderr.decode(errors='replace').strip()[:400])
    else:
        digest = hashlib.sha256(result.stdout).hexdigest()
        record.update(available=True, passed=digest == source['sha256'], bytes=len(result.stdout), sha256=digest)
    print(f'{"PASS" if record["passed"] else "UNAVAILABLE" if not record["available"] else "CHANGED"}: {record["file"]}', flush=True)
    return record

with ThreadPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(verify, sources))
report = {'passed': all(r['passed'] for r in results), 'checkedAtUTC': datetime.now(timezone.utc).isoformat(),
          'matchedFiles': sum(r['passed'] for r in results), 'totalFiles': len(results), 'files': results,
          'scope': 'Fresh HTTPS downloads from the original official URLs; byte hashes compared with the preserved local snapshot. No originals modified.'}
for path in ('data/processed/publisher-audit.json', 'site/data/publisher-audit.json'):
    (root / path).write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'files'}, indent=2))
raise SystemExit(0 if report['passed'] else 1)
