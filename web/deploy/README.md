# 新版联机与域名部署

新版仍使用队友的原联机引擎和接口。玩家打开同一个 HTTPS 网址，创建房间，将邀请链接或房间码发给朋友；人齐并准备后由房主开局。标准、实验、疾速及一战封神走同一服务，原有联机、观战和续接能力继续保留。

本目录提供自管 Linux 服务器的部署模板。实际试玩站点的托管方式可能与本模板不同；使用前请填写自己的路径、域名和服务配置。

## 建议：复用队友服务器，新增一个子域名

例如队友已经控制 `example.com`，可以增加 `play.example.com` 指向同一台服务器，在该服务器另开新版 Node 服务。示例域名仅为占位符。新子域名不需要另行注册一个主域名，但需要现有域名的 DNS 管理权限；服务器容量及其服务套餐应支持新增站点。

若希望有独立品牌网址，可以在域名注册商注册一个可用主域名，再完成同样的 DNS、HTTPS 和反向代理配置。域名的可用性和续费价格须以注册商实际查询为准；具体注册和付款由域名持有人确认。

域名负责找到服务器，游戏服务负责房间与结算。仅把网页和图片上传到静态网站托管空间，不能运行当前这套联机服务器。当前服务需要持续运行的 Node.js 进程和持久磁盘，只运行一个实例；不要让不同实例同时写同一个房间目录。

## 目录和数据分开

先在 `web/` 目录执行 `npm run build`，再把网页服务所需文件部署到 `/opt/gengdie-visual`。本地 Node 服务至少保留以下文件与相对路径：

```text
/opt/gengdie-visual/
  server.cjs
  standalone.html
  src/
    tabletop-v4.css
    tabletop-v4-*.js
    card-assets.json
    card-assets.metadata.json
  assets/
    ...卡牌图片...
  game/
    game_server.cjs
    game_engine.js
    game_config.js
    game_flow.js
    game_data.json

/var/lib/gengdie-visual/rooms/   新版专用房间存档
```

新版启动入口是根目录的 `server.cjs`：它提供受限的卡面与界面静态资源，其余游戏请求交给原服务器。不要直接运行 `game/game_server.cjs`，否则外部图片和界面资源无法加载。

先备份旧版站点程序及旧版房间存档，再安装新版到独立目录。模板使用新版端口 `8788`，默认旧版端口 `8787` 不动；如果真实旧站使用其他端口，以实际占用情况为准。

新版房间目录与旧站完全分开。旧房间邀请链接和浏览器续接身份仍属于旧站；新域名不会自动接管旧站的浏览器历史、离线自动存档或联机身份。首次上线建议在新版建立测试房间，不直接迁移进行中的旧对局。

## Linux + systemd 示例

模板面向安装了 systemd 的 Linux 服务器。先按服务器的既有方式安装 Node.js 22 或更新的受支持版本，确认 Node 的实际路径；若不是 `/usr/bin/node`，先修改 service 中的 `ExecStart`。上传目录应由管理员管理，运行用户只需读取程序。

以下命令由服务器管理员在目标服务器执行，不是在开发电脑执行。创建用户的命令只在该专用用户尚不存在时使用。

```sh
sudo useradd --system --user-group --home-dir /var/lib/gengdie-visual --no-create-home --shell /usr/sbin/nologin gengdie
sudo cp /opt/gengdie-visual/deploy/gengdie-visual.service /etc/systemd/system/gengdie-visual.service
sudo systemctl daemon-reload
sudo systemctl enable --now gengdie-visual
sudo systemctl status gengdie-visual
curl --fail http://127.0.0.1:8788/health
```

健康检查应返回 `{"ok":true}`。systemd 的 `StateDirectory` 会创建专用持久目录，服务使用 `GAME_SAVE_DIR` 将房间写入其中。程序只监听本机 `127.0.0.1:8788`，公网入口由既有反向代理处理，不需要开放 8788 公网端口。

查看日志：

```sh
sudo journalctl -u gengdie-visual -n 100 --no-pager
```

若队友服务器已用 Docker、PM2 或其他管理方式，可沿用其方式，等价设置启动入口、监听地址、端口及持久存档目录即可。不要同时再用 systemd 启动第二份游戏进程。

## DNS 与 HTTPS

1. 在所控制域名的 DNS 面板新增记录：例如名称 `play`、类型 `A`、值为服务器真实公网 IPv4。只有服务器确实可通过 IPv6 访问时才同时配置 `AAAA`。具体 DNS 界面可能要求填写完整主机名。
2. 沿用旧站正在使用的 Nginx、Caddy 或平台入口，为新域名添加独立站点，反向代理到 `http://127.0.0.1:8788`。网页、卡面和 `/api/` 共用这个域名的根路径；不要把新版仅挂在 `/new/` 子路径下。
3. 保留请求原始 `Host`，不改写或缓存 `/api/`。原服务器用 `Origin` 和 `Host` 验证同源请求。
4. 给新域名配置 HTTPS，并使 HTTP 跳转到 HTTPS。

若既有入口使用 Caddy，把 `Caddyfile.example` 的域名改好后，将站点块追加到现有配置。不要覆盖旧站的配置。DNS 正确、80/443 可从公网访问且 Caddy 证书数据目录可持久写入时，Caddy 会申请并续期证书。验证后重载：

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

若既有入口是 Nginx，沿用它和现有证书管理工具即可；不要为套用此模板让另一个 Caddy 进程争用 80/443。

反向代理不应将整个项目目录设为公开文件根目录，也不要将 `rooms` 映射成静态文件。新版 wrapper 只开放所需静态资源。

## 正式开放前的联机验收

使用两台独立设备，或两个互相独立的浏览器身份，在新 HTTPS 域名验证：

- 根页面、科技卡、事件卡、奇观卡及资源卡正常加载，`/health` 返回成功。
- 创建房间、复制邀请链接、加入、准备、开始对局和观战正常。
- 分别建标准、实验、疾速和一战封神房间；检查实验参数修改、重新准备、疾速开局时代以及一战封神开局选择流程。
- 做一次抽牌或购买，另一端收到更新；私有手牌和暗置投入不被其他玩家或观战者看到。
- 刷新页面、短暂断网重连后能续接；再重启新版服务，继续同一测试房间。
- 旧站仍可访问，旧房间未被覆盖；新站请求 `/rooms/` 或未列入白名单的项目文件应失败。

现有实现按服务器所见的连接 IP 限流。反向代理后，多名玩家通常共享这个计数；少量测试房间可沿用当前方案，更多同时在线房间需要另行评估限流与承载能力，不应直接启用多实例扩容。

## 更新、备份与回退

新版更新前保留上一份程序副本。房间存档始终位于 `/var/lib/gengdie-visual/rooms`，不要把它放回上传包或随程序覆盖。

需要一致的房间备份时，先停止新版服务，再复制整个新版房间目录到非公开备份位置，完成后启动。不要在线手改房间 JSON。

```sh
sudo systemctl stop gengdie-visual
# 此时由管理员复制 /var/lib/gengdie-visual/rooms 到备份位置。
# 如需更新程序，在此时替换 /opt/gengdie-visual 内的程序和卡牌资源。
sudo systemctl start gengdie-visual
curl --fail http://127.0.0.1:8788/health
```

需要回退本次视觉版本时，可恢复上一份对应程序并指向兼容的房间目录，或暂时将新域名入口下线，旧站继续使用。不要把存在规则或存档格式差异的版本直接指向当前房间文件。

## 官方参考

- [Cloudflare：创建子域名 DNS 记录](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-subdomain/)
- [Caddy：自动 HTTPS 的 DNS、端口和持久存储要求](https://caddyserver.com/docs/automatic-https)
- [Caddy：反向代理配置](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
- [Node.js：HTTP 服务接口](https://nodejs.org/api/http.html)
