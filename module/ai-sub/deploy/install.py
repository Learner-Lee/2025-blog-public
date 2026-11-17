"""Idempotent installation on the user-selected blog host; back up before writing."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request

ROOT = Path('/storage/blog/2025-blog-public')
APP = ROOT / 'module/ai-sub'
NGINX = Path('/etc/nginx/sites-available/blog')
UNIT = Path('/etc/systemd/system/ai-sub-web.service')
ABOUT = [ROOT / 'data/config/about.json', ROOT / 'src/app/about/list.json']
backup = Path('/storage/backups') / ('ai-sub-web-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(parents=True, exist_ok=False)
os.chmod(backup, 0o700)
manifest = []
for i, filename in enumerate([NGINX, UNIT, *ABOUT]):
    if filename.exists():
        copy = backup / f'{i}-{filename.name}'
        shutil.copy2(filename, copy)
        manifest.append({'original': str(filename), 'backup': str(copy)})
(backup / 'manifest.json').write_text(json.dumps(manifest, indent=2))
print('BACKUP_DIRECTORY=' + str(backup), flush=True)

# Validate structure before touching live configuration.
config = NGINX.read_text()
marker = '    # QuickDrop 网页互传'
if 'location /ai-sub/' not in config:
    if config.count(marker) != 1:
        raise RuntimeError('Unexpected Nginx structure; no live changes made')
    location = (APP / 'deploy/nginx-location.conf').read_text()
    config = config.replace(marker, '\n'.join('    ' + line for line in location.splitlines()) + '\n\n' + marker)
about_data = [(filename, json.loads(filename.read_text())) for filename in ABOUT]

shutil.copy2(APP / 'deploy/ai-sub-web.service', UNIT)
subprocess.run(['systemctl', 'daemon-reload'], check=True)
subprocess.run(['systemctl', 'enable', '--now', 'ai-sub-web'], check=True)
subprocess.run(['systemctl', 'restart', 'ai-sub-web'], check=True)
for attempt in range(20):
    try:
        with urllib.request.urlopen('http://127.0.0.1:3032/ai-sub/api/feed', timeout=5) as response:
            feed = json.load(response)
        assert isinstance(feed['items'], list)
        print('READER_READY items=' + str(len(feed['items'])), flush=True)
        break
    except Exception:
        if attempt == 19:
            raise
        time.sleep(0.5)

NGINX.write_text(config)
try:
    subprocess.run(['nginx', '-t'], check=True)
except Exception:
    original = next(entry for entry in manifest if entry['original'] == str(NGINX))
    shutil.copy2(original['backup'], NGINX)
    raise
subprocess.run(['systemctl', 'reload', 'nginx'], check=True)

work = {
    'id': 'ai-sub', 'name': 'AI-Sub · AI 知识收集', 'year': 2026,
    'tagline': '把 AI 产品更新与技术博客收进一个阅读空间。搜索、筛选、收藏，慢慢消化值得关注的内容。',
    'image': '/ai-sub/cover.svg', 'demo': 'https://web.alenli.cn/ai-sub/',
    'tags': ['AI 资讯', '技术博客', '智能摘要', '阅读收藏'],
    'content': '每天的 AI 更新太多，先让工具替我收集，再挑值得读的慢慢看。AI-Sub 持续采集产品发布、RSS 技术博客和官方站点，用 AI 整理中文标题、摘要和重要性。现在也能直接在网页里阅读。\n\n'
               '## 可以做什么\n\n- **集中阅读**：产品更新与技术博客分开浏览，查看中文摘要，直接跳到原文。\n'
               '- **搜索与筛选**：按关键词、来源、主题、重要性和收录时间缩小范围，支持最近收录、最近发布和重要性排序。\n'
               '- **本地收藏**：喜欢的内容保存在当前浏览器，包含摘要快照；原始记录清理后仍能查看收藏。\n'
               '- **导出清单**：将收藏导出为 Markdown，方便长期保存和二次整理。\n\n'
               '## 关于数据\n\n网页复用现有采集结果，每 5 分钟同步。列表最多展示最近 5000 篇，原采集工具会定期清理旧数据。'
               '收藏不跨设备同步，清除浏览器数据也会清除收藏，请按需导出。摘要由 AI 整理，准确内容请以原文为准。'
}
for filename, data in about_data:
    works = data.setdefault('works', [])
    index = next((i for i, entry in enumerate(works) if entry.get('id') == work['id']), None)
    if index is None:
        works.append(work)
    else:
        works[index] = work
    temp = filename.with_suffix('.ai-sub.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent='\t') + '\n')
    os.chmod(temp, filename.stat().st_mode & 0o777)
    temp.replace(filename)
print('LIVE_URL=https://web.alenli.cn/ai-sub/')
print('ABOUT_URL=https://web.alenli.cn/about?work=ai-sub')
