# 网页版源码

《更迭》以实体桌游为核心。本目录中的网页版用于试玩和数值测试，包含界面、规则引擎、本地联机服务与云端 Worker。实体卡牌的印刷原图位于仓库根目录的 `卡牌/`；网页使用优化后的 WebP 图片，位于 `assets/`。网页版的实现或实验参数与实体规则不一致时，应先核对并记录差异。

## 目录

| 路径 | 用途 |
| --- | --- |
| `src/` | 当前桌面界面、卡面清单及来源记录 |
| `game/` | 游戏规则、卡牌数据及本地联机服务 |
| `cloud/` | 云端 API、构建脚本、数据库适配与测试 |
| `assets/` | 网页使用的卡牌和背景图片 |
| `scripts/` | 生成独立页面的脚本 |
| `tests/` | 本地规则与联机测试 |
| `db/`、`drizzle/` | 数据库结构与迁移文件 |
| `deploy/` | 独立服务器部署示例 |

`cloud/vendor/game_data.json` 是云端使用的精简数据；`game/game_data.json` 包含完整游戏数据与说明书，二者用途不同。

## 本地构建与测试

需要 Node.js 22 或更新版本、Python 3。以下命令均在 `web/` 目录运行：

```sh
npm run build
npm test
npm start
```

`npm run build` 会生成 `standalone.html` 和 `dist/`；这两项是构建产物，已排除在 Git 提交之外。`npm start` 启动本地服务，默认地址为 `http://127.0.0.1:8788/`。先构建再启动，才能看到当前界面。服务运行期间产生的房间存档写入 `game/rooms/`，也不会提交到仓库。

可用 `PYTHON=/path/to/python3 npm run build` 指定 Python 路径。修改印刷卡面后，需要同步更新网页图片和 `src/card-assets.metadata.json` 中的来源摘要，否则构建会提示图片来源不一致。

目前 `T2-06` 缺少完整科技卡面，网页版使用插画替代；其他卡面与来源见 [`src/card-assets-notes.md`](src/card-assets-notes.md)。
