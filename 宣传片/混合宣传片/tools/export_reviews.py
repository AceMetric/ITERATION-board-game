"""Export frame-aligned individual comparisons and half-speed review films."""
from pathlib import Path
import json,subprocess
import imageio_ffmpeg
R=Path(__file__).resolve().parents[1];F=imageio_ffmpeg.get_ffmpeg_exe();out=R/'输出/重点转场对比';out.mkdir(exist_ok=True)
edit=json.loads((R/'src/edit.json').read_text());names={'01-02':'01-火光融入卡牌','05-06':'05-金字塔回到奇观','09-10':'09-最终挑战进入太空'};cursor=0;jobs=[]
for j in edit['joins']:
 if j['pair']not in names:continue
 frames=j['pre']+j['post']+30;dest=out/(names[j['pair']]+'.mp4');filters=f'[0:v]trim=start_frame={cursor}:end_frame={cursor+frames},setpts=PTS-STARTPTS[v];[0:a]atrim=start={cursor/30}:end={(cursor+frames)/30},asetpts=PTS-STARTPTS[a]'
 jobs.append((R/'输出/FeatureCompare.mp4',dest,filters));cursor+=frames
for src,name in [('FeatureCompare','三个重点-半速前后对比'),('TransitionReel','全部转场-半速审片')]:jobs.append((R/'输出'/(src+'.mp4'),out/(name+'.mp4'),'[0:v]setpts=2*(PTS-STARTPTS)[v];[0:a]atempo=0.5,asetpts=PTS-STARTPTS[a]'))
for source,dest,filters in jobs:
 subprocess.run([F,'-v','error','-y','-i',str(source),'-filter_complex',filters,'-map','[v]','-map','[a]','-r','30','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','256k','-movflags','+faststart',str(dest)],check=True)
 subprocess.run([F,'-v','error','-xerror','-i',str(dest),'-f','null','-'],check=True)
 print('Saved and decoded:',dest.name,flush=True)
