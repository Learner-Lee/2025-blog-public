# 部署指南

本项目完全自托管，无需 GitHub 账号，数据保存在服务器本地，通过 Docker 一键部署。

---

## 环境要求

- Linux 服务器（推荐 Ubuntu 22.04）
- Docker >= 24.0
- Docker Compose Plugin >= 2.0
- Node.js >= 18（仅生成密钥时使用，可在本机执行）

---

## 一、安装 Docker

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 安装 Docker Compose 插件
mkdir -p ~/.docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose

# 验证安装
docker --version
docker compose version
```

---

## 二、获取代码

```bash
git clone https://github.com/你的用户名/你的仓库名.git
cd 你的仓库名
```

---

## 三、生成密钥文件

认证方式采用**密钥文件**，而非明文密码，防止暴力破解：

- 服务器只存储密钥的哈希值（SHA-256），即使 `.env.local` 泄露也无法被利用
- 本地保存 `blog.key` 文件，登录时上传该文件完成认证

**在本机执行**（不要在服务器上执行）：

```bash
node scripts/gen-key.mjs
```

输出示例：

```
✅ 密钥文件已生成: blog.key

请将以下内容写入服务器的 .env.local:

BLOG_SECRET=a3f4b2c1d5e6...（64位哈希值）

⚠️  重要提示:
  1. blog.key 是你的私人密钥，请妥善保管，不要上传到 Git 仓库
  2. BLOG_SECRET 是哈希值，不是密钥本身，泄露也无法被利用
  3. 登录时在网页端上传 blog.key 文件即可完成认证
```

> `blog.key` 已加入 `.gitignore`，不会被误提交。请把它保存到安全的地方（本地电脑、密码管理器等）。

---

## 四、配置环境变量

```bash
cp .env.local.example .env.local
vim .env.local
```

将上一步生成的哈希值填入：

```
BLOG_SECRET=a3f4b2c1d5e6...（你的64位哈希值）
```

---

## 五、启动服务

```bash
docker compose up -d --build
```

首次启动会自动：
1. 构建镜像（约 3~5 分钟）
2. 创建 `./data/` 目录并初始化默认数据
3. 在 80 端口启动服务

启动后访问 `http://你的服务器IP` 即可看到博客。

---

## 六、目录结构

```
项目目录/
├── data/
│   ├── blogs/       # 文章内容（Markdown + 图片）
│   ├── config/      # 网站配置（JSON，网页端修改后保存于此）
│   └── images/      # 上传的图片（头像、背景图等）
├── .env.local       # 环境变量（含密钥哈希）
├── blog.key         # ⚠️ 本地密钥文件，不要上传到服务器或 Git
├── docker-compose.yml
└── Dockerfile
```

`data/` 目录是所有持久化数据，**备份时只需备份此目录、`.env.local` 和 `blog.key`**。

---

## 七、网页端管理

| 功能 | 入口 |
|------|------|
| 发布/编辑文章 | 右上角「写作」按钮 → 编辑完成后点「发布」→ 上传 `blog.key` |
| 修改网站配置 | 首页右上角「设置」按钮 → 修改后点「保存」→ 上传 `blog.key` |
| 管理文章列表 | `/blog` 页面右上角「编辑」按钮 |
| 修改关于/项目等页面 | 对应页面右上角「编辑」按钮 |

首次操作需要上传 `blog.key` 文件，验证通过后当前会话内不再重复上传。

---

## 八、常用命令

```bash
# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 更新代码后重新构建
git pull
docker compose up -d --build
```

---

## 九、迁移数据

将博客迁移到新服务器：

```bash
# 在旧服务器打包数据
tar -czf blog-backup.tar.gz data/ .env.local

# 传输到新服务器
scp blog-backup.tar.gz root@新服务器IP:/目标路径/

# 在新服务器解压并启动
tar -xzf blog-backup.tar.gz
docker compose up -d --build
```

> `blog.key` 保存在本机，无需传输到服务器，只在网页登录时上传。

---

## 十、配置 HTTPS（可选）

推荐使用 Nginx + Certbot：

```bash
# 安装 Nginx 和 Certbot
apt install -y nginx certbot python3-certbot-nginx

# 修改 docker-compose.yml，将端口改为本地绑定
# ports:
#   - "127.0.0.1:3000:3000"

# 配置 Nginx 反向代理
cat > /etc/nginx/sites-available/blog <<'EOF'
server {
    listen 80;
    server_name 你的域名;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 申请 SSL 证书
certbot --nginx -d 你的域名
```

---

## 十一、更换密钥

如果 `blog.key` 丢失或需要更换：

```bash
# 1. 删除旧密钥文件
rm blog.key

# 2. 重新生成
node scripts/gen-key.mjs

# 3. 更新服务器 .env.local 中的 BLOG_SECRET

# 4. 重启服务（无需重新构建）
docker compose restart
```
