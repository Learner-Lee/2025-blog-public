# 2025 Blog

一个现代化的个人博客系统，基于 Next.js 15 构建，**完全自托管**，无需 GitHub 账号，数据保存在服务器本地。

## 特性

- **自托管**：数据存储在服务器本地，完整掌控内容与隐私
- **Docker 部署**：一条命令启动，无需复杂配置
- **密钥文件认证**：服务器只存储 SHA-256 哈希值，密钥文件本地保管，安全无忧
- **网页端管理**：在线发布/编辑文章、修改网站配置、上传图片，无需重新部署
- **Markdown 编辑器**：支持实时预览，图片拖拽上传
- **会话持久化**：导入密钥后当前浏览器会话内无需重复验证

## 快速开始

详见 **[部署指南 →](DEPLOY.md)**

```bash
# 1. 克隆项目
git clone https://github.com/你的用户名/你的仓库名.git
cd 你的仓库名

# 2. 生成密钥文件（在本机执行，不要在服务器执行）
node scripts/gen-key.mjs

# 3. 配置环境变量
cp .env.local.example .env.local
# 将生成的哈希值填入 .env.local 的 BLOG_SECRET

# 4. 启动
docker compose up -d --build
```

访问 `http://你的服务器IP` 即可看到博客。

## 使用方式

所有管理操作都在网页端完成，**无需重新部署**：

| 功能 | 入口 |
|------|------|
| 发布 / 编辑文章 | 右上角「写作」按钮 |
| 修改网站配置、头像、Favicon | 首页右上角「设置」按钮 |
| 管理文章列表 | `/blog` 页面右上角「编辑」按钮 |
| 关于 / 项目等页面 | 对应页面右上角「编辑」按钮 |

首次操作时上传 `blog.key` 文件完成认证，当前会话内不再重复。

## 数据目录

```
data/
├── blogs/    # 文章内容（Markdown + 图片）
├── config/   # 网站配置（JSON）
└── images/   # 上传的图片
```

**备份只需保留**：`data/` 目录、`.env.local`、本机上的 `blog.key`。

## 技术栈

- [Next.js 15](https://nextjs.org/) App Router，standalone 输出模式
- [Docker](https://www.docker.com/) + Docker Compose
- [Tailwind CSS](https://tailwindcss.com/)
- SHA-256 密钥文件认证

## 许可证

[MIT](LICENSE)
