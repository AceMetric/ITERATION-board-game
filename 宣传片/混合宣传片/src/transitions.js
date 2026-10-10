import edit from './edit.json';
export const editConfig=edit;
export const transitionList=edit.joins.map(j=>({...j,anchor:j.subject==='ship'?'final':j.subject==='sky'?'ring':j.subject,frames:j.pre+j.post}));
export function transitionFor(a,b){if(!a)return null;return transitionList.find(j=>j.pair===a.id+'-'+b.id)??{pair:a.id+'-'+b.id,type:'paper',pre:12,post:21,frames:33,handleFrames:42,focus:[960,540],audioLead:.4,audioTail:.2};}
export const reelSegments=transitionList.map((j,i)=>({join:j,from:transitionList.slice(0,i).reduce((n,x)=>n+x.frames+30,0),frames:j.frames+30}));
export const REEL_FRAMES=reelSegments.reduce((n,s)=>n+s.frames,0);
export const FEATURE_PAIRS=['01-02','05-06','09-10'];
export const comparisonSegments=reelSegments.filter(s=>FEATURE_PAIRS.includes(s.join.pair)).map((s,i,a)=>({...s,from:a.slice(0,i).reduce((n,x)=>n+x.frames,0)}));
export const COMPARISON_FRAMES=comparisonSegments.reduce((n,s)=>n+s.frames,0);
export const smooth=(a,b,x)=>{const p=Math.max(0,Math.min(1,(x-a)/(b-a)));return p*p*p*(p*(p*6-15)+10)};
export function projectiveMatrix(quad,width=1920,height=1080){
 const A=[],b=[];[[0,0],[width,0],[width,height],[0,height]].forEach(([x,y],i)=>{const[u,v]=quad[i];A.push([x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]);b.push(u,v)});
 for(let i=0;i<8;i++){let pivot=i;for(let j=i+1;j<8;j++)if(Math.abs(A[j][i])>Math.abs(A[pivot][i]))pivot=j;[A[i],A[pivot]]=[A[pivot],A[i]];[b[i],b[pivot]]=[b[pivot],b[i]];const d=A[i][i];if(Math.abs(d)<1e-10)return'matrix(1,0,0,1,0,0)';for(let k=i;k<8;k++)A[i][k]/=d;b[i]/=d;for(let j=0;j<8;j++)if(j!==i){const m=A[j][i];for(let k=i;k<8;k++)A[j][k]-=m*A[i][k];b[j]-=m*b[i]}}
 const[h0,h1,h2,h3,h4,h5,h6,h7]=b;return`matrix3d(${[h0,h3,0,h6,h1,h4,0,h7,0,0,1,0,h2,h5,0,1].join(',')})`;
}

// Cubic timing with independently chosen horizontal handles for each camera.
// Vertical handles 0/1 make endpoint velocity zero; bisection is deterministic.
export function cameraProgress(join,p){const u=Math.max(0,Math.min(1,(p-join.camera[0])/(join.camera[1]-join.camera[0]))),[a,b]=join.cameraEase??[1/3,2/3];let lo=0,hi=1;for(let i=0;i<24;i++){const t=(lo+hi)/2,x=3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;if(x<u)lo=t;else hi=t}const t=(lo+hi)/2;return t*t*(3-2*t)}
