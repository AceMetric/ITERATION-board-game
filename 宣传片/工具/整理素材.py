"""Rebuild the asset inventory without modifying any source artwork."""
from pathlib import Path
from PIL import Image
import csv
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '宣传片'
GROUPS = {
    '文明起点': ['驯火与热加工', '农业与灌溉', '轮与车'],
    '知识积累与传播': ['文字与计数', '造纸与印刷', '远洋航海、测绘与指南针'],
    '工业与工程突破': ['蒸汽机', '铁路与蒸汽运输', '电力系统'],
    '现代科学与技术': ['航空', '电子计算机', '集成电路', '互联网'],
    '文明奇观': ['金字塔', '莫高窟', '苏伊士运河', '青藏铁路', 'FAST'],
    '未来愿景': ['宇宙航行', '脑机接口', '通用人工智能'],
}
PURPOSE = {
    '文明起点': '文明起步；工具、聚落与土地',
    '知识积累与传播': '经验转化为知识；传播与探索',
    '工业与工程突破': '工程尺度；人类劳动与技术突破',
    '现代科学与技术': '科学、技术与连接',
    '文明奇观': '世代协作的可见成果；各地点独立展示',
    '未来愿景': '游戏未来愿景；探索未知',
    '玩家代入': '直接展示桌游；资源、卡背或版图',
    '其他原图': '备选，不纳入首批生成参考',
}

def main():
    meta = json.loads((ROOT / 'web/src/card-assets.metadata.json').read_text())
    by_source = {a['source']: key for key, a in meta['assets'].items()}
    paths = sorted(p for directory in ['卡牌', '版图']
                   for p in (ROOT / directory).rglob('*')
                   if p.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp'})
    records = []
    for p in paths:
        relative = p.relative_to(ROOT).as_posix()
        name = p.stem
        group = next((g for g, names in GROUPS.items() if name in names), '其他原图')
        if '资源' in p.parts or name == '卡背' or p.parent.name == '版图':
            group = '玩家代入'
        match = re.search(r'时代(\d)', relative)
        era = '时代 ' + match.group(1) if match else ('最终科技' if '最终' in p.parts else '通用')
        with Image.open(p) as im:
            width, height = im.size
            mode = im.mode
        records.append({
            'id': by_source.get(relative, 'board' if group == '玩家代入' and p.parent.name == '版图' else ''),
            'name': name, 'era': era, 'source': relative,
            'width': width, 'height': height, 'mode': mode,
            'sha256': hashlib.sha256(p.read_bytes()).hexdigest(),
            'group': group, 'purpose': PURPOSE[group],
            'selected': group != '其他原图',
            'directUse': '完整原图可直接展示，保留比例、中文和数值',
            'supplement': '环境扩展/独立场景' if group not in ['其他原图', '玩家代入'] else '无；直接引用',
            'check': '来源与尺寸已核对；宣传仅采用标题与概括机制，不引用印刷数值',
        })
    (OUT / '策划/素材索引.json').write_text(json.dumps(records, ensure_ascii=False, indent=2))
    with (OUT / '策划/素材索引.csv').open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)
    selected = [r for r in records if r['selected']]
    text = ['# 首选原始素材', '', '原图原样引用，按游戏时代区分同名版本。宣传主题不替代游戏时代分期。', '',
            '| 名称 | 游戏时代 | 尺寸 | 主题与用途 | 原始文件 |', '| --- | --- | --- | --- | --- |']
    for r in selected:
        text.append(f"| {r['name']} | {r['era']} | {r['width']}×{r['height']} | {r['purpose']} | [{r['source']}](../../{r['source']}) |")
    text.extend(['', f'共索引 {len(records)} 份原始图片，首选 {len(selected)} 份（含同名奇观时代版本、资源面值和卡背）。',
                 '来源校验摘要见素材索引 JSON；生成图不会回写这些原图。'])
    (OUT / '策划/00-首选素材.md').write_text('\n'.join(text) + '\n')
    print(json.dumps({'originals': len(records), 'selected': len(selected)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
