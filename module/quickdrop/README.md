# QuickDrop

为 `web.alenli.cn/quickdrop/` 实现的双设备网页文件／文字互传工具；作品入口与 PDF 对照共同放在博客 `/about`。

## 运行

Node.js 20+：`npm ci`，再运行 `PUBLIC_URL=http://localhost:3031 npm start`。打开 `http://localhost:3031/quickdrop/`。

环境变量：`HOST`（默认 127.0.0.1）、`PORT`（默认 3031）、`PUBLIC_URL`（不含路径的站点 origin）、`TURN_URLS`（逗号分隔）、`TURN_SECRET`（与 coturn 共享）。生产配置位于 `/etc/quickdrop.env`，不要加入 Git。

## 能力与边界

- 高随机性临时房间，最多两台设备，一小时有效；二维码／链接配对。
- WebRTC 可靠有序 DataChannel；无法直连时使用配置的 TURN 中继。
- 根据双方 DTLS 证书指纹生成六位配对码，两端核对并确认后才能传输。
- 单文件先征得接收同意；一次选择多个文件时只需确认接收整组一次，以一张任务卡汇总进度，明细默认折叠。
- 单文件最大 **512 MiB**，每组最多 **1024 MiB、50 个文件**。一次多选会按文件名自然排序（数字 2 在 10 前），再按顺序自动拆组；正好 1024 MiB 不拆，超过容量、数量或清单消息长度时开启下一组，不把后面的文件倒填进前组。
- 每组只确认一次、折叠展示、全部通过 SHA-256 后统一下载 ZIP；自动拆组的末组只有一个文件时也保留同样流程。单次只选一个文件仍直接下载。同名文件自动编号，空文件保留；拒收、取消、校验失败或清单不符时不生成残缺 ZIP，并停止后续未发送组。
- ZIP 在接收浏览器本地生成，使用标准 ZIP STORE 格式（打包但不压缩文件内容），服务器不接收或暂存文件。单个文件仍可直接下载。传输采用 16 KiB 分块与发送背压。
- 文字最大 32 KiB UTF-8。文件、文件名、文字均通过 DataChannel 发送，信令后端不保存文件内容。
- 微信／QQ 文件：先保存到系统文件目录，再从网页选择。普通网页不能读取聊天记录或应用私有目录。
- 接收内容和 ZIP 仅在本标签页内存中；点击下载才会交给浏览器保存。容量限制按单文件／单组执行，不再以历史任务累计 300 MiB 拒绝下一组。任务下载保存后可点击“释放缓存”，确认后撤销此任务的本页下载链接，便于继续接收后续组；校验和打包仍有额外内存开销。
- 文件接收等待 90 秒、发送背压等待 60 秒、完成确认等待 180 秒；连接中断会中止当前传输。没有断点续传／后台传输保证。
- 房间与 WebSocket 均有基础 IP 频率限制；TURN 应配置资源配额。公网接入经过站点 HTTPS/WSS，服务只监听回环地址。
- 整组传输使用 `hello` 能力声明与 `batch-meta/accept/reject/done/ok/error/cancel` 控制消息，文件元数据绑定已同意的清单。`limits-v2` 声明新版容量和自动分组能力；超出旧页面能力时提示双方刷新重配。
- 调试强制中继：在两个设备的访问链接上都添加 `&relay=1`，成功后界面显示“正在通过中继加密传输”。

## 部署与检查

源代码：`/storage/blog/2025-blog-public/module/quickdrop`。systemd 单元和 Nginx location 模板位于 `deploy/`。生产使用主机 coturn，3478 UDP/TCP 和 UDP 49160–49200 为中继端口池。

`npm test` 验证 HTTP、房间、信令、跨源限制、CRC32、ZIP 内容，以及 512／1024 MiB 精确边界、超 1 字节拆组、自然排序、50 个文件拆组和清单消息大小。ZIP 测试需要 Python 3。`node --check server.js`、`node --check public/app.js` 检查语法。浏览器与真实手机测试结果另见部署记录。

详细部署、验证范围与回滚信息见 [DEPLOYMENT.md](DEPLOYMENT.md)。浏览器脚本位于 `test/browser.mjs`、`test/large-file.mjs`（真实 512 MiB 传输）、`test/about-inline.mjs`（`test/about.mjs` 为兼容入口）、`test/turn.mjs`，需要 Playwright 和本机 Chrome；它们不属于生产运行依赖。

运维：`systemctl status quickdrop coturn`、`journalctl -u quickdrop -u coturn`、`curl http://127.0.0.1:3031/quickdrop/healthz`。修改前的 Nginx 和 about 数据保存在服务器带时间戳的备份目录中。
