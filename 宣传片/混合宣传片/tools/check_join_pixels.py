"""Observe all decoded transition frames; separate smooth camera motion from isolated cuts.
A fixed unregistered RGB threshold confuses a deliberate dolly across the printed
board with a jump cut. Retain that measurement, compare its local trajectory, and
also report a constrained similarity registration at each edit/endpoint. These
measurements are diagnostics, never artistic approval.
"""
from pathlib import Path
import subprocess,json,numpy as np,cv2
import imageio_ffmpeg
R=Path(__file__).resolve().parents[1];F=imageio_ffmpeg.get_ffmpeg_exe();joins=json.loads((R/'记录/剪辑衔接核对.json').read_text())['joins']
pairs=[];indices=set()
for j in joins:
 start,end=round(j['start']*30),round(j['end']*30)
 indices.update(range(max(0,start-5),min(2700,end+6)))
 for label,time in [('begin',j['start']),('edit',j['edit']),('end',j['end'])]:
  frame=round(time*30);pairs.append((j['pair'],label,frame-1,frame))
indices=sorted(indices);expression='+'.join(f'eq(n,{n})'for n in indices)
raw=subprocess.run([F,'-v','error','-i',str(R/'输出/Hybrid.mp4'),'-vf',f"select='{expression}',scale=320:180",'-vsync','0','-f','rawvideo','-pix_fmt','rgb24','-'],check=True,capture_output=True).stdout
frames=np.frombuffer(raw,np.uint8).reshape(-1,180,320,3);assert len(frames)==len(indices),(len(frames),len(indices));lookup=dict(zip(indices,frames));results=[];failures=[]
diffs={n:float(np.abs(lookup[n].astype(float)-lookup[n-1].astype(float)).mean())for n in indices if n-1 in lookup}
def registration(a,b):
 ga,gb=[cv2.cvtColor(x,cv2.COLOR_RGB2GRAY)for x in (a,b)]
 points=cv2.goodFeaturesToTrack(ga,400,.01,5)
 if points is None:return None
 tracked,status,_=cv2.calcOpticalFlowPyrLK(ga,gb,points,None,winSize=(25,25),maxLevel=3)
 ok=status[:,0].astype(bool);x,y=points[ok],tracked[ok]
 if len(x)<12:return None
 matrix,inliers=cv2.estimateAffinePartial2D(x,y,method=cv2.RANSAC,ransacReprojThreshold=2,maxIters=2000)
 if matrix is None:return None
 warped=cv2.warpAffine(a,matrix,(320,180));valid=cv2.warpAffine(np.ones((180,320),np.uint8),matrix,(320,180))>0
 return {'scale':round(float(np.hypot(*matrix[:,0])),5),'translationPixels':matrix[:,2].round(3).tolist(),'inlierFraction':round(float(inliers.mean()),4),'retainedCoverage':round(float(valid.mean()),4),'alignedMeanRGBChange255':round(float(np.abs(warped.astype(float)-b.astype(float))[valid].mean()),4)}
for join,label,a,b in pairs:
 mean=diffs[b];luma=float(lookup[b].mean());neighbors=[diffs[n]for n in range(b-3,b+4)if n!=b and n in diffs];local=max(1,float(np.median(neighbors)));ratio=mean/local
 # An isolated discontinuity must differ from the surrounding motion. Do not
 # exempt large changes silently: report raw values and motion compensation.
 if luma<=8 or (mean>=15 and ratio>2.5):failures.append({'join':join,'boundary':label,'meanRGBChange255':mean,'localSpikeRatio':ratio,'meanBrightness255':luma})
 results.append({'join':join,'boundary':label,'frames':[a,b],'meanRGBChange255':round(mean,4),'localMedianChange255':round(local,4),'localSpikeRatio':round(ratio,4),'meanBrightness255':round(luma,4),'similarityRegistration':registration(lookup[a],lookup[b])})
trajectory=[]
for j in joins:
 start,end=round(j['start']*30),round(j['end']*30);values=[];spikes=[]
 for n in range(start,end+1):
  if n not in diffs:continue
  neighbors=[diffs[k]for k in range(n-3,n+4)if k!=n and k in diffs];ratio=diffs[n]/max(1,float(np.median(neighbors)))
  if diffs[n]>=15 and ratio>2.5:spikes.append({'frame':n,'rawChange':round(diffs[n],4),'localSpikeRatio':round(ratio,4)})
  values.append({'frame':n,'meanRGBChange255':round(diffs[n],4)})
 trajectory.append({'join':j['pair'],'spikes':spikes,'adjacentFrames':values})
 failures.extend({'join':j['pair'],'boundary':'interior',**s}for s in spikes)
report={'passed':not failures,'failures':failures,'adjacentPairs':len(results),'decodedTransitionFrames':len(indices),'maxMeanRGBChange255':max(e['meanRGBChange255']for e in results),'observations':results,'trajectories':trajectory,'criteria':'Brightness >8; no isolated adjacent change >=15 and >2.5x the median of its six neighboring changes. Similarity registration and raw differences retained for inspection.','scope':'All transition windows plus neighboring context at 320×180. Distinguishes isolated resets from sustained camera motion; does not prove masking quality, perceived smoothness or artistic quality.'}
(R/'记录/解码帧衔接核对.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
assert not failures,failures
print('Decoded transition trajectory:',len(indices),'frames;',len(results),'edges; no isolated resets. Raw maximum:',report['maxMeanRGBChange255'])
