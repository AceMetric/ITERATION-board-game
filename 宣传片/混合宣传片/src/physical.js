// Relative dimensions calibrated against the user's photograph, not inferred millimeter sizes.
export const PHYSICAL={cardWidth:1.78,boardSide:20,boardSurface:.034,tableSurface:-.09,playerMatSurface:.0325,playerMatWidth:18,playerMatDepth:3.4,playerMatX:-1,playerMatZ:13.5};
export const PHOTO_CALIBRATION={source:'文档/比例参照/用户实拍.jpg',referenceCard:'eiffel',referenceStripUV:[120/1400,410/1400,230/1400,580/1400],observedLongEdgeToSlotWidth:[.85,.95],method:'实拍中的卡牌长边接近竖向印刷栏的窄边，仅用于相对尺寸校准。该栏不是待建奇观牌位；区域归属另按完整版图核对。'};
// Normalized positions read from the original board, with its printed text upright.
export const BOARD_ZONES={
 wonder:{uv:[.834,.754],rotation:-Math.PI/4,label:'右下角 · 奇观'},
 shopDeck:{uv:[.209,.831],rotation:0,label:'左下角 · 商店牌堆'},
 eventDeck:{uv:[.250,.164],rotation:-Math.PI/4,label:'左上角 · 事件牌'},
 market:{bounds:[.295,.755,.71,.915],label:'下方长栏 · 商店公开区'},
 basic:{bounds:[.36,.085,.77,.242],label:'上方长栏 · 基础科技牌'},
 basicRight:{bounds:[.755,.242,.92,.65],label:'右侧长栏 · 基础科技牌'},
};
export const zonePosition=zone=>[(zone.uv[0]-.5)*PHYSICAL.boardSide,.064,(zone.uv[1]-.5)*PHYSICAL.boardSide];
export function surfaceAt(x,z){if(Math.abs(x)<=PHYSICAL.boardSide/2&&Math.abs(z)<=PHYSICAL.boardSide/2)return PHYSICAL.boardSurface;const inX=Math.abs(x-PHYSICAL.playerMatX)<=PHYSICAL.playerMatWidth/2;const inZ=Math.abs(Math.abs(z)-PHYSICAL.playerMatZ)<=PHYSICAL.playerMatDepth/2;return inX&&inZ?PHYSICAL.playerMatSurface:PHYSICAL.tableSurface}
export const CAMERAS={wide:{position:[0,25,27],target:[0,0,2]},dice:{position:[0,13.5,13],target:[0,0,0]}};
