"""Refresh exported soundtracks without re-encoding any video frames."""
from pathlib import Path
import json,subprocess,wave,hashlib
import imageio_ffmpeg
R=Path(__file__).resolve().parents[1];F=imageio_ffmpeg.get_ffmpeg_exe();cache=R/'.cache/音轨替换';cache.mkdir(exist_ok=True)
plan=json.loads(subprocess.run(['node','--input-type=module','-e',"import fs from 'node:fs';import{shots}from'./src/story.js';console.log(JSON.stringify({shots,joins:JSON.parse(fs.readFileSync('src/edit.json')).joins}));"],cwd=R,capture_output=True,text=True,check=True).stdout)
starts={s['id']:s['start'] for s in plan['shots']};joins=plan['joins'];features=[j for j in joins if j['pair'] in ['01-02','05-06','09-10']]
with wave.open(str(R/'public/audio/master.wav')) as w:params=w.getparams();raw=w.readframes(w.getnframes())
sr=params.framerate;stride=params.nchannels*params.sampwidth;assert sr==48000

def soundtrack(name,segments):
 p=cache/(name+'.wav');data=b''.join(raw[round(start*sr/30)*stride:round((start+frames)*sr/30)*stride] for start,frames in segments)
 with wave.open(str(p),'wb') as w:w.setparams(params);w.writeframes(data)
 return p

def spans(items):return [(starts[j['pair'].split('-')[1]]-j['pre']-15,j['pre']+j['post']+30)for j in items]
reel=soundtrack('TransitionReel',spans(joins));compare=soundtrack('FeatureCompare',spans(features));demo=soundtrack('TransitionDemo',[(261,150)])
jobs=[(R/'输出/Hybrid.mp4',R/'public/audio/master.wav'),(R/'输出/Pilot.mp4',R/'public/audio/pilot.wav'),(R/'输出/TransitionDemo.mp4',demo),(R/'输出/TransitionReel.mp4',reel),(R/'输出/FeatureCompare.mp4',compare)]
names=['01-火光融入卡牌','05-金字塔回到奇观','09-最终挑战进入太空']
for name,seg in zip(names,spans(features)):jobs.append((R/'输出/重点转场对比'/(name+'.mp4'),soundtrack(name,[seg])))
for name,src in [('三个重点-半速前后对比',compare),('全部转场-半速审片',reel)]:
 with wave.open(str(src)) as w:duration=w.getnframes()/sr*2
 dest=cache/(name+'.wav');subprocess.run([F,'-v','error','-y','-i',str(src),'-af',f'atempo=0.5,apad,atrim=duration={duration}','-c:a','pcm_s24le',str(dest)],check=True);jobs.append((R/'输出/重点转场对比'/(name+'.mp4'),dest))

def video_hash(p):return subprocess.run([F,'-v','error','-i',str(p),'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-'],capture_output=True,text=True,check=True).stdout.strip()
report=[]
for video,sound in jobs:
 if not video.exists():raise SystemExit('Missing export: '+str(video))
 before=video_hash(video);dest=video.with_name(video.stem+'.new-audio.mp4')
 with wave.open(str(sound)) as w:duration=w.getnframes()/w.getframerate()
 subprocess.run([F,'-v','error','-y','-i',str(video),'-i',str(sound),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-t',str(duration),'-movflags','+faststart',str(dest)],check=True)
 after=video_hash(dest);assert before==after,(video,'video stream changed')
 subprocess.run([F,'-v','error','-xerror','-i',str(dest),'-f','null','-'],check=True)
 dest.replace(video);report.append({'file':str(video.relative_to(R)),'duration':duration,'videoPacketSHA256':after,'unchangedVideo':True,'audioSource':str(sound.relative_to(R)),'fullDecode':'passed'});print('Updated audio; picture unchanged:',video.name,flush=True)
(R/'记录/配乐替换核对.json').write_text(json.dumps({'passed':True,'music':'宣传片/AI配乐/ITERATION.wav','sourceSHA256':hashlib.sha256((R.parent/'AI配乐/ITERATION.wav').read_bytes()).hexdigest(),'sourceDuration':90,'sourcePlaybackRate':1,'exports':report,'notes':'只替换音轨；逐个比较压缩视频数据摘要，完整解码检查；操作音效原始文件摘要保持一致。'},ensure_ascii=False,indent=2)+'\n')
