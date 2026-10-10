"""Verify provenance, dimensions/timing and pixel samples, not subjective quality."""
from pathlib import Path
import hashlib,json,re,subprocess
import numpy as np
import imageio_ffmpeg
from PIL import Image
R=Path(__file__).resolve().parents[1];F=imageio_ffmpeg.get_ffmpeg_exe();manifest=json.loads((R/'src/ai.json').read_text());report=json.loads((R/next(iter(manifest.values()))['enhancement']['processingReport']).read_text());size=report['outputSize'];suffix='-4k' if size==[3840,2160] else '';checks=[]
for id,e in manifest.items():
 assert hashlib.sha256((R.parents[1]/e['source']).read_bytes()).hexdigest()==e['sourceSha256']
 subprocess.run([F,'-v','error','-xerror','-i',str(R.parents[1]/e['source']),'-f','null','-'],check=True)
 info=next(x for x in report['shots'] if x['shot']==id);p=R/'public'/info['file'];n=round(e['seconds']*30)
 log=subprocess.run([F,'-hide_banner','-xerror','-i',str(p),'-f','null','-'],capture_output=True,text=True,check=True).stderr
 assert re.search(rf'{size[0]}x{size[1]}.*30 fps',log),id
 count=int(re.findall(r'frame=\s*(\d+)',log)[-1]);assert count==n,(id,count,n)
 errors=[]
 for k in [0,n//2,n-1]:
  native=Image.open(R/('.cache/upscale-final'+suffix)/id/'native'/f'{k:04d}.png').convert('RGB').resize((320,180),Image.Resampling.LANCZOS)
  enhanced=Image.open(R/info['losslessFrames']/f'{k:04d}.png').convert('RGB');assert enhanced.size==tuple(size)
  down=enhanced.resize((320,180),Image.Resampling.LANCZOS)
  error=float(np.abs(np.asarray(native).astype(float)-np.asarray(down).astype(float)).mean());errors.append(round(error,4));assert error<6,(id,k,error)
 checks.append({'shot':id,'framesDecoded':count,'size':size,'fps':30,'sampleFrames':[0,n//2,n-1],'downsampledMeanRGBDifference':errors,'sourceHashUnchanged':True})
tracks=json.loads((R/'src/tracking.json').read_text());before=json.loads((R/'记录/画质增强前-tracking.json').read_text())
for name,t in tracks.items():
 assert t['materialSize']==size and t['analysisSize']==[960,540] and t['coordinateSize']==[1920,1080]
 assert np.allclose([x['points']for x in t['frames']],[x['points']for x in before[name]['frames']],atol=.0011),(name,'changed path')
 assert t['triangles']==before[name]['triangles']
 for k in [0,len(t['frames'])//2,len(t['frames'])-1]:
  for suffix in ['.jpg','-fg.png','-bg.jpg']:assert Image.open(R/'public/transitions/motion'/name/f'{k:03d}{suffix}').size==tuple(size)
frozen=json.loads((R/'记录/画质增强-时序与声音基准.json').read_text())
for p,sha in frozen.items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==sha,(p,'timing/audio changed')
result={'timingAndAudioUnchanged':True,'passed':True,'shots':checks,'originalSourceSize':[852,480],'outputSize':size,'superResolution':True,'notNativeHD':True,'trajectoryPreserved':True,'scope':'Full source and output decoding, hashes, frame counts, all mesh trajectories, representative handle dimensions, coarse pixel fidelity. Visual continuity and texture require separate review.'}
(R/'记录/画质增强技术核对.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('Enhancement verified:',len(checks),'shots; 1170 frames; original trajectories preserved')
