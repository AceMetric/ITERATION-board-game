// Legacy revision 2 masks, retained for comparison only. Revision 3 uses tracking.json and Bridge.jsx.
// Rotoscope outlines are measured on the user's actual selected 1920x1080 conformed clips.
// Coordinates describe the isolated subject, never the rectangular video frame.
export const subjects={
 fire:{name:'火焰',bbox:[1020,490,400,530],path:'M1205 535 L1253 596 L1220 665 L1247 694 L1280 620 L1305 665 L1279 707 L1308 753 L1288 775 L1328 815 L1310 836 L1380 934 L1322 967 L1290 967 L1260 1000 L1200 994 L1160 1005 L1106 967 L1077 940 L1091 894 L1083 855 L1110 835 L1129 788 L1153 776 L1143 731 L1085 705 L1070 650 L1107 610 L1114 575 L1138 652 L1162 675 L1182 590 Z',uv:[.31,.14,.76,.45],bend:[-35,-35],feather:8},
 letters:{name:'书写纸页',bbox:[1445,550,425,425],path:'M1553 553 L1863 596 L1757 968 L1449 906 Z',uv:[.55,.24,.79,.48],bend:[-75,-100]},
 pyramid:{name:'金字塔主体',bbox:[900,140,1020,610],path:'M1421 181 L1904 715 L1850 731 L968 730 Z',uv:[.25,.19,.78,.44],bend:[-30,-25]},
 final:{name:'飞船及尾焰',bbox:[900,330,900,310],path:'M1723 388 Q1670 364 1606 361 L1542 367 L1480 379 L1416 398 L1260 395 L1304 428 L1262 440 L1170 466 L1124 479 L1164 488 L1201 481 L1234 488 L1207 520 L930 602 L1090 572 L1236 542 L1250 579 L1333 552 L1374 541 L1455 508 L1524 466 L1626 423 Z',uv:[.20,.255,.75,.34],bend:[-30,-30],feather:2},
 ring:{name:'FAST 上空星光',bbox:[1100,35,650,350],path:'M1140 155 Q1200 35 1440 42 Q1690 30 1740 190 Q1710 350 1490 380 Q1180 350 1110 230 Z',uv:[.27,.16,.73,.26],bend:[-75,-65]},
};
export function trackedSubject(key,edge,p){const s={...subjects[key]};
 // Keyframed silhouettes follow the camera drift in the selected moving handles.
 if(key==='pyramid'&&edge==='head'){const q=p;s.path=`M1421 ${156+6*q} L1913 ${687+9*q} L1850 ${707+8*q} L${935+7*q} ${704+9*q} Z`;}
 if(key==='final'){const dx=edge==='head'?10*p:40+5*p,dy=edge==='head'?-4*p:-17-3*p;s.transform=`translate(${dx} ${dy})`;}
 return s;
}
export function subjectMask(subject,inverse=false,full=false){const[x,y,w,h]=inverse||full?[0,0,1920,1080]:subject.bbox;
 const shape=`<path d="${subject.path}" transform="${subject.transform||''}" fill="${inverse?'black':'white'}" stroke="${inverse?'black':'white'}" stroke-width="${subject.strokeWidth||0}" stroke-linejoin="round" filter="url(#f)"/>`,feather=subject.feather??(subject.name.includes('星光')?18:1.4);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><defs><filter id="f" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${feather}"/></filter>${inverse?`<mask id="m"><rect width="1920" height="1080" fill="white"/>${shape}</mask>`:''}</defs>${inverse?'<rect width="1920" height="1080" fill="white" mask="url(#m)"/>':shape}</svg>`;return`url("data:image/svg+xml,${encodeURIComponent(svg)}")`}
