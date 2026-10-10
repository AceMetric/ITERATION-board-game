"""Verify moving handles reach the exact source positions at both ends."""
from pathlib import Path
import subprocess,json,numpy as np
import imageio_ffmpeg
R=Path(__file__).resolve().parents[1];F=imageio_ffmpeg.get_ffmpeg_exe()
recipes=json.loads((R/'记录/双侧转场素材.json').read_text())['handles'];checks=[]
def pixels(args):
 raw=subprocess.run([F,'-v','error',*args,'-vsync','0','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True,check=True).stdout
 return np.frombuffer(raw,np.uint8).reshape(-1,180,320,3).astype(float)
for h in recipes:
 n=h['sourceFrames']-1
 source=pixels(['-ss',str(h['sourceStart']),'-i',str(R/'public'/h['source']),'-vf',f"select='eq(n,0)+eq(n,{n})',scale=320:180",'-frames:v','2'])
 for edge,index,expected in [('first',0,source[0]),('last',h['outputFrames']-1,source[1])]:
  actual=pixels(['-i',str(R/h['path']/f'{index:03}.jpg'),'-vf','scale=320:180','-frames:v','1'])[0]
  error=float(np.abs(actual-expected).mean())
  checks.append({'shot':h['shot'],'handle':h['edge'],'endpoint':edge,'meanRGBError255':round(error,4)})
  assert error<4,(h['shot'],h['edge'],edge,error)
(R/'记录/动态转场端点核对.json').write_text(json.dumps({'passed':True,'checks':checks,'scope':'Both endpoints compared to corresponding original video frames at 320×180; mean RGB error <4/255, allowing JPEG encoding.'},ensure_ascii=False,indent=2)+'\n')
print('Moving handle endpoints verified:',len(checks))
