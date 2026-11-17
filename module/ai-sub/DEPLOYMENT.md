# 部署记录

日期：2026-11-17（Asia/Shanghai）。

## 已部署

- `https://web.alenli.cn/ai-sub/`：AI 知识阅读空间。
- `https://web.alenli.cn/about?work=ai-sub`：作品详情入口。
- `https://web.alenli.cn/about`：保留原 PDF 与 QuickDrop 作品，追加 AI-Sub。
- systemd `ai-sub-web.service` 已启用自启；监听 `127.0.0.1:3032`。
- 源码位于博客 `module/ai-sub`，未修改原采集项目源码或数据库。
- `/about` 两份作品数据均更新；线上由已运行的博客动态加载，不需要重建 Docker 镜像。

初次上线接入 477 条相关记录、55 个来源。数量随采集和清理变化。

## 已完成验证

- 本地和服务器 Python 3 组测试通过：仅相关内容、字段白名单、HTML 摘要转文本、不安全 URL 排除、博客发布类型归类、数据库字节未变、缺失数据库不创建、固定资源路由、写请求拒绝、错误响应及安全头。
- JavaScript 语法检查通过。
- 使用线上数据的 DOM 逻辑验证通过：分页、分区、重要性/来源/时间/关键词筛选、排序、详情与已读、URL 参数、收藏跨页面加载持久化、数据源故障时读取已收藏快照、Markdown 导出、空结果和接口异常、存储配额失败提醒。
- 正式站阅读页、博客作品页、PDF 与 QuickDrop 均返回 HTTPS 200。
- 博客运行中的 `/about` 响应包含新作品、封面以及原 PDF/QuickDrop 信息。
- Nginx 配置校验通过；Nginx、AI-Sub Web、QuickDrop 均运行正常。
- 本次未改动博客的现有未提交修改，没有重建博客、重启采集器或发送通知。

验证边界：浏览器访问工具返回 `The browser access host is unavailable`，因此未完成真实浏览器交互、截图或真实手机布局验收。DOM 测试不代表视觉验收。页面已实现响应式 CSS，生产服务不依赖该测试工具。

## 备份与回滚

部署前配置备份：`/storage/backups/ai-sub-web-20261117T051655Z`（root 权限）。`manifest.json` 记录原路径与备份路径。

首次部署的新文件为 `module/ai-sub` 与 `/etc/systemd/system/ai-sub-web.service`；原采集器、数据库和博客容器镜像不变。后续同步前的 JS 文件另存于同一备份目录。

回滚时先备份当前配置，再依据 manifest 恢复 Nginx 与两份 about JSON。若作品列表之后有其他编辑，只移除 `id=ai-sub` 的条目，避免覆盖后续修改。先执行 `nginx -t`，通过后 reload Nginx；需要停用新阅读服务时执行 `systemctl disable --now ai-sub-web`。可保留模块源码作归档。无需删除数据库、清理镜像或恢复原博客容器。

## 使用边界

收藏只在当前浏览器，清除站点数据后不可恢复；推荐导出 Markdown。网页最多展示最近 5000 篇，原采集程序会清理旧数据，收藏摘要独立保存在浏览器。摘要来自 AI 分类整理，原文链接是准确内容的依据。Web 版不提供订阅源编辑、密钥管理或手动采集按钮。
