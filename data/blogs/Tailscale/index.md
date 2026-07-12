# Tailscale Docker 部署导致服务器间无法互联 — 完整排查修复手册

> **记录时间**:2026-07-07 **问题级别**:网络连通性故障(非账号/授权问题) **修复耗时参考**:定位约 10 分钟,单台修复约 3 分钟 **适用场景**:Tailscale 通过 Docker 官方镜像 `tailscale/tailscale` 部署(常见于 NAS、面板类工具一键安装),客户端能连服务器,但服务器之间无法通过 100.x 地址互访。

------

## 目录

1. [问题现象](https://claude.ai/chat/6817431e-68c3-4f7d-9868-2aa668f4fc0f#一问题现象)
2. [原理:为什么会出现这种"单向可用"](https://claude.ai/chat/6817431e-68c3-4f7d-9868-2aa668f4fc0f#二原理为什么会出现这种单向可用)
3. [排查流程(决策树)](https://claude.ai/chat/6817431e-68c3-4f7d-9868-2aa668f4fc0f#三排查流程决策树)
4. [修复:重建容器切换内核 TUN 模式](https://claude.ai/chat/6817431e-68c3-4f7d-9868-2aa668f4fc0f#四修复重建容器切换内核-tun-模式)
5. [常见报错对照表](https://claude.ai/chat/6817431e-68c3-4f7d-9868-2aa668f4fc0f#五常见报错对照表)
6. [验证清单](https://claude.ai/chat/6817431e-68c3-4f7d-9868-2aa668f4fc0f#六验证清单)
7. [延伸问题:高延迟 / 走 DERP 中继](https://claude.ai/chat/6817431e-68c3-4f7d-9868-2aa668f4fc0f#七延伸问题高延迟--走-derp-中继)
8. [相关知识备忘](https://claude.ai/chat/6817431e-68c3-4f7d-9868-2aa668f4fc0f#八相关知识备忘)
9. [官方镜像常用环境变量参考](https://claude.ai/chat/6817431e-68c3-4f7d-9868-2aa668f4fc0f#九官方镜像常用环境变量参考)
10. [本次环境速查表](https://claude.ai/chat/6817431e-68c3-4f7d-9868-2aa668f4fc0f#十本次环境速查表)

------

## 一、问题现象

### 1.1 症状矩阵

| 操作                                   | 结果                                 | 说明                  |
| -------------------------------------- | ------------------------------------ | --------------------- |
| MacBook → ping 服务器 A 的 100.x       | ✅ 通(但延迟 250~900ms)               | 走 DERP 中继,见第七节 |
| MacBook → ping 服务器 B 的 100.x       | ✅ 通(20~40ms)                        | 近似直连              |
| MacBook → ssh 服务器                   | ✅ 通                                 | 入站服务正常          |
| 服务器 A → ping 服务器 B 的 100.x      | ❌ 100% 丢包                          | 核心症状              |
| 服务器 → ping **自己**的 100.x         | ❌ 不通                               | 关键线索①             |
| 服务器上执行 `tailscale status`        | `command not found`                  | 关键线索②             |
| 服务器上执行 `ip addr show tailscale0` | `Device "tailscale0" does not exist` | 关键线索③             |

### 1.2 三条关键线索的含义

- **线索①(ping 自己都不通)**:正常安装的 Tailscale,ping 自己的 100.x 走本地回环必通。不通说明宿主机网络栈里根本没有这个地址——Tailscale 不在宿主机上。
- **线索②(命令不存在)**:宿主机没装 Tailscale 二进制,但节点又确实在线(客户端连得上),推断跑在容器里。
- **线索③(无 tailscale0 接口)**:即使容器用了 `--network=host`,接口也没出现在宿主机上,指向 **userspace 网络模式**。

------

## 二、原理:为什么会出现这种"单向可用"

### 2.1 Tailscale 的两种运行模式

**内核 TUN 模式(正常模式)** tailscaled 创建 `tailscale0` 虚拟网卡,并向内核路由表注入 `100.64.0.0/10` 相关路由。宿主机上任何进程发往 100.x 的包都会被路由到 tailscale0,由 tailscaled 加密后经 WireGuard 发出。**双向都正常。**

**userspace 网络模式** 不创建任何网卡、不动路由表,tailscaled 完全在用户态收发包:

- **入站**:tailscaled 从 tailnet 收到发给本机的包后,以本地代理的方式把连接转发给目标服务(所以外部客户端 ssh/ping 本机是通的)
- **出站**:本机进程发起的连接**不会**经过 tailscaled——因为没有接口、没有路由,内核不知道 100.x 该发到哪,直接按默认路由发出去然后石沉大海。除非应用显式使用 tailscaled 提供的 SOCKS5/HTTP 代理,否则出站全部失效

这就是"客户端连服务器都正常、服务器之间全挂"的完整解释:每台服务器都只能被动接受连接,不能主动发起。

### 2.2 为什么容器会跑成 userspace 模式

官方镜像 `tailscale/tailscale` 的入口程序 containerboot 中,**`TS_USERSPACE` 环境变量默认为 `true`**。这是为了兼容无特权容器环境(K8s sidecar 等)的保守默认值。要跑内核模式必须同时满足三个条件:

1. 显式设置 `TS_USERSPACE=false`
2. 容器能访问真正的 TUN 设备:`--device=/dev/net/tun`
3. 具备网络管理权限:`--cap-add=NET_ADMIN`

缺任何一个,tailscaled 要么报错,要么静默回退到 userspace 模式。

### 2.3 本例中的第二个错误:假 TUN 设备

原容器的挂载配置(通过 `docker inspect` 查到):

```
/storage/docker/doc-Tailscale/dev/net/tun -> /dev/net/tun    ← 错误
/storage/docker/doc-Tailscale/var/lib     -> /var/lib
```

第一条把宿主机上一个**普通文件路径**用 `-v` 挂载成了容器的 `/dev/net/tun`。真正的 TUN 设备是内核字符设备(major 10, minor 200),位于宿主机的 `/dev/net/tun`,必须用 `--device` 参数透传。挂一个普通文件进去,tailscaled 打开它时得不到 TUN 语义,内核模式必然失败。这类配置多半来自面板工具自动生成的错误模板——它机械地把容器内路径映射到了应用数据目录下。

------

## 三、排查流程(决策树)

按顺序执行,每一步都标注了预期输出和分支走向。

### Step 1:宿主机上有没有 Tailscale?

```bash
tailscale status
ip addr show tailscale0
```

| 结果                                          | 走向                                         |
| --------------------------------------------- | -------------------------------------------- |
| 两条都正常                                    | 不是本文的问题,转向第七节查连通质量,或查对端 |
| `command not found` + `Device does not exist` | → Step 2                                     |
| 命令存在但 status 报 `Tailscale is stopped`   | `tailscale up` 拉起即可,不是本文问题         |

### Step 2:确认跑在容器里

```bash
docker ps -a | grep -i tailscale
```

预期输出类似:

```
c365ad4bca4c   tailscale/tailscale   "/usr/local/bin/cont…"   4 days ago   Up 4 days   tailscaled
```

确认容器存在且 `Up`。如果 `Exited`,先 `docker logs <容器名>` 看退出原因(可能直接命中第五节的报错表)。

### Step 3:查网络模式

```bash
docker inspect tailscaled --format '{{.HostConfig.NetworkMode}}'
```

| 输出                 | 含义                                              | 走向               |
| -------------------- | ------------------------------------------------- | ------------------ |
| `host`               | host 网络但宿主机无接口 → 高度怀疑 userspace 模式 | → Step 4           |
| `default` / `bridge` | 容器在独立网络命名空间,宿主机必然不在 tailnet 里  | 直接跳到第四节重建 |

### Step 4:查环境变量,确认 userspace 模式

```bash
docker inspect tailscaled --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -i -E 'TS_|tun'
```

| 结果                                | 结论                                        |
| ----------------------------------- | ------------------------------------------- |
| 没有 `TS_USERSPACE` 相关输出        | 使用默认值 `true` → **确诊 userspace 模式** |
| `TS_USERSPACE=false` 但接口仍不存在 | TUN 设备透传有问题 → Step 5 重点看挂载      |

### Step 5:记录挂载(重建前必做,防止丢认证)

```bash
docker inspect tailscaled --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
```

找到映射到容器 `/var/lib`(或 `/var/lib/tailscale`)的宿主机路径并**记下来**——这里面有节点密钥和登录状态,重建时沿用就无需重新认证。

同时检查有没有 `xxx -> /dev/net/tun` 形式的 `-v` 挂载(即 2.3 节说的假设备),有的话重建时必须去掉,换成 `--device`。

### Step 6:确认容器内 tailnet 状态正常(排除账号问题)

```bash
docker exec tailscaled tailscale status
```

能列出所有节点 = 账号、密钥、到控制面的连接都正常,问题**纯粹在网络模式**,可以放心进入修复环节。

> 注:如果这条报 socket 相关错误,试试 `docker exec tailscaled tailscale --socket=/tmp/tailscaled.sock status`(containerboot 的 socket 路径与裸机默认不同)。

------

## 四、修复:重建容器切换内核 TUN 模式

### 4.1 标准重建命令

```bash
# 1. 删除旧容器(状态在宿主机挂载目录里,删容器不丢数据)
docker rm -f tailscaled

# 2. 内核模式重建
#    ★ -v 左边的路径换成 Step 5 查到的实际状态目录!
docker run -d --name tailscaled \
  --restart unless-stopped \
  --network=host \
  --cap-add=NET_ADMIN \
  --device=/dev/net/tun:/dev/net/tun \
  -v /storage/docker/doc-Tailscale/var/lib:/var/lib \
  -e TS_USERSPACE=false \
  -e TS_STATE_DIR=/var/lib/tailscale \
  tailscale/tailscale
```

### 4.2 参数逐条说明

| 参数                                 | 作用                                               | 缺失后果                                                    |
| ------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------- |
| `--network=host`                     | 容器共享宿主机网络栈,tailscale0 直接出现在宿主机上 | 接口困在容器命名空间里,宿主机照样用不了                     |
| `--cap-add=NET_ADMIN`                | 允许创建网络接口、修改路由                         | tailscaled 无权建 TUN,报 permission denied 或退回 userspace |
| `--device=/dev/net/tun`              | 透传内核 TUN 字符设备                              | 无法创建隧道接口(注意:必须用 `--device`,不能用 `-v` 挂文件) |
| `-e TS_USERSPACE=false`              | 关闭用户态模式                                     | 默认 true,前面三个参数全白给                                |
| `-v <状态目录>:/var/lib`             | 持久化节点密钥/登录状态                            | 每次重建都要重新认证,且旧节点在后台变僵尸                   |
| `-e TS_STATE_DIR=/var/lib/tailscale` | 告诉 containerboot 状态放哪                        | 状态写进容器层,删容器即丢失                                 |
| `--restart unless-stopped`           | 开机/崩溃自动拉起                                  | 重启后节点掉线                                              |

### 4.3 可选参数

```bash
  # 固定 WireGuard 监听端口(便于防火墙放行、提高打洞成功率)
  -e TS_TAILSCALED_EXTRA_ARGS=--port=41641 \

  # 给 tailscale up 传参:清除旧的非默认配置(见 4.4)
  -e TS_EXTRA_ARGS=--reset \

  # 不接管系统 DNS(服务器上通常建议关)
  -e TS_ACCEPT_DNS=false \

  # 广播子网路由(按需)
  -e TS_ROUTES=192.168.1.0/24 \

  # 首次部署用 auth key 免交互认证(沿用旧状态目录时不需要)
  -e TS_AUTHKEY=tskey-auth-xxxxx \
```

固定端口后记得放行:`ufw allow 41641/udp`

### 4.4 【实际踩到的坑】旧配置导致启动失败

重建后如果 `docker logs tailscaled` 出现:

```
Error: changing settings via 'tailscale up' requires mentioning all
non-default flags. To proceed, either re-run your command with --reset or
use the command below to explicitly mention the current value of
all non-default settings:
        tailscale up --accept-dns=false --advertise-routes=0.0.0.0/24
boot: failed to auth tailscale: tailscale up failed: exit status 1
```

**原因**:旧状态目录里保存了非默认设置(本例:关闭了 DNS 接管、广播了一条 `0.0.0.0/24` 路由),而 containerboot 自动执行的 `tailscale up` 没提到它们。Tailscale 的安全机制要求变更配置时必须显式列出所有非默认项,否则拒绝执行,容器随即退出重启循环。

**处理**:再次重建,追加:

```bash
  -e TS_EXTRA_ARGS=--reset \
  -e TS_ACCEPT_DNS=false \
```

`--reset` 表示"以本次命令行为准,丢弃旧设置";需要保留的项(如关闭 DNS)用对应环境变量显式带上。

> 顺带:`0.0.0.0/24` 是 0.0.0.0~0.0.0.255 的无意义网段,基本可断定是当初配置时的笔误(疑似想配 exit node 的 `0.0.0.0/0`),借 `--reset` 一并清掉是正确选择。

------

## 五、常见报错对照表

| 日志/现象                                                    | 原因                                   | 处理                                                         |
| ------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------ |
| `changing settings via 'tailscale up' requires mentioning all non-default flags` | 旧状态与新启动参数冲突                 | 加 `TS_EXTRA_ARGS=--reset`,见 4.4                            |
| `is CONFIG_TUN enabled in your kernel?` / `CreateTUN failed` | TUN 设备没透传,或宿主机内核缺模块      | 检查 `--device` 参数;宿主机 `modprobe tun`(OpenVZ/LXC 虚拟化的 VPS 可能需联系商家开启 TUN) |
| `operation not permitted` 创建接口失败                       | 缺 `NET_ADMIN`                         | 加 `--cap-add=NET_ADMIN`                                     |
| `[warning] failed to symlink socket: file exists`            | 旧 socket 文件残留                     | 无害警告,可忽略;CLI 用 `--socket=/tmp/tailscaled.sock`       |
| 重建后要求重新登录(日志出现 login URL)                       | 状态目录路径没对上                     | 核对 `-v` 路径与 `TS_STATE_DIR`;实在找不回就点链接重新认证,再去控制台删掉重复的旧节点 |
| `tailscale0` 存在但 ping 对端不通                            | 本机已修好,**对端**还是 userspace 模式 | 去对端服务器跑一遍第三节流程                                 |
| ufw/iptables 白名单模式下打洞失败                            | 入站 UDP 被挡                          | 固定端口 41641 并放行,见 4.3                                 |

------

## 六、验证清单

按顺序全部通过才算修复完成:

```bash
# 1. 容器健康:Running,日志末尾出现 "Switching ipn state Starting -> Running"
docker ps | grep tailscaled
docker logs tailscaled --tail 20

# 2. 接口出现,且地址是本机在 tailnet 里的 100.x
ip addr show tailscale0
# 预期:inet 100.x.x.x/32 scope global tailscale0

# 3. 从宿主机 ping 一个"已知正常"的节点(如自己的电脑)——验证本机出站
ping -c 4 <正常节点的100.x>

# 4. 从宿主机 ping 目标服务器——若不通,问题在对端,去对端重复整个流程
ping -c 4 <目标服务器的100.x>

# 5. (可选)连通质量:显示 direct 为直连,显示 via DERP 为中继
docker exec tailscaled tailscale ping <对端100.x>
```

> **重要**:第 3 步的验证目标一定要选正常安装的客户端(如 Mac)。如果直接 ping 另一台同样有问题的服务器,通不了也分不清是本机没修好还是对端有问题。
>
> **每台有同样问题的服务器都要各自修一遍**——本机修好只解决本机的出站,对端不修,对端照样发不出包。

------

## 七、延伸问题:高延迟 / 走 DERP 中继

### 7.1 背景

Tailscale 优先尝试节点间 UDP 直连(NAT 打洞),失败则退到 DERP 中继(TCP 443)。中继保证连通性但延迟高。修复互联后如果 ping 稳定在 200ms+,基本就是在走中继。

### 7.2 诊断

```bash
docker exec tailscaled tailscale netcheck
docker exec tailscaled tailscale ping <对端100.x>
```

本例 netcheck 关键输出:

```
* UDP: false
* IPv4: (no addr found)
* Nearest DERP: Myself Derper
* DERP latency:
        - Myself: 243.1ms (Myself Derper)
```

### 7.3 本例的分析结论

三个信息叠加指向自建 DERP 的配置问题:

1. **DERP 列表里只有一个自建节点("Myself Derper")** → tailnet 的 derpMap 大概率设置了 `OmitDefaultRegions: true`,屏蔽了官方 DERP
2. **UDP: false / IPv4 no addr found** → netcheck 的探测方式是向 DERP 服务器的 STUN 端口(**UDP 3478**)发包并等回显。唯一的 DERP 就是自建那台,所以这个结果更可能意味着**自建 derper 的 STUN 不通**(端口没放行或 derper 关了 STUN),而不一定是本机机房封 UDP
3. **STUN 不通的连锁反应**:节点发现不了自己的公网 IP:端口 → 无法交换端点信息 → 无法打洞 → 所有流量挤上这台 243ms 的中继 → 全 tailnet 延迟都高

区分"本机 UDP 被封"还是"derper STUN 不通"的快速方法:

```bash
dig @8.8.8.8 google.com +time=3
# 秒回 = 本机出站 UDP 正常,问题在 derper 端
# 超时 = 机房限制 UDP(廉价 VPS 常见),只能接受走中继
```

### 7.4 修复方向(本次选择接受现状,留档备查)

1. **derper 端放行 UDP 3478**(安全组 + 系统防火墙都要),确认 derper 启动参数没有 `--stun=false`
2. **derpMap 保留官方 region**:把 `OmitDefaultRegions` 改为 false,官方 DERP 作兜底,各节点就近选择;自建节点通过 region priority 仍可优先
3. **审视自建 DERP 的位置**:延迟 243ms 说明它离这批服务器很远。自建 DERP 若为国内加速,对海外机房(如本例 RackNerd 美国)反而是绕路
4. **两端都固定端口并放行 UDP**(见 4.3),给打洞创造条件

> 走中继只影响延迟,不影响功能。ssh、文件传输、内网服务全部可用,只是慢一点。

------

## 八、相关知识备忘

### 8.1 Docker 网段冲突(本次顺带发现的隐患)

docker0 默认占 `172.17.0.0/16`。本例阿里云服务器的 eth0 恰好是 `172.17.76.76`——在另一台装了 Docker 的机器上,发往这个地址的包会被本机 `172.17.0.0/16 dev docker0` 路由抢走,直接黑洞。

- 走 Tailscale 100.x 通信:**不受影响**
- 走内网 172.17.x 直连:**会出问题**

预防:`/etc/docker/daemon.json` 里设 `{"bip": "192.168.100.1/24"}` 后 `systemctl restart docker`,把 docker0 挪到冷门网段。

### 8.2 iptables 双体系

看到 `# Warning: iptables-legacy tables present` 时,规则分散在 nftables 和 legacy 两套体系,**都要查**:

```bash
iptables -L -n -v          # nft 这套
iptables-legacy -L -n -v   # legacy 这套
```

Tailscale 自己会写 `ts-input` / `ts-forward` / `ts-postrouting` 链(本例写在 legacy 表),属正常现象,不要误删。旧实例换端口后残留的旧端口放行规则(如本例的 35768)无害,强迫症可清。

### 8.3 容器方式 vs 宿主机直装

|            | 容器部署            | 宿主机直装                |
| ---------- | ------------------- | ------------------------- |
| 隔离性     | 好                  | —                         |
| 配置复杂度 | 高(本文所有坑)      | 低                        |
| 升级       | 换镜像重建          | `apt upgrade`             |
| 状态管理   | 要自己挂载好        | 自动 `/var/lib/tailscale` |
| 推荐场景   | NAS、不想污染宿主机 | 一般服务器                |

没有特殊理由时,服务器上直装更省心:

```bash
curl -fsSL https://tailscale.com/install.sh | sh && tailscale up
```

### 8.4 userspace 模式的正当用途

它不是"错误配置",而是为特定场景设计的:无特权容器(K8s sidecar)、不允许改网络栈的环境、只需对外暴露服务而无需主动出站的代理节点。只是**普通服务器要双向互联时不该用它**。

------

## 九、官方镜像常用环境变量参考

| 变量                       | 默认值  | 说明                                                  |
| -------------------------- | ------- | ----------------------------------------------------- |
| `TS_USERSPACE`             | `true`  | **本次问题的元凶**。内核模式必须显式设 false          |
| `TS_STATE_DIR`             | 空      | 状态目录,务必设置并配合 -v 持久化                     |
| `TS_AUTHKEY`               | 空      | 认证密钥,首次部署免交互登录用                         |
| `TS_EXTRA_ARGS`            | 空      | 追加给 `tailscale up` 的参数(如 `--reset`)            |
| `TS_TAILSCALED_EXTRA_ARGS` | 空      | 追加给 `tailscaled` 守护进程的参数(如 `--port=41641`) |
| `TS_ACCEPT_DNS`            | `false` | 是否接受 tailnet 的 DNS 配置                          |
| `TS_ROUTES`                | 空      | 广播的子网路由,逗号分隔                               |
| `TS_HOSTNAME`              | 空      | 节点在 tailnet 里的名字                               |
| `TS_AUTH_ONCE`             | `false` | 已登录时跳过重复认证                                  |

------

## 十、本次环境速查表

| 节点             | Tailscale IP    | 角色/备注                                                    |
| ---------------- | --------------- | ------------------------------------------------------------ |
| racknerd-5485552 | 100.127.72.36   | 本次修复对象。状态目录 `/storage/docker/doc-Tailscale/var/lib`;公网 IP 107.173.25.107;已修复✅ |
| aliyun-vps       | 100.107.52.70   | 阿里云,eth0=172.17.76.76(与 docker0 网段冲突);症状相同,**待修复**,同法处理 |
| alensmacbook-air | 100.126.244.116 | 正常客户端,可作验证目标                                      |
| ubuntu           | 100.111.57.50   | 修复后已验证互通✅                                            |
| Myself Derper    | —               | 自建 DERP,243ms,STUN 疑似不通(UDP 3478 待放行)               |

### 本次修复最终生效的完整命令(可直接复用)

```bash
docker rm -f tailscaled

docker run -d --name tailscaled \
  --restart unless-stopped \
  --network=host \
  --cap-add=NET_ADMIN \
  --device=/dev/net/tun:/dev/net/tun \
  -v /storage/docker/doc-Tailscale/var/lib:/var/lib \
  -e TS_USERSPACE=false \
  -e TS_STATE_DIR=/var/lib/tailscale \
  -e TS_EXTRA_ARGS=--reset \
  -e TS_ACCEPT_DNS=false \
  tailscale/tailscale
```

> 换机器使用时:① `-v` 路径改成该机的实际状态目录;② `--reset` 只在遇到 4.4 的报错时才需要;③ 修完跑一遍第六节验证清单。