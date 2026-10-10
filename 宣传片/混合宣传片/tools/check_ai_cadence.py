"""Match every plain AI shot frame to its source, outside editorial overlays.

Unlike decode/frame-count checks, this detects stale or out-of-order source
frames baked into a movie. Duplicate source frames from 24->30fps are allowed.
"""
from pathlib import Path
import argparse,json,subprocess
import numpy as np
import imageio_ffmpeg
R=Path(__file__).resolve().parents[1]; F=imageio_ffmpeg.get_ffmpeg_exe()
p=argparse.ArgumentParser();p.add_argument('movie');p.add_argument('--offset',type=int,default=0);p.add_argument('--range',nargs=2,type=int);p.add_argument('--report',default='记录/AI逐帧时序核对.json');p.add_argument('--diagnose',action='store_true');p.add_argument('--pilot',action='store_true');args=p.parse_args()
shots=[('01',120,180,'left'),('03',660,180,'left'),('05',1110,180,'left'),('07',1620,150,'right'),('08',1770,300,'left'),('10',2370,180,'left')]
edit=json.loads((R/'src/edit.json').read_text());ai=json.loads((R/'src/ai.json').read_text())
if args.pilot:shots=[('08',360,300,'left')]
def frames(file,start,count):
    raw=subprocess.check_output([F,'-v','error','-ss',str(start/30),'-i',str(file),'-frames:v',str(count),'-vf','scale=320:180:flags=area','-an','-f','rawvideo','-pix_fmt','rgb24','-'])
    return np.frombuffer(raw,np.uint8).reshape(-1,180,320,3)
rows=[]
for id,start,n,side in shots:
    incoming={'post':21} if args.pilot else next(j for j in edit['joins'] if j['pair'].endswith('-'+id))
    outgoing={'pre':0} if args.pilot else next(j for j in edit['joins'] if j['pair'].startswith(id+'-'))
    lo=start+incoming['post'];hi=start+n-outgoing['pre']
    if args.range:lo=max(lo,args.range[0]);hi=min(hi,args.range[1]+1)
    if lo>=hi:continue
    a=frames(Path(args.movie),lo-args.offset,hi-lo);b=frames(R/'public'/ai[id]['file'],0,n)
    # Top corner opposite the caption: both CSS gradients are fully transparent.
    x=slice(256,318) if side=='left' else slice(2,64)
    a=a[:,4:68,x].astype(np.float32);b=b[:,4:68,x].astype(np.float32)
    expected=np.arange(lo-start,hi-start)
    # Chrome's old HTML video path and FFmpeg can differ in color conversion.
    # Fit one static RGB transform for the entire shot, never per-frame motion.
    bs=b[expected].reshape(-1,3)[::31]; aa=a.reshape(-1,3)[::31]
    transform=np.linalg.lstsq(np.column_stack([bs,np.ones(len(bs))]),aa,rcond=None)[0]
    b=np.concatenate([b,np.ones((*b.shape[:-1],1),np.float32)],axis=-1)@transform
    av=a.reshape(len(a),-1)/255;bv=b.reshape(len(b),-1)/255
    mse=np.maximum(0,(av*av).mean(1)[:,None]+(bv*bv).mean(1)[None,:]-2*av@bv.T/av.shape[1])
    rmse=np.sqrt(mse)*255;best=rmse.argmin(1)
    # Equivalent duplicates are not considered wrong, even if argmin breaks ties.
    be=rmse[np.arange(len(a)),best];ee=rmse[np.arange(len(a)),expected]
    wrong=(ee>be+.45)&(ee>1.8)
    row={'shot':id,'globalRange':[lo,hi-1],'frames':len(a),'expectedSourceFrames':expected.tolist(),'bestSourceFrames':best.tolist(),'wrongFrameCount':int(wrong.sum()),'meanExpectedRMSE':float(ee.mean()),'meanBestRMSE':float(be.mean()),'maxExpectedRMSE':float(ee.max()),'backwardBestSteps':int((np.diff(best)<-1).sum()),'wrongGlobalFrames':(np.arange(lo,hi)[wrong]).tolist()}
    rows.append(row);print(json.dumps({k:v for k,v in row.items() if not isinstance(v,list)},ensure_ascii=False),flush=True)
assert rows,'No AI frames checked'
report={'passed':all(r['wrongFrameCount']==0 for r in rows),'method':'Compare 320x180 decoded top-corner pixels opposite caption; no text or gradient in sampled patch. One static RGB transform per shot compensates browser/FFmpeg color conversion. Equivalent original duplicate frames allowed. This tests baked frame content, not player performance.','movie':str(args.movie),'checkedFrames':sum(r['frames']for r in rows),'shots':rows}
(R/args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
if not args.diagnose:assert report['passed'],'Stale/out-of-order AI frames found'
