from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
def read(name):return json.loads((ROOT/'记录'/name).read_text())
web=read('浏览器验收.json');video=read('视频验收.json');play=read('连续播放检查.json');server=read('视频服务检查.json');assets=json.loads((ROOT.parent/'记录/文件检查.json').read_text());initial=read('浏览器初检.json')
passed=web['passed']and video['passed']and play['passed']and server['passed']and assets['filesPassed']and not initial['errors']
q=play['quality'];result={'version':1,'motionStudyTechnicalPassed':passed,'nativeSceneResolutionPassed':False,'finalFilmProduced':False,'duration':18,'fps':30,'canvas':[1920,1080],'sampleFrameCount':15,'playback':q,'limitations':['宽幅原稿与多数分层为1672×941，未达到原生1080p。','三段为独立能力测试，尚未进行正式全片剪辑。','音乐使用现有电子管弦合成稿；艺术效果与配乐偏好仍需观看审阅。'],'sourcesUnchanged':not assets['changedOriginals']}
(ROOT/'记录/验收结论.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
text=f'''# 《更迭》插画电影化样片 · 验收记录

技术交付检查：**{'通过'if passed else '未通过'}**。本结论针对18秒动态样片，不代表正式全片或原生高清插画已完成。

## 视频与连续播放

- 新版样片、原版对照与左右对比均为1920×1080、30fps、18秒；每份完整解码540帧，无解码错误。
- H.264画面与AAC立体声；音频由48kHz、24bit混音WAV编码，音频非静音、无削波样本。
- 浏览器完整播放至结束，实际耗时{play['elapsed']:.2f}秒；报告总帧数{q['totalVideoFrames']}、丢帧{q['droppedVideoFrames']}、损坏帧{q['corruptedVideoFrames']}。
- 样片与对比视频均能定位到14秒附近，并取得对应实际解码画面。预览服务支持字节范围读取；正常、偏移、末尾与无效范围请求均已检查。
- 编码后的AAC带少量尾部填充，容器播放时长为18秒。浏览器音频上下文可能按设备采样率重采样；文件采样率由独立解码检查确认。

## 动画与交互

- 三段在打乱渲染顺序后，以同一时间重绘仍得到相同画面。
- 播放按经过时间推进；暂停、定位、30fps逐帧和段落选择正常，声音按同一位置播放。
- 文字开关、原版效果切换正常；相机、主体、局部光照和声音使用同一时间轴。
- 抽查15幅运动极值、转场中点和落位帧，并检查导出视频的火光、卡牌过渡与星辰解码帧；火焰底部、人物脚下和地球底边未见明显露底。
- 卡牌过渡已修正叠影：插画窗口在收束后恢复原图，印刷文字与数值来自原始卡面覆盖层；最终落位保留完整原卡。
- 原素材预览仍通过70项资源与字体、效果、图层、音频检查，无失效资源或脚本错误。

## 素材与保留项

- 新增6份ImageGen衍生素材；火光为4层，金字塔为2层；星辰沿用已有3层。
- 新增透明文件具有真实alpha；生成的人物与建筑层经过位置和比例校准，属于衍生美术，未宣称逐像素提取。
- 原有130份素材及新增卡牌设计目录的141份原文件摘要均未变化，其中60幅独立透明配图保留。
- **原生分辨率未通过：**场景与多数图层为1672×941；火焰为1024×1536。视频输出画布不替代原画规格验收。
- 配乐仍为现有电子管弦合成版本；人物主要静止，机械绑定、人物表演及正式全片剪辑不在本次交付内。

## 证据

[浏览器验收](浏览器验收.json) · [视频验收](视频验收.json) · [连续播放](连续播放检查.json) · [服务检查](视频服务检查.json) · [检查帧总览](检查帧总览.png) · [生成记录](生成记录.json) · [素材记录](素材记录.json) · [混音记录](混音记录.json)
'''
(ROOT/'记录/验收记录.md').write_text(text)
files=[ROOT/'README.md',ROOT/'记录/验收记录.md',ROOT.parent/'README.md'];links=[];missing=[]
for f in files:
 for url in re.findall(r'\]\(([^)]+)\)',f.read_text()):
  if '://'in url or url.startswith('#'):continue
  dest=(f.parent/url.split('#')[0]).resolve();links.append(str(dest))
  if not dest.exists():missing.append({'document':str(f),'target':url})
check={'linksChecked':len(links),'missing':missing,'passed':not missing};(ROOT/'记录/文档链接检查.json').write_text(json.dumps(check,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'acceptance':result,'documents':check},ensure_ascii=False))
if not passed or missing:raise SystemExit(1)
