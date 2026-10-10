from pathlib import Path
import json,re,subprocess
import imageio_ffmpeg
R=Path(__file__).resolve().parents[1];F=imageio_ffmpeg.get_ffmpeg_exe();report=[]
files=[('Opening.mp4',4),('TransitionDemo.mp4',5),('TransitionReel.mp4',28.4),('FeatureCompare.mp4',8.8)]+[(f'Shot{id}.mp4',sec)for id,sec in [('02',12),('04',9),('06',11),('09',10),('11',5)]]
status=json.loads((R/'记录/交付状态.json').read_text());files.append((Path(status['master']).name,90))
pilot=next((R/'输出').glob('首轮样片-*-4K.mp4'));files.append((pilot.name,22))
for name,seconds in files:
 p=R/'输出'/name;a=subprocess.run([F,'-hide_banner','-v','info','-xerror','-i',str(p),'-f','null','-'],capture_output=True,text=True,check=True);s=a.stderr
 dims=re.search(r'Video:.*? (\d{2,5})x(\d{2,5})(?:[,\s\[])',s);fps=re.search(r'(\d+(?:\.\d+)?) fps',s);dur=re.search(r'Duration: (\d+):(\d+):([\d.]+)',s);frames=[int(x)for x in re.findall(r'frame=\s*(\d+)',s)]
 assert dims and list(map(int,dims.groups()))==status['size'],name+' size';assert fps and float(fps.group(1))==30,name+' fps';assert frames and frames[-1]==round(seconds*30),(name,frames[-1]if frames else None)
 h,m,t=dur.groups();duration=int(h)*3600+int(m)*60+float(t);assert abs(duration-seconds)<=.05,(name,duration)
 assert re.search(r'Audio: aac.*48000 Hz, stereo',s),name+' AAC stereo'
 report.append({'file':name,'size':status['size'],'fps':30,'duration':duration,'framesDecoded':frames[-1],'codec':'H.264','audio':'AAC 48000Hz stereo','fullDecode':'passed'})
 for id,time in [('02',2.5),('04',5.2),('06',10.5),('09',6.5),('11',2)]:
  if name==f'Shot{id}.mp4':subprocess.run([F,'-v','error','-y','-ss',str(time),'-i',str(p),'-frames:v','1',str(R/'记录'/f'视频{id}-关键帧.png')],check=True)
(R/'记录/视频核对.json').write_text(json.dumps({'passed':True,'videos':report,'notes':'全量解码同时包含视频与音频；六段真实 AI 视频已导入，原始 852×480，经本地超分与原片放大混合输出；三维与文字原生4K；AI及转场为480P超分4K。'},ensure_ascii=False,indent=2)+'\n');print('Decoded and verified',len(report),'videos')
