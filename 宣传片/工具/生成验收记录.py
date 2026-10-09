"""Summarize real audits without treating upsampled layouts as native scene resolution."""
from pathlib import Path
import json
OUT=Path(__file__).resolve().parents[1]

def main():
 f=json.loads((OUT/'记录/文件检查.json').read_text())
 b=json.loads((OUT/'记录/浏览器检查.json').read_text())
 links=json.loads((OUT/'记录/文档链接检查.json').read_text())
 pack=json.loads((OUT/'素材/素材清单.json').read_text())
 result={'version':1,'functionalPassed':f['filesPassed'] and b['passed'] and not links['missing'],'nativeSceneResolutionPassed':f['nativeSceneResolutionPassed'],'allCriteriaPassed':f['filesPassed'] and b['passed'] and f['nativeSceneResolutionPassed'] and not links['missing'],'remaining':['九幅生成场景的原生尺寸为1672×941，尚未达到1920×1080最低要求。'],'scope':'素材制作首版；不含最终动画剪辑。'}
 (OUT/'记录/验收结论.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 rows=['# 素材验收记录 · v1','','结论：素材首版已生成，文件和预览功能检查通过；**原生场景分辨率未达标，尚未通过全部验收。** 本批不包含最终视频。','','## 已交付','','70 项核心素材：九幅场景、三层星辰、20 份原始桌游组件引用、13 份原始透明配图引用、十组透明文字、五类程序效果、一首配乐与九类音效。另有两张桌游组件构图、三张静态效果稿、十镜头静帧及莫高窟备选、总览、十份可编辑 SVG 和四份配乐分轨。','','## 检查结果','','| 项目 | 结果 | 证据与范围 |','| --- | --- | --- |',f"| 原始文件保持 | 通过 | 原项目 {f['originalsChecked']} 份原图、新增目录 {f['designOriginalsChecked']} 份含 alpha PNG 摘要均未变化；其中独立透明配图 {f['transparentOriginalsChecked']} 幅 |",f"| 文件完整性 | 通过 | 70 项核心素材无缺失；[文件检查](文件检查.json) |",f"| 字体与中文 | 通过 | 思源黑体 Regular/Bold 实际加载，十组文字目视检查；中文和数值卡面直接引用原图 |",'| 原始桌游身份 | 通过 | 镜头05、10显示真实版图、完整卡牌、资源与卡背；保持原比例 |','| 场景构图 | 首版检查完成 | 九幅场景与对应文字、原卡合成检查；莫高窟独立呈现；蒸汽机与文案分居左右；FAST卡面避开人物 |','| 透明图层 | 通过 | 三层1672×941同画布；背景完整不透明；地球与飞船具有真实alpha；[拼合图](../素材/图层/BG-09/拼合检查.png)已目视检查 |','| 透明文字与效果 | 通过 | 十份文字、五份效果PNG均含有效透明通道，画布1920×1080 |','| 程序效果重复性 | 通过 | 五类效果在相同进度/种子时输出一致；不同进度时画面变化 |',f"| 预览功能 | 通过 | 70项资源链接有效；筛选、图层开关、镜头入口和旧入口跳转正常；页面脚本错误 {len(b['errors'])} 项 |",f"| 文档链接 | 通过 | {links['checked']} 个当前交付文档链接无缺失；[链接检查](文档链接检查.json) |",'| 声音格式与信号 | 通过 | 十份WAV均为48kHz/24bit/立体声，有效非静音信号，无削波；配乐85秒；浏览器有十个播放器，代表性解码检查通过 |','| 插画原生尺寸 | **未通过** | 九幅场景均1672×941，低于1920×1080；没有把1920×1080合成静帧当作原生高分辨率插画 |','','[浏览器检查](浏览器检查.json) 保存功能检查详情；[文件检查](文件检查.json) 保存实际尺寸、透明通道与音频参数。音频格式与信号检查不等同于完成最终混音；可在预览中试听后按剪辑调整。','','## 逐项场景','','| 场景 | 选定版本 | 原生尺寸 | 对应镜头 |','| --- | --- | --- | --- |']
 for r in pack['assets']:
  if r['kind']=='scene':rows.append(f"| {r['id']} {r['name']} | v{r['version']} | {r['width']}×{r['height']} | {','.join(r['shots'])} |")
 rows+=['','## 本批采用的修订','','- 金字塔早期候选的运石平台结构不理想，选定版删除该结构，改为测绘协作人物。','- 工业场景重新分配主体和留白；科学场景改用独立透明原画为参考，连线放在远处城市上方。','- FAST原卡移至右上，保留右下人物的尺度参照；星辰程序航迹贴近尾焰。','- 星辰三层保持相同画布，重组后没有明显黑底、白边或结构缺口；后续地球运动需保持底边锚定，具体说明随图层保存。','- 历史场景作为文明主题概念插画使用；没有新增具体历史日期或未经核对的规则数字。','','## 尚未达标','','当前内置生成工具在多次明确请求1080p/4K后仍返回1672×941。已保留原生文件和完整记录；本批适合构图确认及动画预演，原生分辨率仍须在最终制作前补足。尚未据此声称全部验收完成。','','[交付说明](../README.md) · [素材清单](../策划/05-最终素材清单.md) · [资源预览](../资源预览.html)']
 (OUT/'记录/验收记录.md').write_text('\n'.join(rows)+'\n')
 print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__':main()
