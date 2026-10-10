"""Tracked, endpoint-speed-matched transition handles; source media stays intact."""
from pathlib import Path
import subprocess,json,hashlib,sys
import cv2,numpy as np,imageio_ffmpeg
R=Path(__file__).resolve().parents[1];F=imageio_ffmpeg.get_ffmpeg_exe();ai=json.loads((R/'src/ai.json').read_text());edit=json.loads((R/'src/edit.json').read_text())
W,H=next(iter(ai.values())).get('enhancement',{}).get('outputSize',[1920,1080]);P=W/960;K=W/1920
# Manual silhouette correspondences, measured against native start/end frames and original card art.
S={
'fire':dict(card='fire',head=[[1195,535],[1250,605],[1220,675],[1280,625],[1304,674],[1290,760],[1370,936],[1300,980],[1200,1000],[1100,967],[1090,855],[1150,777],[1085,705],[1107,610],[1140,655],[1182,590]],uv=[[.455,.15],[.50,.20],[.47,.24],[.53,.20],[.56,.25],[.54,.31],[.63,.40],[.57,.42],[.48,.42],[.36,.40],[.36,.33],[.41,.30],[.33,.25],[.35,.20],[.40,.25],[.43,.18]],shift=[0,0]),
'letters':dict(card='letters',head=[[1553,553],[1863,596],[1757,968],[1449,906]],uv=[[.562,.246],[.756,.292],[.697,.475],[.574,.432]],shift=[0,0]),
'pyramid':dict(card='pyramid',head=[[1421,156],[1904,696],[1550,704],[935,704]],uv=[[.456,.172],[.678,.33],[.512,.325],[.25,.327]],shift=[0,25]),
'ship':dict(card='final',head=[[1720,390],[1606,361],[1480,379],[1416,398],[1254,397],[1304,428],[1170,466],[1234,488],[915,605],[1236,542],[1254,577],[1455,508],[1626,423]],uv=[[.743,.277],[.66,.263],[.58,.272],[.53,.283],[.428,.256],[.45,.282],[.38,.313],[.392,.315],[.20,.327],[.40,.33],[.461,.342],[.57,.318],[.69,.285]],shift=[40,-20]),
'sky':dict(card='final',head=[[0,0],[1920,0],[1920,280],[0,280]],uv=[[.20,.16],[.76,.16],[.76,.32],[.20,.32]],shift=[0,0])}
# Keys apply corrections at observed native endpoints. LK supplies motion between them.
locked_file=R/'记录/画质增强前-tracking.json';locked_file=locked_file if locked_file.exists() else R/'src/tracking.json';locked=json.loads(locked_file.read_text()) if locked_file.exists() else {}
selected=set(sys.argv[1:]);report=json.loads((R/'记录/双侧转场素材.json').read_text())['handles'] if selected else [];meta=json.loads((R/'src/tracking.json').read_text()) if selected else {};motion=R/'public/transitions/motion';motion.mkdir(parents=True,exist_ok=True)
def read_frames(src,start,n):
 p=subprocess.run([F,'-v','error','-ss',str(start),'-i',str(src),'-vf',f'scale={W}:{H}','-frames:v',str(n),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE,check=True)
 arr=np.frombuffer(p.stdout,np.uint8).reshape(-1,H,W,3).copy()
 if len(arr)<n:arr=np.concatenate([arr,np.repeat(arr[-1:],n-len(arr),axis=0)])
 return arr

def flow(a,b):return cv2.calcOpticalFlowFarneback(cv2.cvtColor(a,cv2.COLOR_RGB2GRAY),cv2.cvtColor(b,cv2.COLOR_RGB2GRAY),None,.5,3,21,3,5,1.2,0)
yy,xx=np.mgrid[:540,:960].astype(np.float32)
def warp(im,f,amount):
 h,w=im.shape[:2];g=cv2.resize(f,(w,h),interpolation=cv2.INTER_LINEAR)*[w/960,h/540];gy,gx=np.mgrid[:h,:w].astype(np.float32)
 return cv2.remap(im,gx+g[:,:,0].astype(np.float32)*amount,gy+g[:,:,1].astype(np.float32)*amount,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
def triangles(pts):
 sub=cv2.Subdiv2D((-200,-200,1400,1000))
 for p in pts:sub.insert(tuple(map(float,p)))
 result=[]
 for t in sub.getTriangleList().reshape(-1,3,2):
  ix=[int(np.argmin(np.sum((pts-p)**2,axis=1))) for p in t]
  if len(set(ix))==3 and all(np.linalg.norm(pts[i]-p)<1 for i,p in zip(ix,t)):result.append(ix)
 return result
for j in edit['joins']:
 if selected and j['pair'] not in selected:continue
 report=[h for h in report if h['pair']!=j['pair']]
 a,b=j['pair'].split('-');L=j['pre']+j['post']
 for id,edge,n in [(a,'tail',j['pre']),(b,'head',j['post'])]:
  if id not in ai:continue
  src=R/'public'/ai[id]['file'];start=0 if edge=='head' else ai[id]['seconds']-n/30;plates=read_frames(src,start,n);frames=np.stack([cv2.resize(f,(960,540),interpolation=cv2.INTER_AREA) for f in plates])
  out=motion/f'{id}-{edge}';out.mkdir(parents=True,exist_ok=True)
  for p in out.glob('*'):p.unlink()
  sub=S.get(j.get('subject')) if j['type'] in ['into','out'] else None
  forward=[flow(frames[k],frames[k+1]) for k in range(n-1)];backward=[flow(frames[k+1],frames[k]) for k in range(n-1)]
  nativepoints=[]
  if sub:
   # Full-film endpoints are the manual keys. Track from the nearby observed endpoint,
   # then apply a smooth correction to that key to avoid accumulated flow drift.
   base=np.array(sub['head'],np.float32)/2
   if edge=='tail':base+=np.array(sub['shift'],np.float32)/2
   endpoint=frames[-1] if edge=='tail' else frames[0]
   cur=base.copy();tracks=[cur.copy()]
   ordered=list(frames[::-1]) if edge=='tail' else list(frames)
   for k in range(n-1):
    p,status,_=cv2.calcOpticalFlowPyrLK(cv2.cvtColor(ordered[k],cv2.COLOR_RGB2GRAY),cv2.cvtColor(ordered[k+1],cv2.COLOR_RGB2GRAY),cur[:,None,:],None,winSize=(31,31),maxLevel=3)
    candidate=p[:,0,:];valid=(status[:,0]>0)&(np.linalg.norm(candidate-cur,axis=1)<24)
    cur=np.where(valid[:,None],candidate,cur)
    if j['subject']=='sky':cur=base.copy()
    if j['subject']=='fire':
     cur=base+np.clip(cur-base,-10,10)*.2
     if (k+1)%6==0:cur=base.copy()
    tracks.append(cur.copy())
   nativepoints=tracks[::-1] if edge=='tail' else tracks
   # Centroid is a mesh interior control point, avoiding a single affine billboard.
   nativepoints=[np.vstack([p,p.mean(axis=0)]) for p in nativepoints]
   target=np.array(sub['uv']);target=np.vstack([target,target.mean(axis=0)])
   tri=triangles(nativepoints[0]);item={'card':sub['card'],'uv':target.tolist(),'triangles':tri,'frames':[],'size':[W,H],'analysisSize':[960,540],'coordinateSize':[1920,1080],'materialSize':[W,H],'method':'manual endpoint silhouette + pyramidal LK + bidirectional dense optical-flow retiming'}
   # Temporal, locally aligned samples reconstruct only the removed subject region.
   ref=(plates[-1] if edge=='tail' else plates[0]).copy();poly=np.rint(base*P).astype(np.int32);mask=np.zeros((H,W),np.uint8);cv2.fillPoly(mask,[poly],255)
   if j['subject']=='fire':mask=cv2.dilate(mask,np.ones((int(22*K),int(22*K)),np.uint8))
   else:mask=cv2.dilate(mask,np.ones((int(14*K),int(14*K)),np.uint8))
   candidates=[]
   grey=cv2.cvtColor(ref,cv2.COLOR_RGB2GRAY);features=cv2.goodFeaturesToTrack(grey,250,.01,24*K,mask=255-mask)
   for k in np.linspace(0,n-1,min(n,8)).astype(int):
    f=plates[k];affine=None
    if features is not None:
     q,ok,_=cv2.calcOpticalFlowPyrLK(grey,cv2.cvtColor(f,cv2.COLOR_RGB2GRAY),features,None,winSize=(int(60*K)+1,int(60*K)+1),maxLevel=3)
     valid=ok[:,0]>0
     if valid.sum()>=6:affine,_=cv2.estimateAffinePartial2D(q[valid],features[valid],method=cv2.RANSAC)
    if affine is None:affine=np.array([[1,0,0],[0,1,0]],np.float32)
    aligned=cv2.warpAffine(f,affine,(W,H),borderMode=cv2.BORDER_REFLECT)
    kpoly=np.rint(nativepoints[k][:-1]*P).astype(np.int32);km=np.zeros_like(mask);cv2.fillPoly(km,[kpoly],255);km=cv2.warpAffine(km,affine,(W,H));aligned=aligned.astype(np.float32);aligned[km>0]=np.nan;candidates.append(aligned)
   import warnings
   with warnings.catch_warnings():
    warnings.simplefilter('ignore',RuntimeWarning);temporal=np.nanmedian(np.stack(candidates),axis=0)
   usable=np.isfinite(temporal).all(axis=2)&(mask>0);ref[usable]=temporal[usable].astype(np.uint8)
   hole=((mask>0)&~usable).astype(np.uint8)*255
   clean=cv2.inpaint(ref,hole,10*K,cv2.INPAINT_TELEA) if np.any(hole) else ref
   # Large opaque architecture: background continuation follows neighboring sky/desert,
   # not a translated copy of the whole scene. Telea is confined to silhouette.
   item['repair']={'temporalSamples':len(candidates),'temporalPixels':int(usable.sum()),'inpaintPixels':int((hole>0).sum()),'wholeFrameTranslation':False}
  for k in range(L):
   u=k/(L-1);sf=(-2*u**3+3*u*u)*(n-1)+(u**3-2*u*u+u)*(L-1)+(u**3-u*u)*(L-1);sf=float(np.clip(sf,0,n-1));lo=min(int(sf),n-2);t=sf-lo
   if k==0:im=plates[0].copy()
   elif k==L-1:im=plates[-1].copy()
   else:im=((1-t)*warp(plates[lo],backward[lo],t)+t*warp(plates[lo+1],forward[lo],1-t)).clip(0,255).astype(np.uint8)
   cv2.imwrite(str(out/f'{k:03d}.jpg'),cv2.cvtColor(im,cv2.COLOR_RGB2BGR),[cv2.IMWRITE_JPEG_QUALITY,98])
   if sub:
    pts=(1-t)*nativepoints[lo]+t*nativepoints[lo+1]
    old=locked.get(f'{id}-{edge}')
    if ai[id].get('activeVariant')=='enhanced' and old and len(old['frames'])==L:
     pts=np.array(old['frames'][k]['points'],np.float32)/2;item['triangles']=old['triangles'];item['trajectoryPreserved']=True
    alpha=np.zeros((H,W),np.uint8);cv2.fillPoly(alpha,[np.rint(pts[:-1]*P).astype(np.int32)],255)
    alpha=cv2.GaussianBlur(alpha,(0,0),(1.4 if j['subject'] not in ['fire','sky'] else 3.2)*K)
    if j['subject']=='fire':
     # Preserve flame tongues, suppress the dark silhouette around their tips.
     rgb=im.astype(np.float32);warm=np.clip((rgb[:,:,0]-rgb[:,:,2]-35)/60,0,1)*np.clip((rgb[:,:,0]-160)/65,0,1);core=np.clip((rgb.min(axis=2)-190)/55,0,1);key=np.maximum(warm,core);edge_distance=cv2.distanceTransform((alpha>128).astype(np.uint8),cv2.DIST_L2,3);key*=np.clip(edge_distance/(10*K),0,1);alpha=(alpha*key).astype(np.uint8);alpha=cv2.GaussianBlur(alpha,(0,0),1.3*K)
    if j['subject']=='sky':
     # Luminance-keyed stars/nebula, no oval or rectangular detached sky tile.
     lum=cv2.cvtColor(im,cv2.COLOR_RGB2GRAY);alpha=(alpha*np.clip((lum.astype(float)-85)/100,0,1)).astype(np.uint8)
    rgba=cv2.cvtColor(im,cv2.COLOR_RGB2BGRA);rgba[:,:,3]=alpha;cv2.imwrite(str(out/f'{k:03d}-fg.png'),rgba)
    # Follow background motion with a local affine fit; preserve original outside removal.
    delta=pts[:-1].mean(axis=0)-base.mean(axis=0)
    repaired=cv2.warpAffine(clean,np.array([[1,0,delta[0]*P],[0,1,delta[1]*P]],np.float32),(W,H),borderMode=cv2.BORDER_REFLECT)
    coverage=cv2.dilate(alpha,np.ones((int(26*K),int(26*K)),np.uint8));coverage=cv2.GaussianBlur(coverage,(0,0),6*K).astype(float)/255
    env=(im*(1-coverage[:,:,None])+repaired*coverage[:,:,None]).astype(np.uint8)
    cv2.imwrite(str(out/f'{k:03d}-bg.jpg'),cv2.cvtColor(env,cv2.COLOR_RGB2BGR),[cv2.IMWRITE_JPEG_QUALITY,98]);item['frames'].append({'sourceFrame':round(sf,5),'points':(pts*2).round(3).tolist()})
  if sub:meta[f'{id}-{edge}']=item
  report.append({'shot':id,'edge':edge,'pair':j['pair'],'source':ai[id]['file'],'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'sourceStart':start,'sourceFrames':n,'outputFrames':L,'speedCurve':'cubic Hermite, native speed at both endpoints','interpolation':'bidirectional dense optical flow','path':str(out.relative_to(R))})
  print(id,edge,L,flush=True)
(R/'src/tracking.json').write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':'))+'\n')
(R/'记录/双侧转场素材.json').write_text(json.dumps({'handles':report,'revision':5,'materialSize':[W,H],'analysisSize':[960,540],'frozenEndpoint':False,'originalsUnmodified':True,'editConfig':'src/edit.json','tracking':'src/tracking.json'},ensure_ascii=False,indent=2)+'\n')
assets=json.loads((R/'src/assets.json').read_text());(R/'public/transitions/art').mkdir(exist_ok=True)
for key,sub in S.items():
 a=assets[sub['card']];im=cv2.imread(str(R/'public'/a['file']));x,y,w,h=a['rect'];points=np.array(sub['uv'])*[w,h]+[x,y];m=np.zeros(im.shape[:2],np.uint8);cv2.fillPoly(m,[np.rint(points).astype(np.int32)],255);m=cv2.dilate(m,np.ones((9,9),np.uint8));im=cv2.inpaint(im,m,5,cv2.INPAINT_TELEA) if key!='sky' else im;cv2.imwrite(str(R/'public/transitions/art'/f'{key}.png'),im)
