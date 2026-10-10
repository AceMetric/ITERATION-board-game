"""Check every tracked mesh, mask and original media hash; not an aesthetic test."""
from pathlib import Path
import json,hashlib
import numpy as np,cv2
R=Path(__file__).resolve().parents[1];tracks=json.loads((R/'src/tracking.json').read_text());edit=json.loads((R/'src/edit.json').read_text());ai=json.loads((R/'src/ai.json').read_text());results=[]
def area(a):return (a[1,0]-a[0,0])*(a[2,1]-a[0,1])-(a[1,1]-a[0,1])*(a[2,0]-a[0,0])
for name,t in tracks.items():
 id,edge=name.split('-');j=next(j for j in edit['joins'] if (j['pair'].startswith(id+'-') if edge=='tail' else j['pair'].endswith('-'+id)));assert len(t['frames'])==j['pre']+j['post'];q=np.array(t['uv']);assert np.isfinite(q).all() and (q>=0).all() and (q<=1).all();assert q[:,1].max()<.5,'target covers lower printed text'
 assert q[:,0].max()<.8,'target covers cost/right border'
 for k,f in enumerate(t['frames']):
  p=np.array(f['points']);assert p.shape==q.shape and np.isfinite(p).all()
  for tri in t['triangles']:assert area(p[tri])*area(q[tri])>0,(name,k,tri,'fold')
  for suffix in ['.jpg','-fg.png','-bg.jpg']:assert (R/'public/transitions/motion'/name/f'{k:03d}{suffix}').exists()
  alpha=cv2.imread(str(R/'public/transitions/motion'/name/f'{k:03d}-fg.png'),cv2.IMREAD_UNCHANGED)[:,:,3];assert (alpha>128).sum()>50,'empty matte'
 results.append({'handle':name,'frames':len(t['frames']),'controlPoints':len(q),'triangles':len(t['triangles']),'folds':0,'repair':t['repair']})
for id,v in ai.items():assert hashlib.sha256((R.parents[1]/v['source']).read_bytes()).hexdigest()==v['sourceSha256'],'original AI changed'
report={'passed':True,'handles':results,'sourceAIHashes':'all unchanged','shutterAngle':edit['shutterAngle'],'motionSamples':edit['motionSamples'],'scope':'All source-to-card meshes have consistent orientation, no empty masks; target stays inside illustration above text and left of costs. Native source files unchanged. Visual repair quality must be reviewed.'};(R/'记录/跟踪与融合核对.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('Tracked meshes verified:',len(results),'handles;',sum(r['frames'] for r in results),'frames')
