"""Keep legacy entry points valid; the editable preview lives in 资源预览.html."""
from pathlib import Path
import html
from urllib.parse import quote
from 准备资源 import main as prepare

OUT=Path(__file__).resolve().parents[1]

def main():
    prepare()
    for filename,target in [('预览.html','资源预览.html'),('图层预览.html','资源预览.html?tab=layers')]:
        escaped=html.escape(quote(target,safe='/?='))
        (OUT/filename).write_text(f'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>更迭素材预览</title><meta http-equiv="refresh" content="0;url={escaped}"><a href="{escaped}">打开当前素材预览</a></html>\n')
    for name,shot in [('01-古代创造与奇观','04'),('02-工业工程与现代科学','06'),('03-星辰与桌游','09')]:
        image=quote(name+'.png')
        (OUT/'效果稿'/f'{name}.html').write_text(f'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>{name}</title><style>body{{margin:0;background:#101d2d;color:#f5edd9;font-family:sans-serif}}img{{display:block;width:100%;height:auto}}a{{display:block;padding:18px;color:#e9be72}}</style><img src="{image}" alt="{name}"><a href="../资源预览.html?shot={shot}">打开可编辑预览</a></html>\n')
    print('Canonical preview and legacy entry points refreshed.')

if __name__=='__main__':main()
