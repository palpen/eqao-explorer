"""Build the isolated, portable preview. Does not modify the production site."""
import json
from pathlib import Path

preview = Path(__file__).resolve().parent
repo = preview.parent.parent
boards = {b['id']: b['name'] for b in json.loads((repo / 'site/data/core.json').read_text())['boards']}
results = {
    grade: {s['id']: {'raw': s['raw'], 'participants': s['participants']}
            for s in json.loads((repo / f'site/data/schools-2026-{grade}.json').read_text())}
    for grade in (3, 6)
}
schools = [{
    **{k: s.get(k) for k in ('id', 'name', 'city', 'lat', 'lon', 'language', 'latestYear')},
    'boardName': boards.get(s['board'], s['board']),
    'results': {str(grade): results[grade][s['id']] for grade in (3, 6) if s['id'] in results[grade]}
} for s in json.loads((repo / 'site/data/schools-index.json').read_text())]

html = (preview / 'src/index.html').read_text()
replacements = {
    'INLINE_STYLES': (preview / 'src/styles.css').read_text(),
    'INLINE_DATA': json.dumps(schools, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c'),
    'INLINE_PROVIDERS': (preview / 'src/map-providers.js').read_text(),
    'INLINE_ADAPTER': (preview / 'src/map-adapter.js').read_text(),
    'INLINE_SAVED': (preview / 'src/saved-schools.js').read_text(),
    'INLINE_APP': (preview / 'src/app.js').read_text(),
    'INLINE_PREVIEW': (preview / 'src/preview-controls.js').read_text(),
}
for key, value in replacements.items():
    html = html.replace(f'/* {key} */', value)
output = preview / 'dist/index.html'
output.parent.mkdir(exist_ok=True)
output.write_text(html)
print(f'Built preview with {len(schools):,} real school entries: {output}')
