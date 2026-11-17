# AI-Sub Web 阅读空间

公开阅读现有 AI-Sub 采集结果的独立模块。Python 3.11+ 标准库，无生产 npm/pip 依赖。

- 阅读页：<https://web.alenli.cn/ai-sub/>
- 作品入口：<https://web.alenli.cn/about?work=ai-sub>
- 宿主博客：`/storage/blog/2025-blog-public`
- 模块：`/storage/blog/2025-blog-public/module/ai-sub`
- 原采集工具：`/storage/Project/ai-sub`

## 功能

产品更新、技术博客分区；中文标题与摘要；标题、摘要、来源、产品关键词搜索；来源、主题、重要性及收录时间筛选；收录时间、发布时间、重要性排序；24 条分页；详情、已读标记和原文跳转。筛选条件写入网址，方便保存与分享。

收藏使用当前浏览器的 localStorage，保存完整摘要快照，原记录清理后仍能阅读收藏。支持导出 Markdown。无登录和跨设备同步；清除站点数据会清除收藏，建议定期导出。存储不可用时明确提醒，可导出当前会话收藏。

## 数据与运行方式

`server.py` 监听 `127.0.0.1:3032`。Nginx 将 `/ai-sub/` 代理到该端口；博客 `/about` 通过原有动态数据加载器读取新增作品条目，无需重建博客镜像。

数据库默认路径 `/storage/Project/ai-sub/data/releases.db`，可通过 `AI_SUB_DB` 指定。SQLite 使用 `mode=ro` 与 `query_only=ON`，仅读取 `relevant=1` 的公开内容字段。API 不提供数据库写入、配置修改或通知触发操作。采集器、定时任务、LLM 调用和原 Telegram/飞书通知保持原有运行方式。

`GET /ai-sub/api/feed` 读取两个表并统一字段，最多返回最近收录的 5000 条；API 缓存 60 秒，页面在可见状态下每 5 分钟同步，可手动刷新。`notify_as=release` 的博客渠道内容归入产品更新。原采集程序定期清理旧记录，Web 不额外保留服务器历史档案。

前端仅以文本渲染来源标题与摘要，原文链接仅接受 HTTP/HTTPS；响应含 CSP 和 MIME 嗅探保护。systemd 使用动态非 root 用户、只读文件系统保护及内存/任务配额。静态资源固定白名单，不提供任意路径读取。

## 本地验证

```sh
python3 -m unittest discover -s module/ai-sub/tests -v
node --check module/ai-sub/public/app.js
```

DOM 交互测试使用临时测试依赖 `linkedom`，不进入生产环境：

```sh
npm install --prefix /tmp/ai-sub-qa linkedom --ignore-scripts --no-audit --no-fund
# 将 API 的 JSON 响应存为 /tmp/ai-sub-live-feed.json 后：
node module/ai-sub/tests/interaction.cjs /tmp/ai-sub-qa/node_modules/linkedom /tmp/ai-sub-live-feed.json
```

## 部署与运维

首次上传本模块后，执行 `python3 module/ai-sub/deploy/install.py`。脚本先备份 Nginx、服务文件（存在时）和两份作品数据，验证服务 API 与 Nginx 配置后发布入口。重复运行会更新现有 `ai-sub` 条目，保留其余作品。安装脚本针对本服务器路径，不建议直接用于其他主机。

常用检查：

```sh
systemctl status ai-sub-web
journalctl -u ai-sub-web -n 50 --no-pager
curl -f http://127.0.0.1:3032/ai-sub/api/feed
nginx -t
```

修改静态文件无需重启；修改 Python 后 `systemctl restart ai-sub-web`。不要把 `.env`、数据库或通知配置复制到 `public` 目录。
