"""Assemble the portable production manifest and browser data."""
from pathlib import Path
import json
import hashlib
import html
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'宣传片'

SCENES=[
 ('BG-01','火光',['01'],['驯火与热加工'],'火塘、石块、陶器、工具与少量人物；远处聚落，暖火照亮生活。左侧暗部留白。'),
 ('BG-02','土地',['02'],['农业与灌溉','轮与车'],'工具与灌溉为前景，农田、聚落、河流向远山展开；上方留白。'),
 ('BG-03','知识与远航',['03'],['文字与计数','造纸与印刷','远洋航海、测绘与指南针'],'临港工坊中纸张、书册与朴素印刷工具；远景港口、帆船、海平线。无可读地图文字。'),
 ('BG-04A','金字塔',['04'],['金字塔'],'金字塔与沙漠河谷；劳动者、材料和建造尺度；主体右侧、左侧天空留白。'),
 ('BG-04B','莫高窟',['04'],['莫高窟'],'独立崖壁与木构、画师工匠行旅；壁画只作为画面内文化细节，左侧道路留白。'),
 ('BG-06','蒸汽与工程',['06'],['蒸汽机','铁路与蒸汽运输'],'蒸汽机中左、工人与砖石工厂、铁路纵深；右上留白。'),
 ('BG-07','科学与连接',['07'],['电子计算机','集成电路','互联网'],'工作桌与研究者，芯片保持桌面器件尺度；远景城市通信空间，左上留白。'),
 ('BG-08','FAST',['08'],['FAST'],'群山中的巨型反射面与小人物；工程在下半部，深蓝天空在上部。'),
 ('BG-09','星辰与未来',['09'],['宇宙航行'],'下方地球弧面、中右飞船、深空，金色航迹；三层可分离，左侧留白。'),
]
LINES=[
 ('01','火光',['从一簇火光，','到文明的曙光。'],'创造 · 文明的起点','BG-01','fire',['T1-01'],'left'),
 ('02','土地',['创造，让生活','有了新的可能。'],'劳动 · 积累 · 共同生活','BG-02','atmosphere',['T1-03'],'left'),
 ('03','知识与远航',['每一次创造，','都站在前人的肩上。'],'知识 · 传承 · 探索','BG-03','atmosphere',['T2-07','T2-01'],'left'),
 ('04','文明奇观',['汇聚众人的力量，','筑起时代的奇观。'],'共同创造 · 文明的成就','BG-04A','atmosphere',['W01-1'],'left'),
 ('05','成为建设者',['配置资源，','选择文明的方向。'],'金币 · 人力 · 矿物',None,'cards',['R0-1','R1-1','R2-1','T1-01'],'left'),
 ('06','蒸汽与工程',['每一次突破，','都让文明向前。'],'工程 · 科技 · 更迭','BG-06','atmosphere',['T3-06'],'right'),
 ('07','科学与连接',['让知识相连，','让时代更迭。'],'科学 · 技术 · 连接','BG-07','network',['T4-12','T5-03','T5-05'],'left'),
 ('08','望向宇宙',['把目光，','投向更远的未知。'],'文明的共同创造 · FAST','BG-08','atmosphere',['W14-5'],'left'),
 ('09','星辰与未来',['文明的下一章，','由你参与。'],'最终科技 · 游戏中的未来愿景','BG-09','stars',['T5-08'],'left'),
 ('10','更迭',['更迭','ITERATION'],'科技史实体策略桌游',None,'cards',['T1-01','W05-1','T5-08'],'left'),
]
REQUIRED=['board','T1-01','T1-03','T1-06','T2-07','T2-01','T3-06','T4-12','T5-03','T5-05','T5-08','W01-1','W05-1','W14-5','R0-1','R1-1','R2-1','back-resource','back-tech-1','back-wonder-1']
CUTOUTS=[('驯火与热加工','01'),('农业与灌溉','02'),('轮与车','02'),('文字与计数','03'),('造纸与印刷','03'),('远洋航海、测绘与指南针','03'),('蒸汽机','06'),('铁路与蒸汽运输','06'),('电力系统','06'),('电子计算机','07'),('集成电路','07'),('互联网','07'),('星际航行','09')]

def main():
 for directory in ['程序','素材/文字','素材/组件构图','素材/效果','素材/正式场景','素材/声音','素材/图层/BG-09','记录','效果稿']:(OUT/directory).mkdir(parents=True,exist_ok=True)
 originals=json.loads((OUT/'策划/素材索引.json').read_text())
 sources={r['id']:r for r in originals if r['id']}
 # There are multiple types of technology backs in the originals. Select the era-I basic back explicitly.
 source_paths={
  'back-resource':'卡牌/资源/卡背.png',
  'back-tech-1':'卡牌/科技/基础/时代1/卡背.png',
  'back-wonder-1':'卡牌/奇观/时代1/卡背.png'}
 for key,path in source_paths.items():sources[key]=next(r for r in originals if r['source']==path)
 records=[]
 for key in REQUIRED:
  r=sources[key];records.append({'id':key,'kind':'original','name':r['name'],'path':r['source'],'era':r['era'],'width':r['width'],'height':r['height'],'sha256':r['sha256'],'status':'原图直接引用'})
 raw_file=OUT/'策划/独立透明配图.json'
 raw_index=json.loads(raw_file.read_text()) if raw_file.exists() else []
 for i,(name,shot) in enumerate(CUTOUTS,1):
  r=next((a for a in raw_index if a['name']==name),None)
  if r:records.append({**r,'id':f'ART-{i:02d}','kind':'cutout','shots':[shot],'status':'已制作；原始透明配图直接引用','description':'原始独立插画，保留alpha；完整卡面另行引用。'+('文件名为星际航行，对应成品卡宇宙航行；画内地球、飞船和星空仍是一个整体。' if name=='星际航行' else '')})
 tasks_file=OUT/'记录/正式场景生成任务.json'
 tasks=json.loads(tasks_file.read_text()) if tasks_file.exists() else []
 for id,name,shots,refs,description in SCENES:
  path=f'宣传片/素材/正式场景/{id}-{name}.png'
  record={'id':id,'kind':'scene','name':name,'shots':shots,'refs':refs,'description':description,'path':path,'status':'待生成'}
  task=next((t for t in reversed(tasks) if t['id']==id and t['output']==path),None)
  if task:record.update(refPaths=task['refs'],version=task.get('version',1))
  if (ROOT/path).exists():
   with Image.open(ROOT/path) as im:record.update(width=im.width,height=im.height)
   ready=record['width']>=1920 and record['height']>=1080
   record.update(resolutionPassed=ready,status='已制作；构图已检查' if ready else '已制作；构图已检查，原生分辨率低于1080p',sha256=hashlib.sha256((ROOT/path).read_bytes()).hexdigest())
  records.append(record)
 for part,name in [('BG','深空补底'),('EARTH','透明地球'),('SHIP','透明飞船')]:
  path=f'宣传片/素材/图层/BG-09/L-09-{part}.png'
  r={'id':f'L-09-{part}','kind':'layer','name':name,'shots':['09'],'path':path,'status':'待制作'}
  if (ROOT/path).exists():
   with Image.open(ROOT/path) as im:r.update(width=im.width,height=im.height)
   r.update(status='已制作，待拼合检查')
  records.append(r)
 scene_by_id={r['id']:r for r in records if r['kind']=='scene'}
 exploration={'BG-04A':'素材/主图/S05-文明的共同创造.png','BG-06':'素材/主图/S03-蒸汽与工程.png','BG-09':'素材/主图/S06-星辰与未来.png'}
 shots=[]
 for id,name,lines,footer,bg,effect,cards,side in LINES:
  path=None
  if bg:
   entry=scene_by_id[bg]
   if (ROOT/entry['path']).exists():path=entry['path'].removeprefix('宣传片/')
   elif bg in exploration:path=exploration[bg]
  shot={'id':id,'name':name,'lines':lines,'footer':footer,'scene':bg,'scenePath':path,'effect':effect,'cards':['../'+sources[c]['source'] for c in cards],'textSide':side,'board':'../版图/版图.png','status':('场景构图选定' if scene_by_id[bg].get('resolutionPassed') else '构图选定；分辨率待达标') if bg and scene_by_id[bg]['status'].startswith('已制作') else ('原图组件构图' if not bg else '探索稿' if path else '场景待制作')}
  shot['cutouts']=['../'+r['path'] for r in records if r['kind']=='cutout' and id in r['shots']]
  if id in ['05','10']:shot['backs']=['../'+source_paths[k] for k in ['back-resource','back-tech-1','back-wonder-1']]
  shots.append(shot)
  records.append({'id':'TXT-'+id,'kind':'text','name':''.join(lines),'shots':[id],'path':f'宣传片/素材/文字/TXT-{id}.png','source':'宣传片/程序/目录.js','status':'已制作' if (OUT/f'素材/文字/TXT-{id}.png').exists() else '待导出'})
  x=1040 if side=='right' else 116
  title_y=240 if id=='10' else 270
  size=118 if id=='10' else 74
  leading=150 if id=='10' else 108
  texts=[f'<text x="{x}" y="100" font-size="27" fill="#e9be72">更迭 / ITERATION</text>',f'<rect x="{x}" y="220" width="76" height="3" fill="#e9be72"/>']
  for i,line in enumerate(lines):texts.append(f'<text x="{x}" y="{title_y+i*leading}" font-size="{size}" font-weight="700" fill="{"#e9be72" if i==len(lines)-1 else "#f5edd9"}">{html.escape(line)}</text>')
  texts.append(f'<text x="{x}" y="945" font-size="25" fill="#f5edd9">{html.escape(footer)}</text>')
  if id=='10':texts.append(f'<text x="{x}" y="997" font-size="21" fill="#bcc6d5">测试版</text>')
  svg='<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><style>@font-face{font-family:SourceHan;src:url(../字体/SourceHanSansCN-Regular.otf)}@font-face{font-family:SourceHan;src:url(../字体/SourceHanSansCN-Bold.otf);font-weight:700}text{font-family:SourceHan,"Source Han Sans CN",sans-serif;dominant-baseline:text-before-edge;letter-spacing:2px}</style>'+''.join(texts)+'</svg>\n'
  (OUT/f'素材/文字/TXT-{id}.svg').write_text(svg)
 for kind,name in [('fire','火光与火星'),('atmosphere','光照与空间气氛'),('cards','卡牌与资源运动'),('network','信息连接'),('stars','星辰与航迹')]:
  records.append({'id':'FX-'+kind,'kind':'effect','name':name,'path':f'宣传片/素材/效果/FX-{kind}.png','source':'宣传片/程序/效果.js','status':'程序已制作；待导出示例' if not (OUT/f'素材/效果/FX-{kind}.png').exists() else '已制作'})
 audio=[('M01','原创电子管弦配乐'),('A01','火声'),('A02','田野与流水'),('A03','纸页'),('A04','建造'),('A05','卡牌'),('A06','蒸汽与金属'),('A07','电子脉冲'),('A08','群山风声'),('A09','深空氛围')]
 for id,name in audio:
  path=f'宣传片/素材/声音/{id}-{name}.wav'
  records.append({'id':id,'kind':'audio','name':name,'path':path,'status':'已制作' if (ROOT/path).exists() else '待制作'})
 for r in records:
  r.setdefault('version',1)
  if r['kind']=='original':
   r['shots']=[s['id'] for s in shots if '../'+r['path'] in s['cards'] or r['id']=='board' and s['id'] in ['05','10'] or r['id'].startswith('back-') and s['id'] in ['05','10']]
   if not r['shots']:r['shots']=['02' if r['id']=='T1-06' else '09']
  elif r['kind']=='effect':
   r['shots']=[s['id'] for s in shots if s['effect']==r['id'].removeprefix('FX-')]
  elif r['kind']=='audio':r['shots']=[str(int(r['id'][1:])).zfill(2)] if r['id'].startswith('A') else [s['id'] for s in shots]
  p=ROOT/r['path']
  if p.exists() and p.suffix=='.png':
   with Image.open(p) as im:r.update(width=im.width,height=im.height,mode=im.mode)
  if p.exists():r.setdefault('sha256',hashlib.sha256(p.read_bytes()).hexdigest())
 data={'version':1,'canvas':[1920,1080],'seed':20261009,'shots':shots,'assets':records,'sources':originals,'notes':['生成场景的原生尺寸单独记录；1080p排版导出不等于原生1080p插画。','三张早期探索稿保留在素材/主图，正式场景另存。']}
 (OUT/'素材/素材清单.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 (OUT/'程序/目录.js').write_text('window.PROMO_PACK='+json.dumps(data,ensure_ascii=False).replace('</','<\\/')+';\n')
 rows=['# 最终素材清单','','九幅场景、三层星辰、20 份原始组件、13 份新增可用的原始透明配图、十组文字、五类程序效果、一首配乐与九类音效。状态由实际文件更新。','','生成图的原生尺寸见 JSON 索引。低于 1920×1080 的场景仍明确标为分辨率待达标；1920×1080 的静帧排版不会改变这一验收结论。','','| 编号 | 名称 | 分类 | 状态 | 文件 |','| --- | --- | --- | --- | --- |']
 for r in records:rows.append(f"| {r['id']} | {r['name']} | {r['kind']} | {r['status']} | [{Path(r['path']).name}](../../{r['path']}) |")
 (OUT/'策划/05-最终素材清单.md').write_text('\n'.join(rows)+'\n')
 print(f'Assets: {len(records)}; shots: {len(shots)}; originals: {len(REQUIRED)}')

if __name__=='__main__':main()
