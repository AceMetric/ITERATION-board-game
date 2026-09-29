"""Build a standalone tabletop client from the shared rules and designed cards."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'game/game_data.json').read_text())
assets = json.loads((ROOT / 'src/card-assets.json').read_text())
metadata = json.loads((ROOT / 'src/card-assets.metadata.json').read_text())
assert set(assets) == set(metadata['assets'])
assert set(metadata['missingFullCardFaces']) <= {'T2-06'}
for key, entry in metadata['assets'].items():
    original = ROOT.parent / entry['source']
    output = ROOT / entry['path']
    assert original.is_file() and output.is_file(), key
    assert hashlib.sha256(original.read_bytes()).hexdigest() == entry['sourceSha256'], key
    assert assets[key] == entry['path'], key
# Version URLs by the generated image bytes so existing players do not keep an
# older, incorrectly converted card from the browser cache after deployment.
asset_urls = {
    key: path + '?v=' + hashlib.sha256((ROOT / path).read_bytes()).hexdigest()[:12]
    for key, path in assets.items()
}
for wonder in data['wonders']:
    wonder.pop('image', None)
assert len(data['tech']) == 60 and len(data['events']) == 14 and len(data['wonders']) == 15
def safe_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
html = (ROOT / 'src/tabletop-v4.html').read_text()
html = html.replace('<!-- GAME_DATA -->', '<script id="card-data" type="application/json">'+safe_json(data)+'</script>')
html = html.replace('<!-- CARD_ASSETS -->', '<script id="tabletop-assets" type="application/json">'+safe_json(asset_urls)+'</script>')
html = html.replace('<!-- RULE_ENGINE -->', ''.join('<script>'+ (ROOT / 'game' / name).read_text().replace('</script', '<\\/script') + '</script>' for name in ('game_config.js','game_engine.js','game_flow.js')))
target = ROOT / 'standalone.html'
target.write_text(html)
print(f'Built {target.name} ({target.stat().st_size} bytes)')
