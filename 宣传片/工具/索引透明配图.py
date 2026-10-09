"""Inventory supplied art without modifying any original."""
from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path(__file__).resolve().parents[2]

def main():
 rows=[]
 for p in sorted((ROOT/'卡牌设计').rglob('*.png')):
  with Image.open(p) as im:
   if 'A' not in im.getbands():continue
   alpha=im.getchannel('A');ext=alpha.getextrema()
   if ext[0]==255:continue
   raw=p.parent==ROOT/'卡牌设计/科技卡' and ext[0]==0
   rows.append({'path':str(p.relative_to(ROOT)),'name':p.stem,'width':im.width,'height':im.height,'mode':im.mode,'alpha':ext,'bbox':alpha.getbbox(),'type':'独立透明配图' if raw else '完整卡面或模板（含alpha不等于独立主体）','sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 out=ROOT/'宣传片/策划'
 (out/'透明配图索引.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
 raw=[r for r in rows if r['type']=='独立透明配图']
 (out/'独立透明配图.json').write_text(json.dumps(raw,ensure_ascii=False,indent=2)+'\n')
 print(f'{len(rows)} alpha PNGs; {len(raw)} standalone illustrations.')

if __name__=='__main__':main()
