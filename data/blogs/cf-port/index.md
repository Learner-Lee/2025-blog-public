# Cloudflare 代理模式端口限制与解决方案

> 适用对象：运维 / 开发人员
> 更新日期：2026-03-25

---

## 目录

1. [背景：为什么橙云只支持部分端口](#1-背景为什么橙云只支持部分端口)
2. [支持的端口列表](#2-支持的端口列表)
3. [解决方案对比](#3-解决方案对比)
4. [方案 A：关闭代理（灰云模式）](#4-方案-a关闭代理灰云模式)
5. [方案 B：Nginx 反向代理（推荐）](#5-方案-b-nginx-反向代理推荐)
6. [方案 C：Cloudflare Tunnel](#6-方案-c-cloudflare-tunnel)
7. [方案 D：Cloudflare Spectrum（付费）](#7-方案-d-cloudflare-spectrum付费)
8. [常见问题 FAQ](#8-常见问题-faq)

---

## 1. 背景：为什么橙云只支持部分端口

Cloudflare 橙云（Proxied）模式下，**所有流量都经过 Cloudflare 的边缘节点中转**，而不是直接到达你的源站。

```
用户浏览器  →  Cloudflare 边缘节点  →  你的源站服务器
```

Cloudflare 边缘节点只监听固定的几个端口用于入站连接，因此：

- **不在列表中的端口**（如 8200、9000、3000 等）**无法通过橙云代理访问**
- 若强行访问，客户端会收到 `ERR_CONNECTION_REFUSED` 或超时错误

---

## 2. 支持的端口列表

### HTTP 端口

| 端口 | 备注 |
|------|------|
| 80   | 标准 HTTP |
| 8080 | 常用备用 HTTP |
| 8880 | |
| 2052 | |
| 2082 | cPanel HTTP |
| 2086 | WHM HTTP |
| 2095 | Webmail HTTP |

### HTTPS 端口

| 端口 | 备注 |
|------|------|
| 443  | 标准 HTTPS |
| 8443 | 常用备用 HTTPS |
| 2053 | |
| 2083 | cPanel HTTPS |
| 2087 | WHM HTTPS |
| 2096 | Webmail HTTPS |

> **结论：端口 8200 不在支持范围内，需要通过下列方案绕过此限制。**

---

## 3. 解决方案对比

| 方案 | 难度 | 费用 | 隐藏真实 IP | 保留 CF 防护 | 适用场景 |
|------|------|------|------------|------------|---------|
| 灰云（DNS only） | ⭐ | 免费 | ❌ | ❌ | 临时调试 |
| Nginx 反向代理 | ⭐⭐ | 免费 | ✅ | ✅ | 生产环境首选 |
| Cloudflare Tunnel | ⭐⭐ | 免费 | ✅ | ✅ | 内网穿透 / 无公网IP |
| Cloudflare Spectrum | ⭐ | 付费 | ✅ | ✅ | 企业级 TCP 代理 |

---

## 4. 方案 A：关闭代理（灰云模式）

### 操作步骤

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入对应域名的 **DNS** 设置
3. 找到目标 DNS 记录，点击橙云图标，切换为**灰云**（DNS only）
4. 保存，等待 DNS 生效（通常 1-5 分钟）

### 效果

```
用户浏览器  →  你的服务器:8200（直连）
```

### 注意事项

- 真实服务器 IP 将对外暴露
- 失去 CDN 加速、DDoS 防护、WAF 等 Cloudflare 功能
- **仅建议用于开发测试环境**

---

## 5. 方案 B：Nginx 反向代理（推荐）

### 原理

在服务器上用 Nginx 监听 CF 支持的端口（443），在内部将流量转发到 8200。

```
用户  →  CF 橙云（443）  →  Nginx（443）  →  本地服务（8200）
```

### 前置条件

- 已安装 Nginx
- 已配置 SSL 证书（推荐使用 Cloudflare 源站证书或 Let's Encrypt）

### 配置示例

```nginx
server {
    listen 443 ssl;
    server_name your.domain.com;

    # SSL 证书配置
    ssl_certificate     /etc/ssl/certs/your_cert.pem;
    ssl_certificate_key /etc/ssl/private/your_key.pem;

    # 安全加固
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass         http://127.0.0.1:8200;
        proxy_http_version 1.1;

        # 传递真实客户端信息
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持（按需开启）
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# HTTP 强制跳转 HTTPS
server {
    listen 80;
    server_name your.domain.com;
    return 301 https://$host$request_uri;
}
```

### 应用配置

```bash
# 测试配置语法
nginx -t

# 重载配置（不中断现有连接）
systemctl reload nginx
```

### Cloudflare SSL 模式建议

在 CF Dashboard → SSL/TLS 中，将加密模式设置为 **Full (strict)**，以确保端到端加密。

---

## 6. 方案 C：Cloudflare Tunnel

### 适用场景

- 服务器没有公网 IP
- 不想开放任何防火墙端口
- 需要将内网服务安全暴露到公网

### 原理

```
用户  →  CF 边缘（443）  →  cloudflared 守护进程  →  本地服务（8200）
```

cloudflared 主动向 CF 建立出站隧道，无需入站端口开放。

### 安装 cloudflared

```bash
# Debian / Ubuntu
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | \
  gpg --dearmor > /usr/share/keyrings/cloudflare-main.gpg

echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
  https://pkg.cloudflare.com/cloudflared any main' \
  > /etc/apt/sources.list.d/cloudflared.list

apt update && apt install cloudflared

# CentOS / RHEL
yum install -y cloudflared
```

### 配置步骤

```bash
# 1. 登录 Cloudflare 账号
cloudflared tunnel login

# 2. 创建隧道
cloudflared tunnel create my-service

# 3. 查看隧道 ID
cloudflared tunnel list
```

创建配置文件 `~/.cloudflared/config.yml`：

```yaml
tunnel: <your-tunnel-id>
credentials-file: /root/.cloudflared/<your-tunnel-id>.json

ingress:
  - hostname: service.your-domain.com
    service: http://localhost:8200
  - service: http_status:404
```

```bash
# 4. 将域名 DNS 指向隧道
cloudflared tunnel route dns my-service service.your-domain.com

# 5. 启动隧道
cloudflared tunnel run my-service

# 6. 设置为系统服务（开机自启）
cloudflared service install
systemctl start cloudflared
systemctl enable cloudflared
```

### 验证

```bash
# 查看隧道状态
cloudflared tunnel info my-service

# 查看运行日志
journalctl -u cloudflared -f
```

---

## 7. 方案 D：Cloudflare Spectrum（付费）

Spectrum 是 Cloudflare 提供的 **TCP/UDP 代理功能**，可代理任意端口的流量。

### 套餐要求

| 功能 | Free | Pro | Business | Enterprise |
|------|------|-----|----------|------------|
| Spectrum | ❌ | ❌（有限） | ✅ | ✅ |

### 配置入口

CF Dashboard → 对应域名 → **Spectrum** → Add Application

### 配置参数

| 参数 | 示例值 |
|------|--------|
| Application | TCP |
| Domain | service.your-domain.com |
| Edge Port | 8200 |
| Origin | your-server-ip:8200 |

> 注意：Spectrum 按流量计费，大流量场景需评估成本。

---

## 8. 常见问题 FAQ

**Q：使用 Nginx 反向代理后，服务获取到的客户端 IP 是 Cloudflare 的节点 IP，怎么获取真实 IP？**

A：从请求头 `X-Forwarded-For` 或 `CF-Connecting-IP` 中读取真实客户端 IP。Cloudflare 会自动注入 `CF-Connecting-IP` 头，优先使用此头。

---

**Q：Cloudflare Tunnel 的连接稳定性如何？**

A：cloudflared 会自动建立多条冗余连接到 CF 边缘，断线后自动重连，生产环境可用性较高。建议配合 systemd 保持进程存活。

---

**Q：灰云模式下真实 IP 暴露了，有什么风险？**

A：攻击者可直接对源站 IP 发起 DDoS 攻击，绕过 Cloudflare 的防护层。建议在服务器防火墙层面限制只允许 [Cloudflare IP 段](https://www.cloudflare.com/ips/) 访问，即使在橙云模式下也推荐此操作。

---

**Q：三种免费方案如何选择？**

| 情况 | 推荐方案 |
|------|---------|
| 服务器有公网 IP + 已有 Nginx | **Nginx 反向代理** |
| 服务器无公网 IP / 内网环境 | **Cloudflare Tunnel** |
| 临时测试 / 不在乎 IP 暴露 | **灰云模式** |

---

*文档结束*
