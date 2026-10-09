from pathlib import Path
import json,hashlib,re,subprocess
from PIL import Image
import numpy as np
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parents[1];ff=imageio_ffmpeg.get_ffmpeg_exe()
records=[]
for name in ['更迭-插画电影化样片-v1.mp4','原版效果-对照.mp4','更迭-动画升级对比-v1.mp4']:
    file=ROOT/'输出'/name
    p=subprocess.run([ff,'-hide_banner','-v','info','-progress','pipe:1','-i',str(file),'-map','0:v:0','-map','0:a:0','-f','null','-'],capture_output=True,text=True)
    frames=[int(x)for x in re.findall(r'^frame=(\d+)',p.stdout,re.M)]
    dims=re.search(r'Video: h264.*? (\d{3,5})x(\d{3,5}).*? (\d+(?:\.\d+)?) fps',p.stderr)
    if not dims:raise RuntimeError(p.stderr)
    raw=subprocess.check_output([ff,'-v','error','-i',str(file),'-vn','-f','f32le','-ac','2','-ar','48000','pipe:1']);a=np.frombuffer(raw,dtype='<f4')
    peak=float(np.max(np.abs(a)));r={'file':str(file.relative_to(ROOT)),'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'width':int(dims[1]),'height':int(dims[2]),'fps':float(dims[3]),'decodedFrames':frames[-1]if frames else 0,'decodeExitCode':p.returncode,'audioChannels':2,'audioSampleRate':48000,'audioDuration':len(a)/2/48000,'audioPeakDBFS':float(20*np.log10(max(peak,1e-9))),'audioNonSilent':bool(np.max(np.abs(a))>.001),'audioClippedSamples':int(np.count_nonzero(np.abs(a)>=1))}
    r['passed']=p.returncode==0 and r['width']==1920 and r['height']==1080 and r['fps']==30 and r['decodedFrames']==540 and abs(r['audioDuration']-18)<.05 and r['audioNonSilent']and r['audioClippedSamples']==0
    records.append(r)
new=[]
for f in sorted((ROOT/'素材').rglob('*.png')):
    im=Image.open(f);alpha=im.getchannel('A')if im.mode=='RGBA'else None
    new.append({'path':str(f.relative_to(ROOT)),'width':im.width,'height':im.height,'mode':im.mode,'alphaRange':alpha.getextrema()if alpha else [255,255],'alphaBBox':alpha.getbbox()if alpha else None,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
metadata={'newImageCount':len(new),'images':new,'spaceLayers':'引用 ../素材/图层/BG-09/ 三份现有对齐图层','placement':'程序/参数.js 中的火光图层尺寸、位置与锚点；金字塔建筑层有小幅位置校准；地球保持底边余量。','generatedBy':'builtin ImageGen','nativeSceneResolutionPassed':False}
(ROOT/'记录/素材记录.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
result={'videos':records,'passed':all(r['passed']for r in records)};(ROOT/'记录/视频验收.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False))
if not result['passed']:raise SystemExit(1)
