"""Fetch only the recorded official release weights and verify before activation."""
from pathlib import Path
import hashlib,json,urllib.request,os
R=Path(__file__).resolve().parents[1];target=R/'.cache/upscale-models';target.mkdir(parents=True,exist_ok=True)
for e in json.loads((R/'tools/upscale_vendor/sources.json').read_text())['weights']:
 p=target/(e['name']+'.pth')
 if p.exists() and hashlib.sha256(p.read_bytes()).hexdigest()==e['sha256']:continue
 tmp=p.with_suffix('.download');tmp.write_bytes(urllib.request.urlopen(e['url']).read())
 assert hashlib.sha256(tmp.read_bytes()).hexdigest()==e['sha256'],e['name']+' checksum mismatch'
 os.replace(tmp,p);print('Verified',e['name'])
