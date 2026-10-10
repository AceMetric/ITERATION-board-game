"""Extract immutable edit handles from selected video; source videos stay unchanged."""
from pathlib import Path
import subprocess,json,hashlib
import imageio_ffmpeg
R=Path(__file__).resolve().parents[1];F=imageio_ffmpeg.get_ffmpeg_exe();manifest=json.loads((R/'src/ai.json').read_text());out=R/'public/transitions';out.mkdir(exist_ok=True);entries=[]
for id,e in manifest.items():
 if e['status']!='ready':continue
 src=R/'public'/e['file']
 for name,t in [('start',0),('end',e['seconds']-1/30)]:
  target=out/f'{id}-{name}.png';subprocess.run([F,'-v','error','-y','-ss',str(t),'-i',str(src),'-frames:v','1',str(target)],check=True)
  entries.append({'shot':id,'endpoint':name,'time':t,'source':e['file'],'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'handle':'transitions/'+target.name})
(R/'记录/主体转场素材.json').write_text(json.dumps({'sources':entries,'matteDefinition':'tools/prepare_bridges.py manual silhouette keys + LK/dense optical flow; src/tracking.json per-frame mesh; src/edit.json per-edit timing; background and foreground reconstructed separately','sourceUnmodified':True},ensure_ascii=False,indent=2)+'\n')
print('Prepared actual-video subject handles:',len(entries))
