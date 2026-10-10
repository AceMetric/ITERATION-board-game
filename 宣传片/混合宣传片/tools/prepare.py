from pathlib import Path
import json,shutil,hashlib
from PIL import Image
import numpy as np
R=Path(__file__).resolve().parents[1]; P=R.parents[1]
files={
'fire':('卡牌/科技/基础/时代1/驯火与热加工.png','basicBack'),
'stone':('卡牌/科技/基础/时代1/石器与复合工具.png','basicBack'),
'agri':('卡牌/科技/基础/时代1/农业与灌溉.png','basicBack'),
'wheel':('卡牌/科技/基础/时代1/轮与车.png','basicBack'),
'weave':('卡牌/科技/基础/时代1/纺织与编织.png','basicBack'),
'letters':('卡牌/科技/专利/时代1/文字与计数.png','patentBack'),
'pyramid':('卡牌/奇观/时代1/金字塔.jpg','wonderBack'),
'eiffel':('卡牌/奇观/时代4/埃菲尔铁塔.jpg','wonderBackIV'),
'wonderBackIV':('卡牌/奇观/时代4/卡背.png',None),
'final':('卡牌/科技/最终/宇宙航行.png','finalBack'),
'semiconductor':('卡牌/科技/专利/时代5/半导体物理.png','patentBackV'),
'ic':('卡牌/科技/专利/时代5/集成电路.png','patentBackV'),
'internet':('卡牌/科技/专利/时代5/互联网.png','patentBackV'),
'patentBackV':('卡牌/科技/专利/时代5/卡背.png',None),
'gold1':('卡牌/资源/金币1.png','resourceBack'),'gold2':('卡牌/资源/金币2.png','resourceBack'),
'min1':('卡牌/资源/矿物1.png','resourceBack'),'min2':('卡牌/资源/矿物2.png','resourceBack'),'min5':('卡牌/资源/矿物5.png','resourceBack'),
'people2':('卡牌/资源/人力2.png','resourceBack'),
'basicBack':('卡牌/科技/基础/时代1/卡背.png',None),'patentBack':('卡牌/科技/专利/时代1/卡背.png',None),
'wonderBack':('卡牌/奇观/时代1/卡背.png',None),'finalBack':('卡牌/科技/最终/卡背.png',None),
'resourceBack':('卡牌/资源/卡背.png',None),'eventBack':('卡牌/事件/卡背.png',None),'board':('版图/版图.png',None)}
for resource in ['金币','矿物','人力']:
 for value in [1,2,5,10]:
  key={'金币':'gold','矿物':'min','人力':'people'}[resource]+str(value);files[key]=('卡牌/资源/'+resource+str(value)+'.png','resourceBack')
# Every represented physical card has its own original face and matching back.
for key,name,folder,back in [
 ('pottery','陶器与窑烧.png','科技/基础/时代1','basicBack'),('science','实验科学方法.png','科技/基础/时代1','basicBack'),
 ('elements','四元素说.png','科技/专利/时代1','patentBack'),('astronomy','天文观测.png','科技/专利/时代1','patentBack'),
 ('bronze','青铜与铁器冶炼.png','科技/专利/时代1','patentBack'),('waterworks','大型水利工程.png','科技/专利/时代1','patentBack'),
 ('henge','巨石阵.jpg','奇观/时代1','wonderBack'),('terracotta','兵马俑.jpg','奇观/时代1','wonderBack'),
 ('gardens','空中花园.jpg','奇观/时代1','wonderBack'),('temple','悬空寺.jpg','奇观/时代1','wonderBack'),('mogao','莫高窟.jpg','奇观/时代1','wonderBack'),
 ('fast','FAST.png','奇观/时代5','wonderBackV'),('genome','人类基因组计划.png','奇观/时代5','wonderBackV'),('center','知春创新中心.png','奇观/时代5','wonderBackV'),
 ('wonderBackV','卡背.png','奇观/时代5',None),
 ('forbidden','紫禁城.jpg','奇观/时代4','wonderBackIV'),('suez','苏伊士运河.jpg','奇观/时代4','wonderBackIV'),
 ('eniac','ENIAC.png','奇观/时代4','wonderBackIV'),('daqing','大庆油田.png','奇观/时代4','wonderBackIV'),('rail','青藏铁路.png','奇观/时代4','wonderBackIV'),
 ('information','信息论.png','科技/专利/时代5','patentBackV'),('evolution','现代综合进化论与DNA.png','科技/专利/时代5','patentBackV'),
 ('diecasting','巨型一体化压铸技术.png','科技/专利/时代5','patentBackV'),('steady','稳态宇宙论.png','科技/专利/时代5','patentBackV'),
 ('addiction','成瘾性药物.jpg','科技/专利/时代5','patentBackV'),('bci','脑机接口.png','科技/最终','finalBack'),('agi','通用人工智能.png','科技/最终','finalBack')]:
 files[key]=('卡牌/'+folder+'/'+name,back)
for i,source in enumerate(sorted((P/'卡牌/事件').glob('*'))):
 if source.name=='卡背.png':continue
 files['event'+str(i)]=(str(source.relative_to(P)),'eventBack')
a={}
for key,(source,back) in files.items():
 src=P/source; dest=R/'public/textures'/f'{key}{src.suffix}';shutil.copy2(src,dest)
 im=Image.open(src).convert('RGBA'); arr=np.array(im); mask=(arr[:,:,3]>20)&(arr[:,:,:3].min(axis=2)<245)
 ys,xs=np.where(mask); rect=[int(xs.min()),int(ys.min()),int(xs.max()+1-xs.min()),int(ys.max()+1-ys.min())]
 # Independent bounds per original face. Full-color bleed is preserved; no redraw or resampling.
 if key=='board':rect=[0,0,im.width,im.height]
 a[key]={'file':'textures/'+dest.name,'source':source,'back':back,'size':[im.width,im.height],'rect':rect,'sha256':hashlib.sha256(src.read_bytes()).hexdigest()}
scenes=[('01','火光',6,'BG-01-火光.png'),('03','知识与远航',6,'BG-03-知识与远航.png'),('05','金字塔',6,'BG-04A-金字塔.png'),('07','蒸汽与工程',5,'BG-06-蒸汽与工程.png'),('08','FAST',10,'BG-08-FAST.png'),('10','星辰与未来',6,'BG-09-星辰与未来.png')]
for id,name,seconds,file in scenes:
 src=P/'宣传片/素材/正式场景'/file
 for dest in [R/'public/scenes'/file,R/'即梦素材包'/file]:shutil.copy2(src,dest)
 a['scene'+id]={'file':'scenes/'+file,'source':str(src.relative_to(P)),'sha256':hashlib.sha256(src.read_bytes()).hexdigest()}
(R/'src/assets.json').write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n')
if not (R/'src/ai.json').exists(): (R/'src/ai.json').write_text(json.dumps({id:{'status':'pending','file':None,'name':name,'seconds':sec}for id,name,sec,_ in scenes},ensure_ascii=False,indent=2)+'\n')
p=R/'package-lock.json';lock=json.loads(p.read_text());lock['name']='iteration-hybrid-film';lock['version']='1.0.0';lock['packages']['']['name']='iteration-hybrid-film';lock['packages']['']['version']='1.0.0';p.write_text(json.dumps(lock,indent=2)+'\n')
print('Copied original textures and six reference images, recorded individual bounds and source hashes.')
