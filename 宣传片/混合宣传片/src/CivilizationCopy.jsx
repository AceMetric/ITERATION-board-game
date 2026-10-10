import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ease,clamp} from './story.js';
export const civilizationCopy={
 '01':{chapter:'文明的曙光',lines:['烈火撕开黑夜的帷幕，','照亮前路永恒的探索'],side:'left'},
 '03':{chapter:'知识的远航',lines:['让记忆超越生死的界限，','让思想驶向未至之境'],side:'left'},
 '05':{chapter:'时间的丰碑',lines:['几代人的双手，','筑起人类绵延千年的高峰'],side:'left'},
 '07':{chapter:'时代的脉搏',lines:['唤醒沉睡亿年的能量，','推动时代奔涌向前'],side:'right'},
 '08':{chapter:'挑战未知',lines:['用群山托起群星的梦想，','向未知发起永无止境的冲锋'],side:'left'},
 '10':{chapter:'文明的远方',lines:['自大地升起的星星之火，','必将照亮星海的征途'],side:'left'},
};
// Original editorial text, deliberately separate from the generated video and card print.
export function CivilizationCopy({shot,local,opacity=1}){
 const copy=civilizationCopy[shot.id];if(!copy)return null;
 const enter=ease(clamp((local-18)/19)),leave=1-ease(clamp((local-(shot.frames-36))/18)),a=enter*leave*opacity,right=copy.side==='right';
 return <AbsoluteFill style={{pointerEvents:'none',fontFamily:'SourceHan',opacity:a}}>
  <AbsoluteFill style={{background:`linear-gradient(${right?'270':'90'}deg,rgba(3,13,25,.77),rgba(3,13,25,.28) 45%,transparent 76%),linear-gradient(0deg,rgba(3,13,25,.4),transparent 55%)`}}/>
  <div style={{position:'absolute',left:right?'auto':122,right:right?122:'auto',bottom:145,width:1160,textAlign:right?'right':'left',transform:`translateY(${(1-enter)*13}px)`}}>
   <div style={{display:'flex',alignItems:'center',justifyContent:right?'flex-end':'flex-start',gap:20,marginBottom:26,color:'#e6c98e'}}><span style={{width:58,height:1,background:'#e6c98e',opacity:.85}}/><span style={{fontSize:24,letterSpacing:7}}>{copy.chapter}</span></div>
   {copy.lines.map((line,i)=><div key={line} style={{fontSize:52,fontWeight:400,lineHeight:1.6,letterSpacing:2,color:i?'#f5e4be':'#fff5de',textShadow:'0 3px 17px rgba(0,0,0,.85)',opacity:i?ease(clamp((local-24)/19)):1}}>{line}</div>)}
  </div>
 </AbsoluteFill>
}
