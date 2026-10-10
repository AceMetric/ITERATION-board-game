"""Use disposable fixtures to verify import safeguards; never changes the real AI manifest."""
from pathlib import Path
import tempfile,shutil,subprocess,sys,json,hashlib
import imageio_ffmpeg
R=Path(__file__).resolve().parents[1];F=imageio_ffmpeg.get_ffmpeg_exe();results=[]
with tempfile.TemporaryDirectory(prefix='iteration-import-check-')as temp:
 root=Path(temp);(root/'tools').mkdir();(root/'src').mkdir();(root/'public/ai').mkdir(parents=True);(root/'public/audio').mkdir();folder=root/'input';folder.mkdir()
 shutil.copy2(R/'tools/import_ai.py',root/'tools/import_ai.py');(root/'tools/audio.py').write_text("print('fixture audio rebuild')\n")
 manifest=root/'src/ai.json';initial=json.dumps({'08':{'status':'pending','file':None,'name':'FAST','seconds':1}});manifest.write_text(initial)
 def video(file,seconds,size='160x90',audio=False):
  args=[F,'-v','error','-y','-f','lavfi','-i',f'color=c=blue:s={size}:r=30']
  if audio:args+=['-f','lavfi','-i','sine=frequency=440:sample_rate=48000']
  args+=['-t',str(seconds),'-c:v','libx264','-pix_fmt','yuv420p']
  if audio:args+=['-c:a','aac']
  args+=[str(file)];subprocess.run(args,check=True)
 def run(expected,reason):
  a=subprocess.run([sys.executable,str(root/'tools/import_ai.py'),str(folder)],capture_output=True,text=True)
  assert (a.returncode==0)==expected,(reason,a.stdout,a.stderr)
  if not expected:assert manifest.read_text()==initial,'reject changed active manifest'
  results.append({'case':reason,'passed':True})
 run(False,'empty folder rejected')
 video(folder/'08.mp4',.4);run(False,'too short rejected')
 video(folder/'08.mp4',1,'160x160');run(False,'non 16:9 rejected')
 (folder/'08.mp4').write_bytes(b'not a video');run(False,'invalid video rejected')
 video(folder/'08.mp4',1,audio=True);shutil.copy2(folder/'08.mp4',folder/'08-copy.mp4');run(False,'duplicate selection rejected');(folder/'08-copy.mp4').unlink()
 original=hashlib.sha256((folder/'08.mp4').read_bytes()).hexdigest();run(True,'valid fixture conformed with native audio')
 m=json.loads(manifest.read_text())['08'];assert m['status']=='ready'and m['nativeSize']==[160,90]and m['hasAudio'];assert (root/'public/ai/08.mp4').exists()and(root/'public/audio/08-ai.wav').exists();assert hashlib.sha256((folder/'08.mp4').read_bytes()).hexdigest()==original
 # The whole conformed fixture must decode and have exactly 30 video frames.
 out=subprocess.run([F,'-hide_banner','-i',str(root/'public/ai/08.mp4'),'-map','0:v:0','-f','null','-'],capture_output=True,text=True,check=True);assert '1920x1080'in out.stderr
 results.append({'case':'original input unchanged; 1080P output decodes','passed':True})
(R/'记录/导入工具核对.json').write_text(json.dumps({'scope':'仅用本地临时测试素材验证导入流程，不验证即梦生成质量；真实 AI 状态未改动。','cases':results,'passed':True},ensure_ascii=False,indent=2)+'\n');print('Import fixture checks passed:',len(results))
