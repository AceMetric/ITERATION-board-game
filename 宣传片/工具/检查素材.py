"""Audit actual file dimensions, original hashes, alpha channels and WAV signal."""
from pathlib import Path
from PIL import Image
import json,hashlib,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'宣传片'

def main():
 pack=json.loads((OUT/'素材/素材清单.json').read_text())
 old=json.loads((OUT/'策划/素材索引.json').read_text())
 raw=json.loads((OUT/'策划/独立透明配图.json').read_text())
 design=json.loads((OUT/'策划/透明配图索引.json').read_text())
 changed=[]
 for r in old+design:
  p=ROOT/r.get('source',r.get('path'))
  if not p.exists() or hashlib.sha256(p.read_bytes()).hexdigest()!=r['sha256']:changed.append(str(p.relative_to(ROOT)))
 missing=[];alpha=[];scenes=[];audio=[]
 for r in pack['assets']:
  p=ROOT/r['path']
  if not p.exists():missing.append(r['id']);continue
  if r['kind']=='scene':
   with Image.open(p) as im:scenes.append({'id':r['id'],'size':list(im.size),'native1080p':im.width>=1920 and im.height>=1080})
  if r['kind'] in ['text','effect','layer','cutout']:
   with Image.open(p) as im:
    a=im.getchannel('A') if 'A' in im.getbands() else None
    ext=a.getextrema() if a else [255,255]
    expect=r['id']!='L-09-BG'
    alpha.append({'id':r['id'],'size':list(im.size),'mode':im.mode,'alphaExtrema':ext,'bbox':a.getbbox() if a else [0,0,*im.size],'passed':ext[0]==0 and ext[1]>0 if expect else ext[0]==255})
  if r['kind']=='audio':
   with wave.open(str(p),'rb') as f:
    sw=f.getsampwidth();ch=f.getnchannels();sr=f.getframerate();n=f.getnframes();b=np.frombuffer(f.readframes(n),dtype=np.uint8).reshape(-1,sw)
    if sw!=3:raise ValueError('Expected PCM24')
    v=b[:,0].astype(np.int32)|(b[:,1].astype(np.int32)<<8)|(b[:,2].astype(np.int32)<<16);v=np.where(v&0x800000,v-0x1000000,v)/8388608
    audio.append({'id':r['id'],'sampleRate':sr,'channels':ch,'bitDepth':sw*8,'duration':round(n/sr,3),'peak':round(float(np.max(np.abs(v))),6),'passed':bool(sr==48000 and ch==2 and sw==3 and np.max(np.abs(v))<.99 and np.sqrt(np.mean(v*v))>1e-5)})
 all_alpha=all(r['passed'] for r in alpha)
 result={'originalsChecked':len(old),'transparentOriginalsChecked':len(raw),'changedOriginals':changed,'missing':missing,'scenes':scenes,'alpha':alpha,'audio':audio,'filesPassed':not missing and not changed and all_alpha and len(audio)==10 and all(r['passed'] for r in audio),'nativeSceneResolutionPassed':len(scenes)==9 and all(r['native1080p'] for r in scenes)}
 result['designOriginalsChecked']=len(design)
 layer_sizes=[r['size'] for r in alpha if r['id'].startswith('L-')]
 result['layerCanvasMatched']=len(layer_sizes)==3 and len({tuple(s) for s in layer_sizes})==1
 result['filesPassed']=result['filesPassed'] and result['layerCanvasMatched']
 (OUT/'记录/文件检查.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in result.items() if k not in ['scenes','alpha','audio']},ensure_ascii=False))
 if not result['filesPassed']:raise SystemExit(1)

if __name__=='__main__':main()
