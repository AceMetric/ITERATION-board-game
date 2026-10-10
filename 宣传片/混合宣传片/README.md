# 《更迭》混合宣传片

当前成片为 **90 秒、3840×2160、30fps、16:9**：4 秒二维片头、39 秒文明场景、47 秒三维玩法与片尾。片头及片尾显示“科技史策略桌游”，主句为“文明的下一章，由你开创”。

[下载成片与增强视频](https://github.com/AceMetric/ITERATION-board-game/releases/tag/promo-2026-10-10) · [宣传语](文档/文明场景宣传语.md) · [分镜与规则](文档/分镜与规则.md) · [交付验收摘要](文档/交付验收.json)

## 观看与素材

Release 提供 `iteration-promo-4k.mp4`（4K 完整版）、`iteration-promo-1080p.mp4`（1080P 分享版）、`iteration-pilot-4k.mp4`（22 秒样片）、`iteration-ai-enhanced-4k.zip`（六段增强视频）与 `SHA256SUMS.txt`。

六段即梦原始视频位于 `../素材/AI视频/`，原生 852×480。采用官方 Real-ESRGAN 通用模型，增强结果与 Lanczos 放大结果按 35%/65% 混合输出4K，**AI 部分不是原生4K**。三维、二维文字与合成按4K渲染。配乐使用 `../AI配乐/ITERATION.wav` 原速完整接入。

资源手牌暗置；奇观投入可逐张选择明置或暗置。基础科技进入公共区，专利留在玩家区，奇观在右下角待建牌位争取；卡面与卡背按类型和时代绑定。科研点读数为后期说明，不冒充实体配件。

成片使用准确帧提取，避免浏览器视频采样把旧帧写进影片。已核对六段 AI 的全部 879 个非转场帧，样片核对 279 帧，未发现新增帧序回跳。详见 [采帧修复说明](文档/合成采帧修复.md)。技术检查不能替代运动、边缘与转场观感的审看。

## 工程结构

|路径|内容|
|---|---|
|`src/`|三维场景、二维标题、卡面裁切、剪辑、跟踪、配乐与卡点参数|
|`tools/`|素材准备、导入、超分、跟踪合成、渲染及核对工具|
|`文档/`|提示词、分镜、材质、转场、声音和验收说明|
|`即梦素材包/`|逐镜生成提示词；参考图由准备工具从原场景图复制|
|`public/`|运行时素材，由准备步骤生成；Git 仅保存审片页|
|`输出/`、`记录/`|本地导出与工作记录，不提交 Git|

原版图、卡面、字体与场景图在仓库中各保留一份来源；不提交重复贴图、临时截图、虚拟环境、模型权重或数千张转场帧。未采用的旧实验工程仍保留在原电脑本地。

## 新环境准备

以下命令在本目录执行，使用 Node.js 22+、Python 3.12 与 Google Chrome。Python 工具使用项目虚拟环境，Node 依赖通过本工程的锁文件独立安装。

```sh
npm ci
python3.12 -m venv ../工具/.venv
../工具/.venv/bin/python -m pip install -r ../工具/requirements.txt
../工具/.venv/bin/python tools/bootstrap.py
```

准备工具按 `src/assets.json` 恢复原图贴图与字体，并核对原视频摘要；不重写卡面裁切、跟踪点或时间轴。

从 Release 下载 `iteration-ai-enhanced-4k.zip`，将其中的 `ai-enhanced-4k/` 解压到 `public/`。随后运行：

```sh
../工具/.venv/bin/python tools/prepare_subjects.py
../工具/.venv/bin/python tools/prepare_bridges.py
../工具/.venv/bin/python tools/audio.py
npm run check
node tools/check_card_placement.mjs
node tools/check_edit.mjs
../工具/.venv/bin/python tools/check_tracking.py
npm run build
npm run dev
```

生成转场会写入约6GB中间素材，耗时明显长于构建页面。预览地址为 `http://127.0.0.1:18794/`；正式导出放到 `输出/` 后，也可用 `quality.html` 播放、半速与逐帧查看。

## 本地超分与渲染

如需自行重建增强视频，先完成上述基础素材准备，然后运行：

```sh
../工具/.venv/bin/python -m venv .venv-upscale
.venv-upscale/bin/python -m pip install -r tools/upscale-requirements.lock.txt
.venv-upscale/bin/python -m pip install imageio-ffmpeg==0.6.0
../工具/.venv/bin/python tools/download_upscale_models.py
.venv-upscale/bin/python tools/enhance_ai.py full --4k
.venv-upscale/bin/python tools/enhance_ai.py enhanced --4k
```

只下载记录的官方模型，并校验 SHA256。优先使用 MPS，不可用时使用 CPU；不上传素材或调用付费生成。再按上一节准备主体、转场和声音。

```sh
npm run render
node tools/render.mjs titles
../工具/.venv/bin/python tools/assemble.py
node tools/render.mjs single TransitionReel
../工具/.venv/bin/python tools/check_ai_cadence.py 输出/更迭-90秒混合宣传片-4K.mp4
```

`assemble.py` 渲染整片和样片，逐帧匹配检查通过后才替换正式文件。视频使用 H.264、AAC 立体声；分享版从4K缩小，直接复制音轨。历史前后对比工具需要原电脑保留的旧母版；它们不属于新环境复现当前成片的必要步骤。

工具默认调用 macOS 上的 Google Chrome 路径，迁移至其他系统时需修改 `tools/render.mjs` 的浏览器路径。具体制作方式见 [AI画质](文档/AI画质增强说明.md)、[转场精修](文档/转场精修.md)、[材质和配乐](文档/材质片尾与配乐精修.md)。
