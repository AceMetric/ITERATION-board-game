"""Local official Real-ESRGAN inference; immutable originals; explicit 30fps sampling."""
from pathlib import Path
import argparse,hashlib,json,subprocess,sys,time,os
import numpy as np
from PIL import Image,ImageDraw,ImageFont
import torch
from upscale_vendor.srvgg_arch import SRVGGNetCompact
R=Path(__file__).resolve().parents[1]
F=subprocess.check_output([str(R.parent/'工具/.venv/bin/python'),'-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],text=True).strip()
MAN=R/'src/ai.json'; ai=json.loads(MAN.read_text()); OUT=R/'输出/画质增强';OUT.mkdir(parents=True,exist_ok=True)
WEIGHTS=R/'.cache/upscale-models'; SOURCES=json.loads((R/'tools/upscale_vendor/sources.json').read_text())
TARGET=(1920,1080); SUFFIX=''
DEVICE='mps' if torch.backends.mps.is_available() else 'cpu'
torch.set_num_threads(4);torch.manual_seed(0)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(args):subprocess.run([F,'-v','error','-y',*map(str,args)],check=True)
def network(kind):
 name='realesr-general-x4v3' if kind=='general' else 'realesr-animevideov3'
 def state(n):
  p=WEIGHTS/(n+'.pth');expected=next(x['sha256'] for x in SOURCES['weights'] if x['name']==n)
  assert digest(p)==expected,'Weight checksum changed'
  d=torch.load(p,map_location='cpu',weights_only=True);return d.get('params_ema',d.get('params',d))
 s=state(name)
 if kind=='general':
  weak=state('realesr-general-wdn-x4v3');s={k:s[k]*.35+weak[k]*.65 for k in s}
 model=SRVGGNetCompact(num_conv=32 if kind=='general' else 16).eval();model.load_state_dict(s,strict=True)
 return model.to(DEVICE)
def enhance(model,im,size=None):
 a=np.asarray(im).astype(np.float32)/255
 x=torch.from_numpy(a.transpose(2,0,1).copy()).unsqueeze(0).to(DEVICE)
 x=torch.nn.functional.pad(x,(40,40,40,40),mode='reflect')
 with torch.inference_mode():y=model(x)[:,:,160:-160,160:-160].clamp_(0,1)
 a=(y[0].cpu().numpy().transpose(1,2,0)*255).round().astype(np.uint8)
 return Image.fromarray(a).resize(size or TARGET,Image.Resampling.LANCZOS)
def native_frames(id,start,seconds,folder):
 folder.mkdir(parents=True,exist_ok=True);n=round(seconds*30)
 token={'sourceSha256':digest((R.parents[1]/ai[id]['source'])),'start':start,'seconds':seconds,'fps':30};stamp=folder/'source.json'
 if not stamp.exists() or json.loads(stamp.read_text())!=token or len(list(folder.glob('*.png')))!=n:
  for p in folder.glob('*.png'):p.unlink()
  run(['-ss',start,'-i',R.parents[1]/ai[id]['source'],'-vf','fps=30,setsar=1','-frames:v',n,'-start_number','0',folder/'%04d.png'])
 stamp.write_text(json.dumps(token,indent=2))
 paths=sorted(folder.glob('*.png'));assert len(paths)==n,(id,len(paths),n);return paths
def encode(folder,dest,n):
 run(['-framerate',30,'-start_number',0,'-i',folder/'%04d.png','-frames:v',n,'-an','-c:v','libx264','-preset','fast','-crf',16,'-pix_fmt','yuv420p','-movflags','+faststart',dest])
font=ImageFont.truetype(str(R/'public/fonts/SourceHanSansCN-Regular.otf'),24)
def compare():
 models={k:network(k) for k in ['general','anime']};report=[]
 for id,start,sec in [('08',3,3),('01',1,2),('10',1,2)]:
  folder=R/'.cache/upscale-tests'/id;paths=native_frames(id,start,sec,folder/'native')
  for k in ['baseline','gentle','medium','anime','grid']:(folder/k).mkdir(parents=True,exist_ok=True)
  began=time.time()
  for i,p in enumerate(paths):
   im=Image.open(p).convert('RGB');base=im.resize((1920,1080),Image.Resampling.LANCZOS)
   sr={k:enhance(m,im) for k,m in models.items()}
   candidates=[base,Image.blend(base,sr['general'],.35),Image.blend(base,sr['general'],.55),Image.blend(base,sr['anime'],.35)]
   grid=Image.new('RGB',(1920,1080));draw=ImageDraw.Draw(grid)
   for j,(key,label,frame) in enumerate(zip(['baseline','gentle','medium','anime'],['原片放大','通用增强 35%','通用增强 55%','插画增强 35%'],candidates)):
    frame.save(folder/key/f'{i:04d}.png',compress_level=1)
    x=j%2*960;y=j//2*540;grid.paste(frame.resize((960,540),Image.Resampling.LANCZOS),(x,y));draw.rectangle((x,y,x+330,y+42),fill='#081321');draw.text((x+12,y+5),label,font=font,fill='#ead6a1')
   grid.save(folder/'grid'/f'{i:04d}.png',compress_level=1)
   if i%30==0:print('compare',id,i,'seconds',round(time.time()-began,1),flush=True)
  dest=OUT/(id+'-四版画质对比.mp4');encode(folder/'grid',dest,len(paths))
  run(['-i',dest,'-vf','setpts=2*PTS','-an','-r',30,'-c:v','libx264','-crf',16,OUT/(id+'-四版画质对比-半速.mp4')])
  # 1:1 pixel crops, source coordinates chosen for cables/fire/ship.
  box={'08':(650,340,1610,880),'01':(650,400,1610,940),'10':(680,210,1640,750)}[id]
  mid=len(paths)//2;detail=Image.new('RGB',(1920,1080));d=ImageDraw.Draw(detail)
  for j,key in enumerate(['baseline','gentle','medium','anime']):
   x=j%2*960;y=j//2*540;detail.paste(Image.open(folder/key/f'{mid:04d}.png').crop(box),(x,y));d.rectangle((x,y,x+330,y+42),fill='#081321');d.text((x+12,y+5),['原片放大','通用增强 35%','通用增强 55%','插画增强 35%'][j],font=font,fill='#ead6a1')
  detail.save(OUT/(id+'-原尺寸细节对比.png'));report.append({'shot':id,'start':start,'seconds':sec,'frames':len(paths),'elapsedSeconds':round(time.time()-began,1)})
 (R/'记录/画质增强试验.json').write_text(json.dumps({'device':DEVICE,'torch':torch.__version__,'models':SOURCES,'tests':report,'faceEnhance':False,'extraSharpen':False,'interpolation':'timestamp sampling only; no AI interpolation'},ensure_ascii=False,indent=2)+'\n')
def full():
 selection=json.loads((R/'src/enhancement.json').read_text());models={};result=[]
 for id,e in ai.items():
  cfg=selection['shots'][id];kind=cfg['model'];alpha=cfg['blend'];folder=R/('.cache/upscale-final'+SUFFIX)/id;paths=native_frames(id,0,e['seconds'],folder/'native');frames=folder/'frames';frames.mkdir(exist_ok=True)
  if kind!='baseline' and kind not in models:models[kind]=network(kind)
  token={'outputSize':list(TARGET),'source':e['sourceSha256'],'config':cfg,'modelChecksums':SOURCES['weights']}
  tokenfile=folder/'cache-key.json'
  if not tokenfile.exists() or json.loads(tokenfile.read_text())!=token:
   for old in frames.glob('*.png'):old.unlink()
   tokenfile.write_text(json.dumps(token,indent=2))
  started=time.time()
  for i,p in enumerate(paths):
   target=frames/f'{i:04d}.png'
   if not target.exists():
    im=Image.open(p).convert('RGB');base=im.resize(TARGET,Image.Resampling.LANCZOS)
    out=base if kind=='baseline' else Image.blend(base,enhance(models[kind],im),alpha)
    out.save(target,compress_level=1)
   if i%60==0:print('full',id,i,'/',len(paths),'seconds',round(time.time()-started,1),flush=True)
  dest=R/('public/ai-enhanced'+SUFFIX)/f'{id}.mp4';dest.parent.mkdir(exist_ok=True);encode(frames,dest,len(paths))
  result.append({'shot':id,'frames':len(paths),'config':cfg,'file':str(dest.relative_to(R/'public')),'sha256':digest(dest),'sourceSha256':digest((R.parents[1]/e['source'])),'losslessFrames':str(frames.relative_to(R)),'elapsedSeconds':round(time.time()-started,1)})
 (R/('记录/AI画质增强处理'+SUFFIX+'.json')).write_text(json.dumps({'device':DEVICE,'torch':torch.__version__,'outputSize':list(TARGET),'fps':30,'shots':result,'models':SOURCES,'originalsUnmodified':True},ensure_ascii=False,indent=2)+'\n')
def activate(mode):
 if mode=='original':
  for e in ai.values():
   e['file']=e.get('originalFile',e['file']);e['activeVariant']='original';e['notes']='原始480P视频常规放大为1080P输出；非原生1080P。'
  MAN.write_text(json.dumps(ai,ensure_ascii=False,indent=2)+'\n');print('active original');return
 cfg=json.loads((R/'src/enhancement.json').read_text());report=json.loads((R/('记录/AI画质增强处理'+SUFFIX+'.json')).read_text())
 for id,e in ai.items():
  e.setdefault('originalFile',e['file']);r=next(r for r in report['shots'] if r['shot']==id)
  assert r['sourceSha256']==digest((R.parents[1]/e['source']))==e['sourceSha256']
  assert r['config']==cfg['shots'][id] and digest(R/'public'/r['file'])==r['sha256']
  e['enhancement']={**cfg['shots'][id],'file':r['file'],'sha256':r['sha256'],'outputSize':list(TARGET),'fps':30,'method':'Real-ESRGAN official SRVGG + Lanczos baseline blend','sourceSha256':e['sourceSha256'],'denoiseStrength':.35,'faceEnhance':False,'extraSharpen':False,'processingReport':'记录/AI画质增强处理'+SUFFIX+'.json'}
  e['activeVariant']=mode;e['file']=r['file'] if mode=='enhanced' else e['originalFile'];e['notes']='原始852×480；本地超分与原片放大混合后'+str(TARGET[0])+'×'+str(TARGET[1])+'输出，非原生高清。'
 MAN.write_text(json.dumps(ai,ensure_ascii=False,indent=2)+'\n');print('active',mode)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('mode',choices=['compare','full','enhanced','original']);p.add_argument('--4k',action='store_true',dest='fourk');args=p.parse_args()
 if args.fourk:TARGET=(3840,2160);SUFFIX='-4k'
 print('Device',DEVICE,'Torch',torch.__version__,flush=True)
 if args.mode=='compare':compare()
 elif args.mode=='full':full()
 else:activate(args.mode)
