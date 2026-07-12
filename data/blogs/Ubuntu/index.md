# ubuntu 开启 root 用户

### ✅ 方法一：设置 root 密码并启用登录

1. **以当前用户打开终端：**

   ```
   sudo passwd root
   ```

2. **输入你当前用户的密码后，会提示你为 root 设置新密码：**

   ```
   Enter new UNIX password:
   Retype new UNIX password:
   ```

   设置完成后，root 账户就启用了。

------

### ✅ 方法二：允许 root 使用 SSH 登录（不建议，风险较高）

如果你希望 **远程通过 SSH 登录 root**（出于特殊需求），还需要修改 SSH 配置：

1. 编辑 SSH 配置文件：

   ```
   sudo vim /etc/ssh/sshd_config
   ```

2. 找到并修改以下内容：

   ```
   #PermitRootLogin prohibit-password
   ```

   改为：

   ```
   PermitRootLogin yes
   ```

3. 重启 SSH 服务：

   ```
   sudo systemctl restart ssh
   ```

> ⚠️ **强烈建议不要开启 root 远程登录**，除非你非常清楚风险。推荐使用普通用户 + `sudo` 来操作。

------

### ✅ 切换为 root 用户

设置完密码后，你可以直接通过以下命令切换到 root：

```
su -
```

输入刚才设置的 root 密码即可登录 root shell。









# Cockpit：实现可视化组raid和升级raid

在你的需求下：

> ✅ 需要可视化
>  ✅ 可以 **不删除现有数据的情况下组 RAID**（尽可能保留）
>  ✅ 未来希望支持 **RAID 升级（如 RAID1 → RAID5）**
>  ✅ 对于图形界面有明确需求

------

## 🎯 最推荐的工具：**Cockpit + cockpit-storaged 插件**

### 🔧 为什么推荐 Cockpit？

1. **Cockpit 官方支持 RAID 管理（通过 `cockpit-storaged` 插件）**
   - 可视化组建 RAID0 / RAID1 / RAID5 / RAID6 / RAID10
   - 支持将已有硬盘添加为 RAID 成员（需满足 mdadm 的基本要求）
   - 可以监控状态、修复、移除硬盘等
   - 兼容 LVM、SMART 检测、文件系统管理
2. **不删除数据的能力：**
   - Cockpit 本身使用 Linux 的 `mdadm` 工具作为后端
   - 在某些情况下（如从单盘转 RAID1），可以做到 **逐步迁移数据**（不过是否会丢失数据还是取决于操作方式和 RAID 类型）
   - Cockpit 会在关键操作前有明确提示，并不会直接删除数据
3. **RAID 升级（如 RAID1 → RAID5）**
   - 这个本质上依赖于 `mdadm` 是否支持，Cockpit 只是封装操作
   - `mdadm` 支持在线从 RAID1 升级为 RAID5（加入硬盘后 reshape），Cockpit 在插件里也提供这一流程的图形化入口

------

## 🖼️ Cockpit RAID 管理界面示意：

Cockpit 在 **“存储”** 页签里会列出：

- 所有磁盘（包括未分区磁盘）
- 已存在的 RAID 阵列（md0、md1 等）
- 创建新 RAID（图形化选择磁盘 + RAID 类型）
- 管理 RAID：添加/移除磁盘、修复、重建等
- 支持文件系统创建、挂载、格式化（ext4/xfs 等）

------

## ✍️ 安装步骤（以 Ubuntu 为例）

```
sudo apt install cockpit cockpit-storaged -y
sudo systemctl enable --now cockpit
```

然后打开浏览器访问：

```
https://your-server-ip:9090
```

------

## ⚠️ 注意事项

1. **尽管 Cockpit 非常安全，但操作 RAID 仍要谨慎**，推荐：
   - 操作前手动备份数据
   - 阅读提示信息，Cockpit 在操作前会有确认界面
   - 添加磁盘时注意格式化提示
2. **不是所有 RAID 升级都不破坏数据**
   - RAID1 → RAID5 通常可以在线升级
   - RAID0 无法直接升级
   - RAID5 → RAID6 也需特定步骤

------

## 🆚 其他工具对比：

| 工具                              | RAID 组建                  | RAID 升级             | 可视化 | 推荐度         |
| --------------------------------- | -------------------------- | --------------------- | ------ | -------------- |
| **Cockpit** + storaged            | ✅ 支持                     | ✅ 支持 RAID1→RAID5 等 | ✅ 很好 | ⭐⭐⭐⭐⭐          |
| Webmin                            | ⚠️ 有支持，但较老旧，体验差 | ❌                     | ✅      | ⭐⭐             |
| mdadm + 命令行                    | ✅ 非常强                   | ✅ 但需手动操作        | ❌      | ⭐⭐⭐⭐（需高手） |
| Gnome Disks（gnome-disk-utility） | ✅ 支持简单 RAID            | ❌ 无升级功能          | ✅ 简洁 | ⭐⭐             |



------

## ✅ 总结：

> 对于你目前的需求（**可视化管理、数据不丢失地组 RAID、支持升级 RAID**）——
>  **首选工具就是 [Cockpit + cockpit-storaged]，并辅以 mdadm 技术支持。**





# cockplit：显示硬盘的健康度和温度

## ✅ 方法一：使用 `smartmontools` 搭配 Cockpit 插件

### 步骤 1：安装 `smartmontools`

这是一个用于查看硬盘健康状态（SMART）和温度的工具：

```
sudo apt update
sudo apt install smartmontools
```

你可以先测试一下某块硬盘的健康状态和温度：

```
sudo smartctl -a /dev/sda
```

------

### 步骤 2：安装 `cockpit-storaged` 插件

Cockpit 自带存储管理插件可以部分显示 SMART 状态，但依赖 `udisks2` 和 `smartd` 服务。

```
sudo apt install cockpit-storaged udisks2
sudo systemctl enable --now cockpit.socket
```

之后重启一次 Cockpit：

```
sudo systemctl restart cockpit
```

------

### 步骤 3：在浏览器中查看

1. 访问你的 Cockpit 页面：`https://<你的服务器IP>:9090`
2. 登录之后，点击左侧的 **“存储（Storage）”**
3. 你应该能看到磁盘列表，点击某块硬盘后，部分系统可能会显示 SMART 信息（如健康状态、温度等）

> ⚠️ 注意：某些发行版或者硬盘驱动可能不会直接显示温度，你可以通过 CLI 辅助查看（见下方方法二）

------

## ✅ 方法二：结合 CLI 工具显示温度信息

如果 Cockpit 中没有显示温度，你可以在终端运行如下命令：

```
sudo smartctl -A /dev/sda | grep Temperature
```

或者这样看得更清楚：

```
sudo hddtemp /dev/sda
```

如果你没有 `hddtemp`：

```
sudo apt install hddtemp
```







# Ubuntu 安装 Docker

## 1.安装

```
apt install docker.io
```

## 2.Pull镜像

```
sudo vi /etc/docker/daemon.json
```

```
{
    "registry-mirrors": [
        "https://docker.m.daocloud.io",
        "https://docker.1panel.live",
        "https://hub.rat.dev"
    ]
}
```

```
sudo service docker restart
```

## 3.删除

```
docker rm -f qBittorrent
```







# Ubuntu docker 安装 tailscale

## 🧾 如何使用 Tailscale Docker 镜像？

### ✅ 拉取镜像（任选其一）

```
docker pull tailscale/tailscale:latest
# 或者
docker pull ghcr.io/tailscale/tailscale:latest
```

------

## 🧰 常用环境变量说明（简洁版）

| 环境变量        | 作用                      | 示例                                                         |
| --------------- | ------------------------- | ------------------------------------------------------------ |
| `TS_AUTHKEY`    | 登录认证用的 auth key     | `tskey-xxxxx`（从 https://login.tailscale.com/admin/settings/authkeys 获取） |
| `TS_EXTRA_ARGS` | `tailscale up` 的附加参数 | `--advertise-tags=tag:mytag`                                 |
| `TS_STATE_DIR`  | 状态持久化目录（重要！）  | `/var/lib/tailscale`                                         |
| `TS_USERSPACE`  | 是否启用 userspace 模式   | `false`（建议禁用，使用 kernel tun 网络）                    |
| `TS_HOSTNAME`   | 节点显示的名字            | `tailscale-nginx`                                            |



------

## 🚀 示例：Docker Compose 部署（推荐）

这是一个完整的示例，Tailscale 与 Nginx 共用网络：

```
version: "3.7"
services:
  tailscale-nginx:
    image: tailscale/tailscale:latest
    hostname: tailscale-nginx
    environment:
      - TS_AUTHKEY=tskey-xxx  # 你的 Tailscale Auth Key
      - TS_EXTRA_ARGS=--advertise-tags=tag:container
      - TS_STATE_DIR=/var/lib/tailscale
      - TS_USERSPACE=false
    volumes:
      - ./tailscale-state:/var/lib/tailscale
    devices:
      - /dev/net/tun:/dev/net/tun
    cap_add:
      - NET_ADMIN
    restart: unless-stopped

  nginx:
    image: nginx
    depends_on:
      - tailscale-nginx
    network_mode: service:tailscale-nginx
```

> 🔒 提示：
>
> - `TS_USERSPACE=false` 可以让 Tailscale 用系统内核的网络，性能更好（但需要容器启用 `/dev/net/tun` 和 `NET_ADMIN` 权限）
> - `network_mode: service:tailscale-nginx` 让 nginx 和 tailscale 共用同一网络接口（适合隐藏 nginx，只通过 Tailscale 访问）

------

## 📦 启动方式

```
docker compose up -d
```

首次启动后，这个容器就会作为一个 Tailscale 节点加入你的 Tailnet 网络。

------

## ❗注意事项

1. **auth key 有效期有限**，建议勾选“Reusable”选项。

2. **状态目录必须挂载到宿主机**，否则每次重启都会失去连接。

3. 若你不希望一直用 `authkey` 登录，也可以：

   ```
   docker exec -it tailscale-nginx tailscale up
   ```

   然后用浏览器手动登录认证。









# Ubuntu 安装 docker compose

## ✅ 前提条件

确保已经安装好 Docker Engine：

```
docker --version
```

如果没有安装 Docker，可执行以下命令安装：

```
sudo apt update
sudo apt install -y docker.io
sudo systemctl enable docker
sudo systemctl start docker
```

------

## 🧩 安装 Docker Compose（v2）

Docker Compose v2 是 **作为插件集成在 Docker CLI** 中的，不再是单独的 `docker-compose` 命令。

### 安装命令：

```
sudo apt update
mkdir -p ~/.docker/cli-plugins/
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
```

------

## 📦 验证安装是否成功

```
docker compose version
```

注意这里是 **`docker compose`**（没有中划线），不是旧版的 `docker-compose`。

------





# 使用Nvidia

### 步骤 1：清理已有驱动（可选）

```
sudo apt purge nvidia*
```

------

### 步骤 2：启用官方驱动源并安装推荐驱动

```
sudo ubuntu-drivers devices
```

![image-20250617010430679](/blogs/Ubuntu/814624e870c08cae.png)



从你的输出来看，系统已经正确识别了你的 **GTX 1030** 显卡，并且推荐你安装：

> ✅ `nvidia-driver-550`（**recommended**）

------

## ✅ 建议你安装这个推荐驱动：

```
sudo apt install nvidia-driver-550
sudo reboot
```

------

## 🧪 安装后验证是否成功

重启后，请运行：

```
nvidia-smi
```

如果输出如下类似内容：

```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 550.xx     Driver Version: 550.xx     CUDA Version: 12.x        |
| GPU       Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr.|
| 0  GeForce GT 1030     Off | 00000000:02:00.0  On |                  N/A |
| Fan  Temp  Perf  Pwr:Usage/Cap| Memory-Usage | GPU-Util  Compute M. |
+-----------------------------------------------------------------------------+
```

说明驱动安装成功，显卡正常运行。





# 安装 Universal Media Server

### 1. 安装 Java 运行环境（UMS 需要 Java）

```
sudo apt update
sudo apt install openjdk-8-jre -y
```



你也可以用 OpenJDK 11，如果兼容性有问题。

### 2. 下载 Universal Media Server 最新版本

访问官网：[Universal Media Server](https://www.universalmediaserver.com/)

找到 Linux 安装包的下载链接（`.tar.gz`），或者使用 `wget` 下载。例如：

```
wget https://github.com/UniversalMediaServer/UniversalMediaServer/releases/download/14.12.1/UMS-Linux-14.12.1-x86_64.tgz
```



（把 `<version>` 替换为版本号）

### 3. 解压和运行

```
sudo apt install libmediainfo0v5 libzen0v5
tar -xvzf UMS-Linux-14.12.1-x86_64.tgz -C /storage/model/
cd /storage/model/ums-14.12.1
./UMS.sh
```

首次运行会打开 GUI 配置界面，如果你是纯命令行服务器，可以用 `-Djava.awt.headless=true` 方式运行（无头模式）。

### ✅ **方式一：在运行脚本时添加 Java 参数**

编辑 `UMS.sh` 脚本，将 `java` 命令添加 `-Djava.awt.headless=true` 参数：

1. 打开脚本：

   ```
   vim UMS.sh
   ```

2. 找到包含 `java` 的启动行，比如：

   ```
   java -Xmx... -Dums.profile.directory=...
   ```

3. 在启动参数中加上：

   ```
   java -Djava.awt.headless=true -Xmx... -Dums.profile.directory=...
   ```

4. 保存并退出，然后运行：

   ```
   ./UMS.sh
   ```

------

## 🛠 三、设置媒体目录

你需要指定哪些文件夹是媒体库：

1. 在第一次运行 UMS 后，会生成配置文件在 `~/.config/UMS/UMS.conf`
2. 你可以手动编辑：

```
vim ~/.config/UMS/SHARED.conf
```



## ✅ 方法一：使用 `systemd` 创建服务（推荐方式，适用于大多数 Linux 发行版）

这是最稳定和现代的方式，适合长期运行的服务。

### 1. 创建 systemd 服务文件

以 root 权限创建一个服务文件：

```
sudo vim /etc/systemd/system/ums.service
```

### 2. 写入以下内容（请根据你的实际路径修改）

```
[Unit]
Description=Universal Media Server
After=network.target

[Service]
User=root
WorkingDirectory=/storage/model/ums-14.12.1
ExecStart=/bin/bash /storage/model/ums-14.12.1/UMS.sh
Restart=always
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

> ⚠️ 注意：
>
> - 修改 `WorkingDirectory` 和 `ExecStart` 中的路径为你的实际安装位置。
> - 如果你不是用 `root` 用户运行，请将 `User=` 改为普通用户，比如 `User=yourusername`

### 3. 重新加载 systemd 并启用服务

```
sudo systemctl daemon-reexec
sudo systemctl enable ums --now
sudo systemctl start ums
```

### 4. 检查状态是否运行正常

bash深色版本

```
sudo systemctl status ums
```

如果看到 `active (running)` 就说明设置成功了！



------

## 🔁 四、Windows 端访问方式

UMS 是基于 DLNA/UPnP，不是 SMB。但你可以搭配使用：

| 目标                                 | 方法                                                |
| ------------------------------------ | --------------------------------------------------- |
| **Windows 浏览器访问 UMS 控制台**    | 打开浏览器访问 `http://<服务器IP>:9001`（默认端口） |
| **电视、手机、播放器访问 DLNA 服务** | 通过网络自动发现（如 VLC、智能电视）                |
| **Windows 映射媒体文件夹（SMB）**    | 需在服务器上配置 `Samba`，单独分享媒体文件夹        |



------

## ✅ 可选：配置 Samba 分享媒体文件夹（SMB）

如果你想让 Windows 能“映射网络驱动器”访问视频文件，可以这样配置：

### 安装 Samba：

```
sudo apt install samba -y 
```



### 编辑配置：

```
sudo vim /etc/samba/smb.conf 
```



在文件末尾添加：

```
[file]
   comment = file
   path = /storage/file
   writable = yes
   available = yes
   browseable = yes
   public = no
   guest ok = no
   valid users = root
```

**给 Samba 用户设置密码：**

```css
sudo smbpasswd -a root
sudo smbpasswd -e root
sudo chown -R root:root /storage/file
sudo chmod -R 755 /storage/file
```

**重新加载单元文件**:

```cobol
sudo systemctl daemon-reload
```

**重启 Samba 服务：**

```
sudo systemctl restart smbd 
```

**查看共享状态**:

```undefined
smbstatus
```

现在在 Windows 里输入 `\\服务器IP\Videos` 即可访问（可映射为 Z: 盘）。

------

## 💡 总结

| 功能                   | 工具                                              |
| ---------------------- | ------------------------------------------------- |
| UMS 影视服务器（DLNA） | Universal Media Server                            |
| Windows、电视等播放    | 使用支持 DLNA 的客户端，如 VLC、智能电视、PS/Xbox |
| Windows 文件夹访问     | 配合 Samba 设置 SMB 共享                          |





# Ubuntu 下配置 UMS 使用 NVIDIA GPU 解码



## 📦 第 1 步：安装 NVIDIA 驱动（如已安装可跳过）

运行以下命令确认：

```ini
nvidia-smi
```

输出示例如下说明正常：

```php
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 535.113.01    Driver Version: 535.113.01    CUDA Version: 12.2  |
```

如果提示找不到命令或驱动无效，请安装驱动：

```
sudo ubuntu-drivers devices
sudo ubuntu-drivers autoinstall
sudo reboot
```

重启后再次运行 `nvidia-smi` 验证。

------

## 🛠️ 第 2 步：安装支持 NVENC 的 FFmpeg

默认 Ubuntu 的 `apt install ffmpeg` 并**不支持** GPU 编解码，所以我们用 PPA 安装增强版。

```
sudo add-apt-repository ppa:savoury1/ffmpeg4 -y
sudo apt update
sudo apt install ffmpeg -y
```

安装后，验证 GPU 支持：

```
ffmpeg -encoders | grep nvenc
```

应输出：

```
 V..... h264_nvenc           NVIDIA NVENC H.264 encoder (codec h264)
```

------

## 🔧 第 3 步：配置 UMS 使用 GPU 解码

### 📁 创建配置文件 `/root/.config/UMS/ffmpeg.conf`

```
vim /root/.config/UMS/ffmpeg.conf
```

粘贴以下内容：

```
FFmpegVideoSettings = -threads 0 -hwaccel cuda -hwaccel_output_format cuda -c:v h264_cuvid -i %input% -c:v h264_nvenc -preset p3 -b:v 5M -maxrate 8M -bufsize 10M -f mpegts -loglevel fatal -
```

------

## 📑 第 4 步：确保 `UMS.conf` 设置正确

编辑：

```
vim /root/.config/UMS/UMS.conf
```

添加或确认以下内容存在：

```ini
# 强制启用 FFmpeg 解码和编码
ffmpeg=true
ffmpeg_encode=true
ffmpeg_remux=true

# 设定转码时视频和音频都使用 FFmpeg
TranscodeVideo=FFmpeg
TranscodeAudio=FFmpeg

# 设定首选 GPU 解码方法（推荐设置为 auto 或 cuda）
ffmpeg_gpu_decoding_method=cuda
```

保存退出。

------

## 🔄 第 5 步：重启 UMS

用 systemd 启动：

```
systemctl restart ums
```

------

## ✅ 第 6 步：验证是否使用 GPU 解码

使用命令查看 FFmpeg 是否占用显卡：

```
watch -n 1 nvidia-smi
```

你应该看到如下进程：

```
| 12345   ffmpeg   C   300MiB |
```

表示 GPU 解码已启用成功。

------

## 📌 补充建议

| 项目                | 建议值                                |
| ------------------- | ------------------------------------- |
| `-preset`           | `p3` 表示均衡速度和质量，`p1` 更快    |
| `-b:v`              | 控制输出比特率，`4M ~ 8M` 适合 1080p  |
| `-maxrate -bufsize` | 控制码率波动，建议设为 `2x` 和 `1.5x` |
| 音频                | 默认不用 GPU，加 `-c:a aac` 即可      |















# 安装qBittorrent

### ✅ 方法三：安装 qBittorrent-nox（无图形界面，适合服务器）

如果你在服务器上运行 Ubuntu，不需要图形界面，可以用这个版本，它支持 Web UI 控制。

1. **安装**

```
sudo apt install qbittorrent-nox
```

1. **运行 Web UI 模式**

```
qbittorrent-nox
```

首次运行会提示你设置 Web UI 登录密码（默认用户名是 `admin`，密码是 `adminadmin`，可以之后在设置中更改）。

------

### 🔧 可选：设置为 systemd 服务（服务器部署常用）

你可以创建一个 systemd 服务文件，自动启动：

```ini
sudo vim /etc/systemd/system/qbittorrent.service
```

粘贴以下内容（假设你用的是当前用户）：

```ini
[Unit]
Description=qBittorrent Command Line Client
After=network.target

[Service]
User=ubuntu
ExecStart=/usr/bin/qbittorrent-nox
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

然后启用服务：

```
sudo systemctl daemon-reexec
sudo systemctl enable --now qbittorrent
```

------

如需配置 Web 界面，访问：

```
http://你的服务器IP:8080
```











# AutoBangumi的使用

## 1.查找可以pull的版本

```
curl -s "https://registry.hub.docker.com/v2/repositories/superng6/qbittorrent/tags?page_size=100" | jq '.results[].name'


curl -s "https://registry.hub.docker.com/v2/repositories/estrellaxd/auto_bangumi/tags?page_size=100" \
  | jq '.results[].name'
```



### 2.编写docker-compose.yml

```yaml
version: '3.9'
x-logging: &logging
  logging:
    driver: json-file
    options:
      max-size: 100m
      max-file: "3"
      tag: '{{.ImageName}}|{{.Name}}|{{.ImageFullID}}|{{.FullID}}'

services:
  qbittorrent:
    container_name: qBittorrent
    <<: *logging
    environment:
      - TZ=Asia/Shanghai
      - TemPath=/downloads
      - SavePath=/downloads
      - PGID=1000 # 改动
      - PUID=1000 # 改动
      - WEBUI_PORT=8082
    volumes:
      - /storage/docker/AutoBangumi/qBittorrent/config:/config # 改动
      - /storage/media/videos/:/downloads # 改动
    ports:
      - "0.0.0.0:8082:8082"
      - "0.0.0.0:6881:6881"
      - "0.0.0.0:6881:6881/udp"
    networks:
      - auto_bangumi
    restart: unless-stopped
    image: superng6/qbittorrent:4.5.1_v2.0.8
    
  auto_bangumi:
    container_name: AutoBangumi
    <<: *logging
    environment:
      - TZ=Asia/Shanghai
      - PGID=1026 # 改动
      - PUID=100 # 改动
      - AB_DOWNLOADER_HOST=https://127.0.0.1:8082
      - AB_NOT_CONTAIN=720|\d+-\d+
      - AB_EP_COMPLETE=true
      - AB_GROUP_TAG=true
      - AB_DEBUG_MODE=true
      - AB_RSS=https://mikanani.me/RSS/MyBangumi?token=t1llnq9te3Y0%2bm%2fS%2fuzrBH%2bSLqEdBrJTa1KmgH2SbcM%3d
    volumes: # 改动
      - /storage/docker/AutoBangumi/AutoBangumi/config:/app/config 
      - /storage/docker/AutoBangumi/AutoBangumi/data:/app/data 
    networks:
      - auto_bangumi
    ports:
      - "0.0.0.0:7892:7892"
    dns:
      - 8.8.8.8
      - 114.114.114.114
    restart: unless-stopped
    image: estrellaxd/auto_bangumi:3.0.1
    depends_on:
      - qbittorrent

  plex:
    container_name: Plex
    <<: *logging
    network_mode: host
    environment:
      - HOSTNAME=Plex-Ubuntu-Server
      - TZ=Asia/Shanghai
      - PUID=1026 # 改动
      - PGID=100 # 改动
      - VERSION=docker 
      - ADVERTISE_IP=http://0.0.0.0:32400/
      - PLEX_CLAIM=claim-ghDyJNRhLKazuwFgpchb
    ports:
      - "0.0.0.0:32400:32400"
    volumes:
      - /storage/docker/AutoBangumi/plex/config:/config # 改动
      - /storage/docker/AutoBangumi/plex/transcode:/transcode # 改动
      - /storage/media/videos/:/media/ # 改动
    restart: unless-stopped
    image: linuxserver/plex:1.32.1

networks:
  auto_bangumi:

volumes:
  qb_config:
    external: false
  bangumi_config:
    external: false
  bangumi_data:
    external: false
  plex_config:
    external: false
  plex_transcode:
    external: false
```



### 3.创建docker文件夹

进入 docker 文件夹

```bash
cd /storage/docker/
```

进入你创建的 Au­to­Bangumi 文件夹

```bash
mkdir AutoBangumi
```

嘛，你也可以一步到位

```bash
cd /storage/docker/AutoBangumi
```

将写好的docker-compose.yml上传



### 4.使用docker-compose.yml

**注意一定要在 `docker-compose.yml` 文件所在的目录下，才可以执行 `docker compose` 命令！**

启动 Au­to­Bangumi & qBit­tor­rent：

```
docker compose up -d
```



# 设置定时关机

## ✅ 使用 `crontab` 定时关机（适合每天定时关机）

1. 编辑 root 的 crontab：

```
sudo crontab -e
```

1. 添加定时任务，例如每天 22:30 关机：

```
30 23 * * * /sbin/shutdown -h +10 "系统将在10分钟后关机，请保存数据。"
```





# 降低待机功耗

## ✅ 一、启用系统电源管理功能（默认已启用）

Ubuntu 默认内核已启用大多数节能机制，但你可以检查或增强以下设置：

### 1.1 使用 `TLP` 节能工具（推荐）

TLP 是专门为 Linux 开发的电源管理工具，适用于笔记本和桌面。

🔧 安装：

```
sudo apt update
sudo apt install tlp tlp-rdw
```

🔌 启用：

```
sudo tlp start
```

👀 查看状态：

```
sudo tlp-stat -s
```

📌 TLP 会根据电池/交流电自动调整 CPU、磁盘、电源等设置，适合长期运行、静默优化。

**进入省电模式（Battery 模式）**

```
sudo tlp bat
sudo tlp-stat -s
Mode           = BAT
```

**打开配置文件**:

```
sudo vim /etc/tlp.conf
```

```ini
# 电源模式设置
TLP_DEFAULT_MODE=BAT # 即使当前系统连接的是交流电源（AC），TLP 也会按照电池供电模式下的策略进行电源管理（例如节能更强、限制性能等）。
TLP_PERSISTENT_DEFAULT=1 # 启用“持久化默认模式”，即一旦设置了 TLP_DEFAULT_MODE（如上面的 BAT），该设置将一直有效，不会因为电源切换而自动恢复。

# CPU 调频策略（省电为主）
CPU_SCALING_GOVERNOR_ON_AC=powersave
CPU_SCALING_GOVERNOR_ON_BAT=powersave

# 启用 PCI Express 节能
PCIE_ASPM_ON_AC=powersave
PCIE_ASPM_ON_BAT=powersave

# USB 自动挂起
USB_AUTOSUSPEND=1

# 启用 NVMe 节电模式
NVMHCI_RUNTIME_PM_ON_BAT=auto
NVMHCI_RUNTIME_PM_ON_AC=auto

# 硬盘空闲自动停转
DISK_IDLE_SECS_ON_BAT="600"
```

CPU调节器设置为“powersave”模式

并自动挂起未使用的USB端口

**重启TLP服务**:

```
sudo systemctl restart tlp
```

查看详细节电状态

```
sudo tlp-stat -b
sudo tlp-stat -c
sudo tlp-stat -d
sudo tlp-stat -u
```

查看电池状态、CPU 状态、磁盘电源管理、USB 设备节电状态

**查看当前硬盘状态**

```
sudo hdparm -C /dev/sda
```



------

## ✅ 二、设置挂起/睡眠规则（空闲自动待机）

在桌面环境中（如 GNOME）：

1. 打开“设置” > “电源”
2. 设置 “自动待机时间”、“关闭显示器时间”

### 或者使用命令行设置（以 GNOME 为例）：

```
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-timeout 600
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'suspend'
```

意思是：**空闲 10 分钟后挂起**

------

## ✅ 四、调低 CPU 频率或使用省电模式

Ubuntu 默认调度器支持 `intel_pstate` 或 `cpufreq`，你可以手动设置：

```
sudo apt install cpufrequtils
```

查看可用调节器：

```
cpufreq-info
```

设置为省电模式：

```
sudo cpufreq-set -g powersave
```

------

## ✅ 六、BIOS/UEFI 层面设置（高阶）

- 启用 C-States 节能
- 启用 S3 Suspend 支持
- 关闭未用设备（如串口、声卡、SATA 空口）

------

## 📊 总结优化清单

| 优化点       | 方法                                       |
| ------------ | ------------------------------------------ |
| 自动电源管理 | 安装 TLP，使用 PowerTOP                    |
| 自动挂起     | 设置 GNOME 电源策略或使用 `gsettings` 命令 |
| 硬件控制     | 关闭蓝牙、WiFi、降低亮度                   |
| CPU 节能     | 使用 `cpufreq-set -g powersave`            |
| 挂起脚本     | 使用 `systemd/system-sleep` 自定义行为     |
| BIOS 优化    | 启用节能模式，关闭无用接口                 |











# 连接U盘

在Ubuntu Server环境下连接U盘，通常需要通过命令行进行操作。以下是基本步骤：

1. **插入U盘**：首先将U盘插入服务器的USB端口。

2. **查找U盘设备名称**：

   - 可以使用`lsblk`或`fdisk -l`命令查看所有连接的存储设备及分区情况。新插入的U盘应该会出现在列表中。注意区分U盘和其他硬盘的标识符，通常是类似`/dev/sdb1`、`/dev/sdc1`这样的形式。

   - 例如：

     ```
     lsblk
     ```

     或者

     ```
     sudo fdisk -l
     ```

3. **创建挂载点并挂载U盘**：

   - 创建一个目录作为挂载点。比如，创建一个名为`usbdrive`的目录：

     ```
     sudo mkdir /storage/usbdrive/
     ```

   - 使用`mount`命令挂载U盘到该目录。请确保替换`/dev/sdX1`为你的U盘实际的设备名称。

     ```
     sudo mount /dev/sdd1 /storage/usbdrive/
     ```

4. **访问U盘内容**：

   - 挂载完成后，你可以像访问普通目录一样访问U盘中的文件了：

     ```
     cd /storage/usbdrive/
     ls
     ```

5. **卸载U盘**：

   - 在拔出U盘之前，你应该使用`umount`命令卸载U盘以确保所有数据都被正确写入并避免数据损坏：

     ```
     sudo umount /storage/usbdrive/
     ```

请注意，如果U盘是NTFS格式的，你可能需要安装额外的软件包来支持读写操作：

```
sudo apt-get update
sudo apt-get install ntfs-3g
```

此外，如果你希望每次系统启动时自动挂载特定的U盘，可以编辑`/etc/fstab`文件来实现这一目的。不过这需要更小心地处理，以免造成系统问题。





# 复制数据

```ini
cp -rv * ../01-storage/00-USB/
```







# docker 安装 tailscale

**🧾 如何使用 Tailscale Docker 镜像？**
网址：https://tailscale.com/kb/1282/docker#parameters

**✅ 拉取镜像（任选其一）**

```
docker pull tailscale/tailscale:latest 

# 或者 

docker pull ghcr.io/tailscale/tailscale:latest 
```



**每90天密钥更换一次**

```
docker run -d \
--name=tailscaled \
--network=host \
-v /storage/docker/doc-Tailscale/var/lib:/var/lib \
-v /storage/docker/doc-Tailscale/dev/net/tun:/dev/net/tun \
-e TS_AUTHKEY=tskey-auth-kbDzbD1T3B21CNTRL-LNaQrRsSAx8hCcfHqdayx8R2HrnrEQxGe \
-e TS_ROUTES=0.0.0.0/24 \
-e TS_STATE_DIR=/var/lib/tailscale \
--cap-add=NET_ADMIN \
--cap-add=NET_RAW \
--restart unless-stopped \
tailscale/tailscale
```















# 安装MiniDLNA

## ✅ 最推荐：**MiniDLNA（ReadyMedia）**

### 步骤如下：

#### ① 安装 MiniDLNA

```
sudo apt update
sudo apt install minidlna
```

#### ② 配置 `/etc/minidlna.conf`

```
sudo vim /etc/minidlna.conf
```

修改以下几个字段（假设你想共享 `/srv/share`）：

```
media_dir=/storage/media/videos/
friendly_name=MyMediaServer
inotify=yes
port=8200
db_dir=/var/cache/minidlna
log_dir=/var/log
```

#### ③ 创建共享目录并设置权限：

```
sudo mkdir -p /storage/media/videos/
sudo chmod -R 755 /storage/media/videos/
```

#### ④ 启动服务：

```
sudo systemctl enable minidlna
sudo systemctl restart minidlna
```

#### ⑤ 防火墙开放端口（如使用 UFW）

```
sudo ufw allow 8200
sudo ufw allow 1900/udp
```







# 部署Online java compiler——Judge0

## ✅ 一、前提条件

请确认你已安装：

```
sudo apt update
sudo apt install docker.io docker-compose git -y
```

------

## ✅ 二、克隆 Judge0 项目

```
git clone https://github.com/judge0/judge0.git
cd judge0
```

------

## ✅ 三、配置 Judge0 后端服务

### 1. 编辑 `.env` 文件（可选）

```
cp .env.example .env
```

可以配置执行超时、内存等，但默认配置就可以运行。

------

### 2. 启动 Judge0 后端服务

```
docker-compose up -d
```

Judge0 后端服务包括：

- Core API
- Workers（用于执行代码）
- Postgres（用于存储任务）
- Redis（缓存）
- Optional: RapidAPI 支持

------

### 3. 检查服务是否启动成功

```
docker ps
```

你应该看到如下容器：

```
judge0-api
judge0-worker
judge0-db
judge0-redis
```

------

## ✅ 四、安装前端界面（可选）

你可以部署 Judge0 官方的前端或自己写一个界面调用 API。

### 方式一：部署官方前端（推荐）

```
cd ..
git clone https://github.com/judge0/judge0-frontend.git
cd judge0-frontend
```

编辑 `src/config.js` 中的 API 地址：

```
export const API_BASE_URL = "http://your-server-ip:3000";
```

然后启动：

```
docker build -t judge0-frontend .
docker run -d -p 62001:80 judge0-frontend
```

访问：http://your-server-ip:62001

------

## ✅ 五、如何调用 API（示例）

### 1. 创建代码提交（POST）

```
curl -X POST https://<your-ip>:3000/submissions/?base64_encoded=false \
  -H "Content-Type: application/json" \
  -d '{
    "language_id": 62,
    "source_code": "public class Main { public static void main(String[] args) { System.out.println(\"Hello from Java\"); } }"
  }'
```

Java 的 `language_id` 是 `62`（OpenJDK 17）。

### 2. 获取结果（GET）

假设返回 submission token 为 `abcd1234`：

```
curl https://<your-ip>:3000/submissions/abcd1234?base64_encoded=false
```

------

## ✅ 六、可选设置（绑定域名、HTTPS、限制语言等）

- 使用 Nginx 做反向代理，绑定 HTTPS：

```
server {
    listen 80;
    server_name compiler.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

- 配置 HTTPS：使用 Certbot 免费证书即可

```
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx
```

------

## ✅ 七、Docker Compose 版本（可选合并一键部署）

如果你希望前后端都用 Docker Compose 一键部署，我也可以帮你写一个合并的 `docker-compose.yml` 文件。

------

## ✅ 总结

| 功能       | 状态                          |
| ---------- | ----------------------------- |
| Java 编译  | ✅ 默认支持（language_id: 62） |
| 多语言支持 | ✅                             |
| 前端界面   | ✅（可选部署）                 |
| API 调用   | ✅                             |
| 本地部署   | ✅ 无需第三方依赖              |



------









# 安装MySQL

## ✅ 第一步：安装 MySQL Server

在你的 Ubuntu 服务器上执行：

```
sudo apt update
sudo apt install mysql-server -y
```

安装完成后，确认服务正常运行：

```
sudo systemctl status mysql
```

如果显示 `active (running)`，说明成功运行。

------

## ✅ 第二步：设置 root 密码并进行安全初始化（可选但推荐）

执行：

```
sudo mysql_secure_installation
```

按照提示操作：

1. 设置 root 密码（MySQL 用户的 root，和系统 root 无关）
2. 是否移除匿名用户：输入 `Y`
3. 是否禁止 root 远程登录：**输入 `N`（如果你想远程使用 root）**
4. 是否移除测试数据库：输入 `Y`
5. 是否重新加载权限表：输入 `Y`

------

## ✅ 第三步：允许远程访问 MySQL

### 1. 修改配置文件

编辑 MySQL 配置文件：

```
sudo vim /etc/mysql/mysql.conf.d/mysqld.cnf
```

找到这行：

```
bind-address = 127.0.0.1
```

改成：

```
bind-address = 0.0.0.0
```

保存并退出（Ctrl+O，回车，Ctrl+X）。

### 2. 重启 MySQL 服务

```
sudo systemctl restart mysql
```

------

## ✅ 第四步：创建远程用户并授权

默认登录 MySQL：

```
sudo mysql
```

创建用户并授权（以用户名 `myuser`，密码 `mypassword` 为例）：

```
-- 创建新用户允许远程访问
CREATE USER 'U_mysql'@'%' IDENTIFIED WITH mysql_native_password BY 'Aa@123456';

-- 给这个用户对所有数据库的全部权限（你可以限定为某个库）
GRANT ALL PRIVILEGES ON *.* TO 'U_mysql'@'%';

-- 刷新权限
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

------

## ✅ 第五步：开放防火墙端口

如果你使用的是 `ufw` 防火墙，执行：

```
sudo ufw allow 3306
```

> 如果用的是云服务器（如腾讯云、阿里云、AWS），还需要登录管理后台，开放安全组的 3306 端口。

------

## ✅ 第六步：从客户端远程连接测试

### 命令行连接方式：

```
mysql -h 192.168.50.197 -P 3306 -u U_mysql -p
```

### 图形化工具（如 DBeaver、Navicat）设置：

- Host/IP：服务器公网 IP
- Port：3306
- Username：myuser
- Password：mypassword
- Database：可选（或手动选择）







# Ubuntu 安装 Redis

## ✅ 一、更新系统包索引

```
sudo apt update
```

------

## ✅ 二、安装 Redis

Ubuntu 自带的 APT 软件源中就有 Redis，你可以直接通过以下命令安装：

```
sudo apt install redis-server
```

安装过程中会自动安装 Redis 所需的依赖。

------

## ✅ 三、检查 Redis 是否安装成功

### 1. 查看版本：

```
redis-server --version
```

### 2. 启动 Redis 服务：

```
sudo systemctl start redis
```

### 3. 设置 Redis 开机启动（可选）：

```
sudo systemctl enable redis-server
```

------

## ✅ 四、测试 Redis 是否正常运行

你可以使用 Redis 自带的命令行客户端进行测试：

```
redis-cli
```

然后你会进入交互界面，尝试运行命令：

```
ping
```

如果返回：

```
PONG
```

说明 Redis 正常运行。

------

## ✅ 五、允许远程访问（可选）

默认情况下 Redis 只监听 `127.0.0.1`（本地访问），如果你希望远程访问：

1. 修改配置文件：

```
sudo vim /etc/redis/redis.conf
```

找到这行：

```
bind 127.0.0.1 -::1
```

改为（允许所有 IP 访问）：

```
bind 0.0.0.0
```

并将 `protected-mode yes` 改为：

```
protected-mode no
```

1. 重启 Redis 服务：

```
sudo systemctl restart redis
```

1. 放行 6379 端口（默认 Redis 端口）：

如果使用的是 UFW 防火墙：

```
sudo ufw allow 6379
```

------

## ✅ 六、安全建议（远程访问时）

如果你开启了远程访问，建议：

- 设置密码验证：在 `redis.conf` 中添加：

```
requirepass Aa@123456
```

- 配置防火墙规则，只允许特定 IP 访问。











# 部署Portainer

### 1. 创建Portainer存储卷

```
sudo docker volume create portainer_data
```

- **功能**：创建一个名为`portainer_data`的Docker卷。
- **作用**：这个卷将用于持久化存储Portainer的数据，确保即使在容器重启或删除后，数据也不会丢失。

### 2. 使用Docker部署Portainer

```
sudo docker run -d -p 10001:8000 -p 10002:9443 --name portainer --restart=always -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:lts
```

- **`-d`**：以分离模式（后台）运行容器。
- **`-p 10001:8000 -p 10002:9443`**：将主机的10001端口和10002端口分别映射到容器的相同端口。这意味着你可以通过访问主机的这些端口来访问Portainer的服务。
- **`--name portainer`**：为容器指定一个名称，这里是`portainer`，便于管理和识别。
- **`--restart=always`**：设置容器的重启策略为总是重启，这意味着如果容器停止（无论是正常退出还是异常终止），Docker会自动重启它。
- **`-v /var/run/docker.sock:/var/run/docker.sock`**：将主机的Docker套接字文件挂载到容器中相同的路径。这允许Portainer直接与Docker守护进程通信，从而管理主机上的Docker资源。
- **`-v portainer_data:/data`**：将之前创建的`portainer_data`卷挂载到容器的`/data`目录，用于存储Portainer的数据。
- **`portainer/portainer-ce:lts`**：指定要使用的Portainer镜像，这里是社区版的长期支持版本。





# Dockers 安装 Plex

### 1.让docker使用GPU

```shell
# 添加 NVIDIA Docker 仓库
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
  | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
  | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# 更新软件源
sudo apt update

# 安装工具包
sudo apt install -y nvidia-container-toolkit
```

然后运行：

```
sudo nvidia-ctk runtime configure --runtime=docker
```

再

```
sudo systemctl restart docker
```

验证是否生效：

```
docker info | grep -i runtime
```

你应看到：

```
Runtimes: nvidia runc
Default Runtime: runc
```



**测试可用性**

执行：

```
docker run --rm --runtime=nvidia nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
```

如果能成功输出 GPU 信息：

```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 550.144.03 ...
```





### 2.修改 `docker-compose.yml`

```yaml
version: '3.9'

x-logging: &logging
  logging:
    driver: json-file
    options:
      max-size: 100m
      max-file: "3"
      tag: '{{.ImageName}}|{{.Name}}|{{.ImageFullID}}|{{.FullID}}'

services:
  plex:
    container_name: Plex
    <<: *logging
    network_mode: host
    environment:
      - HOSTNAME=Plex-Ubuntu-Server
      - TZ=Asia/Shanghai
      - PUID=1026
      - PGID=100
      - VERSION=docker
      - ADVERTISE_IP=http://0.0.0.0:32400/
      - PLEX_CLAIM=claim-ghDyJNRhLKazuwFgpchb
      # 让 Plex 能识别 NVIDIA GPU
      - NVIDIA_VISIBLE_DEVICES=all
      - NVIDIA_DRIVER_CAPABILITIES=compute,video,utility
    ports:
      - "32400:32400"
    volumes:
      - /storage/docker/AutoBangumi/plex/config:/config
      - /storage/docker/AutoBangumi/plex/transcode:/transcode
      - /storage/media/videos/:/media/
    restart: unless-stopped
    image: linuxserver/plex:1.32.1
    runtime: nvidia
    devices:
      - /dev/dri:/dev/dri

volumes:
  plex_config:
    external: false
  plex_transcode:
    external: false

```

| 部分                                               | 作用                                        |
| -------------------------------------------------- | ------------------------------------------- |
| `runtime: nvidia`                                  | 告诉 Docker 运行时使用 NVIDIA 驱动。        |
| `devices: - /dev/dri:/dev/dri`                     | 挂载 GPU 设备节点（部分 Plex 解码需要）。   |
| `NVIDIA_VISIBLE_DEVICES=all`                       | 启用所有 GPU。                              |
| `NVIDIA_DRIVER_CAPABILITIES=compute,video,utility` | 允许 Plex 使用视频转码功能（NVENC/NVDEC）。 |





### 3. 启动并验证

```
docker compose up -d
```

然后验证容器是否识别到 GPU：

```
docker exec -it Plex nvidia-smi
```

你应该能看到类似：

```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 550.144.03   Driver Version: 550.144.03   CUDA Version: 12.4     |
|-----------------------------------------------------------------------------|
| GPU Name        Persistence-M | Bus-Id | Display Active | ...               |
+-----------------------------------------------------------------------------+
| 0  GeForce GT 1030 ...                                                    |
+-----------------------------------------------------------------------------+
```

------





### 4. 在 Plex 启用 GPU 加速

打开 Plex 网页界面：

> 设置 → Transcoder → “Use hardware acceleration when available” ✅ 打勾
>  保存并重启 Plex。





### 5.日志到文件的 GPU 使用记录

#### 修改后的完整 `docker-compose.yml`

请把你的文件更新为下面这样👇：

```yaml
version: '3.9'

x-logging: &logging
  logging:
    driver: json-file
    options:
      max-size: 100m
      max-file: "3"
      tag: '{{.ImageName}}|{{.Name}}|{{.ImageFullID}}|{{.FullID}}'

services:
  plex:
    container_name: Plex
    <<: *logging
    network_mode: host
    environment:
      - HOSTNAME=Plex-Ubuntu-Server
      - TZ=Asia/Shanghai
      - PUID=1026
      - PGID=100
      - VERSION=docker
      - ADVERTISE_IP=http://0.0.0.0:32400/
      - PLEX_CLAIM=claim-ghDyJNRhLKazuwFgpchb
      # GPU 支持环境变量
      - NVIDIA_VISIBLE_DEVICES=all
      - NVIDIA_DRIVER_CAPABILITIES=compute,video,utility
    ports:
      - "32400:32400"
    volumes:
      - /storage/docker/AutoBangumi/plex/config:/config
      - /storage/docker/AutoBangumi/plex/transcode:/transcode
      - /storage/media/videos/:/media/
    restart: unless-stopped
    image: linuxserver/plex:1.32.1
    runtime: nvidia
    devices:
      - /dev/dri:/dev/dri

  gpu_logger:
    image: nvidia/cuda:12.4.1-base-ubuntu22.04
    container_name: gpu_logger
    restart: unless-stopped
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
      - NVIDIA_DRIVER_CAPABILITIES=compute,utility
      - TZ=Asia/Shanghai
    volumes:
      - /storage/docker/AutoBangumi/plex/GPU_log:/var/log
    command: >
      bash -c "
        echo 'Starting GPU logger...';
        while true; do
          echo '==================== '$(date '+%Y-%m-%d %H:%M:%S')' ====================' >> /var/log/gpu_usage.log;
          nvidia-smi --query-gpu=name,utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits >> /var/log/gpu_usage.log;
          echo '' >> /var/log/gpu_usage.log;
          sleep 60;
        done
      "

volumes:
  plex_config:
    external: false
  plex_transcode:
    external: false
```

------

#### ✅ 使用方法

1. **启动容器**

   ```
   docker compose up -d
   ```

2. **查看日志**

   ```
   tail -f /storage/docker/AutoBangumi/plex/GPU_log/gpu_usage.log
   ```

   日志示例：

   ```
   ==================== 2025-10-28 03:25:01 ====================
   NVIDIA GeForce GT 1030, 12, 8, 180, 2048, 43
   ```

3. **查看容器状态**

   ```
   docker ps
   ```

   你会看到：

   ```
   Plex
   gpu_logger
   ```

4. **随 Plex 自动启动**
    因为设置了：

   ```
   restart: unless-stopped
   ```

   所以系统重启时会自动重新运行日志服务。

------

#### 📘 日志字段说明

| 字段               | 含义           |
| ------------------ | -------------- |
| name               | GPU 名称       |
| utilization.gpu    | GPU 使用率 (%) |
| utilization.memory | 显存使用率 (%) |
| memory.used        | 已用显存 (MiB) |
| memory.total       | 总显存 (MiB)   |
| temperature.gpu    | 温度 (℃)       |