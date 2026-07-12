# NAS 去广告 + 双 DNS 容灾配置指南

在自建 NAS 上部署 AdGuard Home / Pi-hole 做全屋 DNS 级去广告，并在 ASUS 路由器配置主备 DNS，避免 NAS 故障时导致全屋断网。

- **适用环境**：Ubuntu 自建 NAS · Docker
- **路由器**：华硕 ASUS（ASUSWRT / 梅林固件）
- **更新日期**：2026-07-08

## 目录

1. [概览与原理](#1-概览与原理)
2. [部署去广告服务](#2-部署去广告服务)
3. [固定 NAS 内网 IP](#3-固定-nas-内网-ip)
4. [配置路由器主备 DNS](#4-asus-路由器配置主备-dns)
5. [验证是否生效](#5-验证是否生效)
6. [演练故障切换](#6-演练一次故障切换)
7. [常见问题](#7-常见问题)
8. [附录：公共 DNS](#8-附录可用作备用-dns-的公共服务商)

---

## 1. 概览与原理

AdGuard Home / Pi-hole 的去广告方式是在 **DNS 解析层** 拦截：设备访问网页前先向 DNS 服务器查询域名对应的 IP，如果域名命中广告/跟踪名单，直接返回空结果，广告请求也就无法发出。这个 DNS 服务器跑在你的 NAS 上，所以效果覆盖全屋所有连接该网络的设备，无需逐台安装插件。

问题在于：如果路由器只把 **NAS 一个地址** 配置为 DNS，NAS 一旦宕机（重启、崩溃、断电），所有设备的域名解析全部失败——Wi-Fi 连接本身不受影响，但表现上和断网无异。解决办法是给路由器同时配置 **主 DNS（NAS）+ 备用 DNS（公共 DNS）**，NAS 异常时设备自动切到备用地址，只是暂时失去广告过滤，不会真断网。

**解析路径：**

| 优先级 | 路径 |
|---|---|
| 主 | 路由器 → **NAS（AdGuard/Pi-hole）** → 过滤广告后解析 |
| 备 | NAS 无响应 → **公共 DNS（如 1.1.1.1）** → 正常解析，无过滤 |

---

## 2. 部署去广告服务

二选一即可，功能类似，主要差异是易用性和资源占用。

| 方案 | 特点 | 适合 |
|---|---|---|
| **AdGuard Home** | Web 界面友好，内置多套过滤规则，支持 DoH/DoT 加密 DNS、家长控制 | 新手，想要图形化管理 |
| **Pi-hole** | 社区生态成熟，资源占用更低，可搭配 Unbound 做递归解析 | 已有 Linux/Docker 经验，追求轻量 |

### 方式 A：AdGuard Home

```bash
docker run -d --name adguardhome \
  --restart unless-stopped \
  -p 53:53/tcp -p 53:53/udp \
  -p 3000:3000/tcp \
  -v /your/config/path:/opt/adguardhome/conf \
  -v /your/work/path:/opt/adguardhome/work \
  adguard/adguardhome
```

启动后浏览器访问 `http://NAS的IP:3000`，按引导完成初始设置（设定管理员账号、选择监听网卡）。

### 方式 B：Pi-hole

```bash
docker run -d --name pihole \
  --restart unless-stopped \
  -p 53:53/tcp -p 53:53/udp \
  -p 80:80/tcp \
  -e TZ="Asia/Shanghai" \
  -v /your/pihole/etc:/etc/pihole \
  -v /your/pihole/dnsmasq:/etc/dnsmasq.d \
  pihole/pihole
```

访问 `http://NAS的IP/admin` 进入管理后台。

> **提示**：`--restart unless-stopped` 让 Docker 在容器崩溃或系统重启后自动拉起服务，是第 6 节“故障切换”生效的前提之一，不要省略。

---

## 3. 固定 NAS 内网 IP

路由器要长期记住"DNS 服务器在哪"，前提是这个地址不能变。

1. 在 NAS 上执行 `ip addr`（或 `ifconfig`），记录当前使用的网卡名称、MAC 地址与当前 IP。
2. 登录路由器后台，找到 **DHCP 静态分配 / 地址保留（Static Lease / IP Reservation）**，一般在 局域网 → DHCP 服务器 里。
3. 把上一步记录的 **MAC 地址** 绑定一个固定 IP，例如 `192.168.1.10`，保存。
4. 重启 NAS 网络（或重启 NAS），再执行一次 `ip addr` 确认 IP 已固定为你设置的地址。

---

## 4. ASUS 路由器配置主备 DNS

登录 `http://192.168.1.1` 或 `http://router.asus.com`，用管理员账号进入后台。下面两种方式选一种即可，方式 A 更常用。

### 方式 A：局域网（LAN）→ DHCP 服务器　推荐

1. 左侧菜单进入 **局域网（LAN）**
2. 点击 **DHCP 服务器** 选项卡
3. 找到 **DNS 服务器 1 / DNS 服务器 2**（部分固件展开"高级设置"后才可见）
4. 填入：

   | 项目 | 值 | 说明 |
   |---|---|---|
   | DNS 服务器 1（主） | `192.168.1.10` | 你在第 3 节中设置的 NAS 固定 IP |
   | DNS 服务器 2（备） | `1.1.1.1` | 或 `223.5.5.5`（阿里） |

5. 点击 **应用（Apply）**

### 方式 B：广域网（WAN）设置

会影响路由器自身发起的 DNS 请求，通常建议与方式 A 保持一致。

1. 左侧菜单进入 **广域网（WAN）** → **互联网连接** 选项卡
2. 把 **"WAN DNS 设置"** 改为手动（否 / Manual）
3. 填入与方式 A 相同的 DNS 服务器 1 / 2

> **注意**：华硕原生 ASUSWRT 与梅林（Merlin）第三方固件菜单位置基本一致，只是布局配色略有差异；如果 DNS 输入框是灰色不可编辑，通常是上方某个"自动获取 DNS"开关需要先关闭。

---

## 5. 验证是否生效

1. 路由器保存设置后，客户端设备需要重新获取 DHCP 配置：断开 Wi-Fi 重连即可。
2. 按系统检查当前使用的 DNS：

   | 系统 | 操作 |
   |---|---|
   | Windows | `ipconfig /all`，查看 DNS 服务器一栏 |
   | macOS | 系统设置 → 网络 → 详情 → DNS |
   | iOS / Android | Wi-Fi 详情页查看 DNS 配置 |

3. 打开 AdGuard Home（或 Pi-hole）后台的 **查询日志**，能看到客户端设备的域名解析请求，说明流量已经走过滤。
4. 访问一个平时有广告的网页，对比过滤前后的效果。

---

## 6. 演练一次故障切换

提前验证"NAS 挂了会怎样"，比事后才发现问题更稳妥。

1. 确认当前上网正常，且 AdGuard Home 查询日志有记录。
2. 手动停止服务，模拟 NAS 故障：

   ```bash
   # AdGuard Home
   docker stop adguardhome

   # Pi-hole
   docker stop pihole
   ```

3. 用手机/电脑正常浏览网页，预期现象：**可能卡顿几秒**（设备在等待主 DNS 超时），随后恢复正常访问——这是设备切到备用 DNS 的表现，属于正常。
4. 测试完成后恢复服务：

   ```bash
   docker start adguardhome
   # 或
   docker start pihole
   ```

---

## 7. 常见问题

| 现象 | 说明 / 处理 |
|---|---|
| NAS 停机后网页打开明显变慢 | 正常，设备在等待主 DNS 超时重试，不同系统等待时长不一，属于备用 DNS 切换的代价 |
| 改完 DNS 设置后手机上仍无过滤效果 | 清除本地 DNS 缓存或重连 Wi-Fi；Android/iOS 可尝试开关飞行模式 |
| Windows 电脑改完没生效 | 执行 `ipconfig /flushdns` 清缓存后重试 |
| macOS 电脑改完没生效 | 执行 `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder` |
| NAS 重启后 DNS 整体失效 | 大概率是固定 IP 没有生效，回到第 3 节检查路由器的 DHCP 地址保留设置 |
| 只想过滤部分设备，不想全屋生效 | 不改路由器全局 DNS，改为在单台设备的网络设置里手动指定 DNS |

---

## 8. 附录：可用作备用 DNS 的公共服务商

| 服务商 | 主 DNS | 备 DNS |
|---|---|---|
| 阿里 DNS | `223.5.5.5` | `223.6.6.6` |
| 腾讯 DNSPod | `119.29.29.29` | `182.254.116.116` |
| Cloudflare | `1.1.1.1` | `1.0.0.1` |
| Google | `8.8.8.8` | `8.8.4.4` |

国内网络环境建议优先选阿里 / 腾讯 DNS 作为备用，解析速度通常更稳定。

---

*本指南基于家庭自建 NAS + ASUS 路由器场景整理，具体菜单文案可能因固件版本略有差异，操作前建议先确认当前固件版本。*
