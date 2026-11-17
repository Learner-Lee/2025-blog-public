"""One-time installation on the explicitly selected blog host. No files are deleted."""
import datetime
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess

ROOT = Path('/storage/blog/2025-blog-public')
APP = ROOT / 'module/quickdrop'
BACKUP = Path('/storage/backups') / ('quickdrop-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
BACKUP.mkdir(parents=True, exist_ok=False)
targets = [ROOT / 'src/app/about/page.tsx', ROOT / 'src/app/about/list.json', ROOT / 'data/config/about.json',
           Path('/etc/nginx/sites-available/blog'), Path('/etc/turnserver.conf'), Path('/etc/quickdrop.env'), Path('/etc/systemd/system/quickdrop.service')]
manifest = []
for index, source in enumerate(targets):
    if source.exists():
        destination = BACKUP / f'{index}-{source.name}'
        shutil.copy2(source, destination)
        manifest.append({'original': str(source), 'backup': str(destination)})
(BACKUP / 'manifest.json').write_text(json.dumps(manifest, indent=2))
os.chmod(BACKUP, 0o700)

if subprocess.run(['id', 'quickdrop'], capture_output=True).returncode:
    subprocess.run(['useradd', '--system', '--no-create-home', '--shell', '/usr/sbin/nologin', 'quickdrop'], check=True)
secret = secrets.token_hex(32)
env = Path('/etc/quickdrop.env')
env.write_text('HOST=127.0.0.1\nPORT=3031\nPUBLIC_URL=https://web.alenli.cn\n'
               'TURN_URLS=turn:107.173.25.107:3478?transport=udp,turn:107.173.25.107:3478?transport=tcp\n'
               f'TURN_SECRET={secret}\n')
os.chmod(env, 0o600)

turn = Path('/etc/turnserver.conf')
turn.write_text(f'''listening-port=3478
listening-ip=107.173.25.107
relay-ip=107.173.25.107
fingerprint
use-auth-secret
static-auth-secret={secret}
realm=web.alenli.cn
server-name=quickdrop
min-port=49160
max-port=49200
total-quota=64
user-quota=12
max-bps=5242880
bps-capacity=20971520
stale-nonce=600
no-cli
no-tls
no-dtls
no-tcp-relay
no-multicast-peers
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=224.0.0.0-255.255.255.255
denied-peer-ip=::1
denied-peer-ip=fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
denied-peer-ip=fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff
syslog
simple-log
''')
os.chmod(turn, 0o640)
shutil.chown(turn, user='root', group='turnserver')
shutil.copy2(APP / 'deploy/quickdrop.service', '/etc/systemd/system/quickdrop.service')

nginx = Path('/etc/nginx/sites-available/blog')
config = nginx.read_text()
if 'location /quickdrop/' not in config:
    marker = '    # PDF 对照阅读器'
    if config.count(marker) != 1:
        raise RuntimeError('Unexpected Nginx structure; backup retained, proxy unchanged')
    location = (APP / 'deploy/nginx-location.conf').read_text()
    config = config.replace(marker, '    # QuickDrop 网页互传\n' + '\n'.join('    ' + line for line in location.splitlines()[1:]) + '\n\n' + marker)
    nginx.write_text(config)
subprocess.run(['nginx', '-t'], check=True)

work = {
    'id': 'quickdrop', 'name': 'QuickDrop · 网页互传', 'year': 2026,
    'tagline': '手机与电脑，打开网页就能互传文件和文字。无需安装，不在服务器保存文件。',
    'image': '/quickdrop/cover.svg', 'demo': 'https://web.alenli.cn/quickdrop/',
    'tags': ['WebRTC', '扫码配对', '文件互传', '微信 / QQ 文件'],
    'content': '从手机到电脑，或者从电脑到手机，用同一个配对链接连接两台设备，核对配对码后就能发送。\n\n'
               '## 可以做什么\n\n- **文件互传**：照片、视频、文档，单文件最大 512 MiB；按文件名排序，每组最多 1024 MiB、50 个文件，超过时自动分组。\n'
               '- **文字与链接**：发一段便签，或者把手机上的网址传到电脑。\n'
               '- **微信 / QQ 文件**：先把聊天文件保存到手机，再在网页中选择发送。网页不能直接读取聊天内容。\n'
               '- **确认后接收**：两端核对配对码；每个文件都需要接收方同意，并通过 SHA-256 校验。\n\n'
               '## 使用说明\n\n双方都需要保持网页打开。优先通过 WebRTC 直连，不能直连时尝试加密中继，服务器不存储文件。'
               '收到文件后请点击下载保存，刷新或关闭页面会丢失尚未保存的内容。当前不支持断点续传，手机锁屏或切换网络可能中断。'
}
for filename in [ROOT / 'data/config/about.json', ROOT / 'src/app/about/list.json']:
    data = json.loads(filename.read_text())
    works = data.setdefault('works', [])
    existing = next((index for index, entry in enumerate(works) if entry.get('id') == 'quickdrop'), None)
    if existing is None:
        works.append(work)
    else:
        works[existing] = work
    filename.write_text(json.dumps(data, ensure_ascii=False, indent='\t') + '\n')
page = ROOT / 'src/app/about/page.tsx'
source = page.read_text()
if "export const dynamic = 'force-dynamic'" not in source:
    source = source.replace('async function getLiveAboutData()', "export const dynamic = 'force-dynamic'\n\nasync function getLiveAboutData()")
    page.write_text(source)

for rule in [('3478/tcp',), ('3478/udp',), ('49160:49200/udp',)]:
    subprocess.run(['ufw', 'allow', *rule, 'comment', 'QuickDrop TURN'], check=True)
subprocess.run(['systemctl', 'daemon-reload'], check=True)
subprocess.run(['systemctl', 'enable', '--now', 'quickdrop'], check=True)
subprocess.run(['systemctl', 'restart', 'coturn'], check=True)
subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
print('BACKUP_DIRECTORY=' + str(BACKUP))
print('QuickDrop and TURN configured. Rebuild the blog to publish the about page.')
