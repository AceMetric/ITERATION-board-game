export const SETTINGS = {
  version: 1, width:1920, height:1080, fps:30, duration:18, seed:20261009,
  segments:[{id:'fire',name:'火光照亮文明',start:0,duration:6},{id:'choice',name:'文明成就成为玩家选择',start:6,duration:6},{id:'space',name:'飞向文明的下一章',start:12,duration:6}],
  camera:{distance:1500,near:1,far:6000},
  fire:{people:{x:1180,y:565,width:1480},near:{x:960,y:540,width:1920},source:{x:1280,y:825},flame:{width:255,height:338},cameraStart:{x:48,y:-28,z:1415},cameraEnd:{x:-18,y:10,z:1530}},
  choice:{reveal:[.8,2.5],land:[2.5,4.1],resources:[3.2,4.7],cardEnd:{x:1330,y:546,height:620}},
  space:{engineUV:[.617,.495],shipTravel:[-100,55],shipRise:[-25,35]},
  text:{color:'#f5edd9',gold:'#e9be72',font:'SourceHan',size:70},
  audio:{musicStart:48,duration:18,events:[{file:'A01-火声.wav',at:0,duration:6,gain:.36},{file:'A04-建造.wav',at:6.3,duration:1.5,gain:.3},{file:'A05-卡牌.wav',at:10.0,duration:.488,gain:.85},{file:'A05-卡牌.wav',at:9.90,duration:.488,gain:.7},{file:'A05-卡牌.wav',at:10.25,duration:.488,gain:.65},{file:'A05-卡牌.wav',at:10.6,duration:.488,gain:.65},{file:'A09-深空氛围.wav',at:12,duration:6,gain:.6},{file:'A07-电子脉冲.wav',at:13.2,duration:2.5,gain:.18}]}
};
