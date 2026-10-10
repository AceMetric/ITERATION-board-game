export const FPS=30;
export const shots=[
 {id:'00',kind:'intro',name:'片头 · 更迭',seconds:4},
 {id:'01',kind:'ai',name:'火光',seconds:6,reference:'BG-01-火光.png'},
 {id:'02',kind:'purchase',name:'用资源学习科技',seconds:12,title:'配置资源，学习科技。',era:'时代 Ⅰ · 玩家 A 的回合'},
 {id:'03',kind:'ai',name:'知识与远航',seconds:6,reference:'BG-03-知识与远航.png'},
 {id:'04',kind:'patent',name:'专利带来回报',seconds:9,title:'掌握专利，把握回报。',era:'时代 Ⅰ · 已拥有的专利'},
 {id:'05',kind:'ai',name:'共同创造奇观',seconds:6,reference:'BG-04A-金字塔.png'},
 {id:'06',kind:'wonder',name:'争取奇观',seconds:11,title:'投入资源，竞逐奇观。',era:'时代 Ⅰ · 不同回合的投入'},
 {id:'07',kind:'ai',name:'工业突破',seconds:5,reference:'BG-06-蒸汽与工程.png'},
 {id:'08',kind:'ai',name:'望向未知 · FAST',seconds:10,reference:'BG-08-FAST.png'},
 {id:'09',kind:'final',name:'挑战最终科技',seconds:10,title:'投入科研，挑战未来。',era:'时代 Ⅴ · 成功示例'},
 {id:'10',kind:'ai',name:'星辰与未来',seconds:6,reference:'BG-09-星辰与未来.png'},
 {id:'11',kind:'product',name:'更迭',seconds:5,title:'更迭 ITERATION',era:'科技史实体策略桌游'},
].map((s,i,a)=>({...s,start:a.slice(0,i).reduce((n,x)=>n+x.seconds,0)*FPS,frames:s.seconds*FPS}));
export const TOTAL=shots.reduce((n,s)=>n+s.frames,0);
export const clamp=x=>Math.max(0,Math.min(1,x));
export const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
export const ramp=(a,b,t)=>ease((t-a)/(b-a));
export const lerp=(a,b,p)=>a+(b-a)*p;
export const vecLerp=(a,b,p)=>a.map((x,i)=>lerp(x,b[i],p));
export const diceFaces={1:[0,0,1],6:[0,0,-1],2:[0,1,0],5:[0,-1,0],3:[1,0,0],4:[-1,0,0]};
export const examples={
 purchase:{market:['fire','stone','agri','wheel'],cost:{gold:2,mineral:3},paid:[['gold',2],['mineral',2],['mineral',1]],destination:'publicBasic',owner:'A',research:[0,3],refill:'weave'},
 patent:{owner:'A',card:'letters',dice:[6,3],trigger:6,income:{gold:1},retained:true},
 wonder:{owner:'A',cost:{gold:4,mineral:6,people:6},A:{before:{gold:4,mineral:6,people:4},add:{people:2}},B:{cards:[['mineral',2],['gold',2]],hidden:'gold2',returned:2},pyramidStarts:'next-own-turn'},
 final:{era:5,research:[100,70],dice:[1,4,1,6,1],discount:0,costPerDie:6,winningFaces:[1,2,3],needed:3,scripted:true},
};
export function stateAt(kind,t){
 if(kind==='purchase')return {stage:t<2?'选择驯火与热加工':t<6.3?'支付 2 金币 + 3 矿物':t<9?'公共基础区 · 首次学习':'补入纺织与编织',research:t<8?0:3,market:t<6.3?4:t<10.2?3:4,paid:t<4?0:t<4.9?1:t<5.8?2:3,learned:t>=8,techLocation:t<6.3?'market':t<7.6?'moving':'publicBasic'};
 if(kind==='patent')return {stage:t<2.7?'文字与计数 · 已属于玩家 A':t<5.1?'两枚骰子分别读取':t<6.1?'6 点 → 触发专利':'获得 1 金币',dice:t>=5.1?[6,3]:null,income:t>=7.5?1:0,retained:true};
 if(kind==='wonder')return {stage:t<2.8?'此前投入 · 按玩家分别计算':t<4.7?'B 回合 · 暗置一张资源':t<6.5?'A 回合 · 再投入 2 人力':t<7.5?'宣布取得 · 翻开暗置牌':'A 取得金字塔 · B 取回两张',A:{gold:4,mineral:6,people:t<6.2?4:6},B:{mineral:2,gold:t<3.8?0:t<7.3?'?':2},reveal:t>=7.3,owner:t>=9?'A':null,settled:t>=10.2};
 if(kind==='final')return {stage:t<2.7?'宇宙航行 · 选择 5 枚骰子':t<4?'无适用折扣 · 支付 30 科研点':t<6.4?'掷骰挑战':t<7.5?'三个 1 · 挑战成功':'取得宇宙航行 · 立即获胜',research:t>=3.4?70:100,dice:t>=6.4?[1,4,1,6,1]:null,success:t>=6.4,won:t>=8.8};
 return {stage:'文明的下一章，由你开创'};
}
