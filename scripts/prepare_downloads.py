from pathlib import Path
from html.parser import HTMLParser
import json

ROOT = Path(__file__).resolve().parents[1]
class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.urls=[]
    def handle_starttag(self, tag, attrs):
        url=dict(attrs).get('href','')
        if tag=='a' and ('G36_' in url or (('Grade-3-' in url or 'Grade-6-' in url) and 'Achievement-Results.zip' in url)):
            self.urls.append(url)
p=Links();p.feed((ROOT/'data/raw/eqao-open-data.html').read_text())
entries=[{'url':u,'publisher':'EQAO','category':'definitions' if u.endswith('.xlsx') else 'achievement'} for u in dict.fromkeys(p.urls)]
for r in json.loads((ROOT/'data/raw/ontario-catalogue.json').read_text())['result']['resources']:
    entries.append({'url':r['url'],'publisher':'Ontario Ministry of Education','category':'school-information','catalogue_metadata':r})
for e in entries:
    e['path']='data/raw/'+e['url'].split('/')[-1]
(ROOT/'data/download-plan.json').write_text(json.dumps(entries,indent=2))
lines=['parallel','parallel-max = 5','location','fail','silent','show-error','retry = 2','max-time = 120']
for i,e in enumerate(entries):
    if i: lines.append('next')
    lines += ['location','fail','silent','show-error','retry = 2','max-time = 120',f'url = "{e["url"]}"',f'output = "{ROOT/e["path"]}"']
(ROOT/'scripts/downloads.curl').write_text('\n'.join(lines)+'\n')
print(f'Prepared {len(entries)} source downloads')
