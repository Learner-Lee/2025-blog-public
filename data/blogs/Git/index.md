# Git + GitHub 完全指南：边写项目边自动备份，出错秒速恢复

> **目标**：掌握用 Git 管理代码版本 + 推送到 GitHub，出错时一键回滚到安全版本。

---

## 目录

1. [核心概念：Git 是什么？](#1-核心概念git-是什么)
2. [环境准备](#2-环境准备)
3. [初始化项目](#3-初始化项目)
4. [日常工作流：写代码 → 提交 → 推送](#4-日常工作流写代码--提交--推送)
5. [出错了！如何快速恢复](#5-出错了如何快速恢复)
6. [分支策略：安全开发新功能](#6-分支策略安全开发新功能)
7. [自动化：让推送更顺手](#7-自动化让推送更顺手)
8. [常用命令速查表](#8-常用命令速查表)
9. [最佳实践清单](#9-最佳实践清单)

---

## 1. 核心概念：Git 是什么？

把 Git 想象成你项目的**时光机**：

```
你的项目时间线：

[初始版本] → [加了登录功能] → [加了支付功能] → [出BUG了！]
    v1.0           v1.1              v1.2           v1.3(坏的)
     ↑
     └── 随时可以回到这里！
```

| 概念 | 类比 | 作用 |
|------|------|------|
| **仓库 (Repository)** | 项目文件夹 + 所有历史记录 | 存储代码和全部历史 |
| **提交 (Commit)** | 存档点/存档记录 | 保存当前状态，可随时回退 |
| **分支 (Branch)** | 平行宇宙 | 安全测试新功能，不影响主线 |
| **推送 (Push)** | 上传到云端 | 把本地存档同步到 GitHub |
| **拉取 (Pull)** | 从云端下载 | 获取 GitHub 上的最新代码 |

---

## 2. 环境准备

### 2.1 安装 Git

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install git -y

# macOS
brew install git

# Windows
# 下载安装包：https://git-scm.com/download/win
```

验证安装：
```bash
git --version
# 输出类似：git version 2.43.0
```

### 2.2 配置 Git（只需做一次）

```bash
# 设置你的名字和邮箱（会显示在每次提交记录上）
git config --global user.name "你的名字"
git config --global user.email "你的邮箱@example.com"

# 设置默认分支名为 main（现代标准）
git config --global init.defaultBranch main

# 设置一个好用的编辑器（可选，用 VS Code）
git config --global core.editor "code --wait"

# 查看配置是否正确
git config --list
```

### 2.3 连接 GitHub（SSH 方式，一劳永逸）

**第一步：生成 SSH 密钥**
```bash
ssh-keygen -t ed25519 -C "你的邮箱@example.com"
# 一路回车即可（使用默认路径，不设密码）
```

**第二步：查看并复制公钥**
```bash
cat ~/.ssh/id_ed25519.pub
# 复制输出的全部内容（以 ssh-ed25519 开头）
```

**第三步：添加到 GitHub**
1. 打开 GitHub → 右上角头像 → **Settings**
2. 左侧菜单 → **SSH and GPG keys**
3. 点击 **New SSH key**
4. Title 随便填（如 "我的电脑"），Key 粘贴刚才复制的内容
5. 点击 **Add SSH key**

**第四步：测试连接**
```bash
ssh -T git@github.com
# 成功输出：Hi 你的用户名! You've successfully authenticated...
```

---

## 3. 初始化项目

### 3.1 在 GitHub 创建仓库

1. GitHub 首页点击右上角 **"+"** → **New repository**
2. 填写仓库名（如 `my-project`）
3. 选择 **Public**（公开）或 **Private**（私有）
4. **不要勾选** "Add a README file"（我们本地已有项目）
5. 点击 **Create repository**

### 3.2 本地项目连接到 GitHub

```bash
# 进入你的项目目录
cd /path/to/your/project

# 初始化 Git 仓库
git init

# 创建 .gitignore 文件（告诉 Git 哪些文件不需要追踪）
# Python 项目示例：
cat > .gitignore << 'EOF'
__pycache__/
*.pyc
*.pyo
.env
.venv/
venv/
*.log
.DS_Store
node_modules/
dist/
build/
EOF

# 添加所有文件到暂存区
git add .

# 创建第一个提交（存档点）
git commit -m "初始化项目"

# 连接到 GitHub 远程仓库（替换为你的仓库地址）
git remote add origin git@github.com:你的用户名/my-project.git

# 推送到 GitHub
git push -u origin main
```

成功后刷新 GitHub 页面，就能看到你的代码了！

---

## 4. 日常工作流：写代码 → 提交 → 推送

### 黄金工作流（每天重复）

```
写代码 → 测试没问题 → git add → git commit → git push
                              ↑
                         这一步是关键！每完成一个小功能就提交一次
```

### 4.1 查看当前状态

```bash
git status
```

输出示例：
```
On branch main
Changes not staged for commit:
  modified:   src/app.py       ← 已修改但未暂存

Untracked files:
  src/new_feature.py           ← 新文件，还没追踪
```

### 4.2 暂存文件

```bash
# 暂存单个文件
git add src/app.py

# 暂存所有修改
git add .

# 暂存部分修改（交互式选择）
git add -p
```

### 4.3 提交（创建存档点）

```bash
# 好的提交信息格式：[类型] 简短描述
git commit -m "feat: 添加用户登录功能"
git commit -m "fix: 修复支付金额计算错误"
git commit -m "refactor: 重构数据库连接模块"
git commit -m "docs: 更新 README 使用说明"
```

**提交信息类型参考：**
| 类型 | 含义 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 Bug |
| `refactor` | 重构（不影响功能） |
| `docs` | 文档更新 |
| `test` | 添加测试 |
| `chore` | 杂项（依赖更新等） |

### 4.4 推送到 GitHub

```bash
# 第一次推送（设置上游分支）
git push -u origin main

# 之后每次只需要
git push
```

### 4.5 查看提交历史

```bash
# 简洁版历史（推荐）
git log --oneline --graph --all

# 详细历史
git log

# 最近 5 条
git log --oneline -5
```

输出示例：
```
* a3f9c2e (HEAD -> main, origin/main) fix: 修复登录验证逻辑
* 7b2d1a4 feat: 添加记住密码功能
* 3c8e5f1 feat: 完成用户登录功能
* 1a2b3c4 初始化项目
```

---

## 5. 出错了！如何快速恢复

> 这是最重要的章节！不同情况用不同命令。

### 情景一：刚修改了文件，还没 add，想撤销

```bash
# 撤销单个文件的修改（恢复到上次提交的状态）
git restore src/app.py

# 撤销所有文件的修改
git restore .
```

⚠️ **注意**：这会永久丢失未提交的修改，谨慎使用！

### 情景二：已经 add 了，想从暂存区移除

```bash
# 取消暂存（文件修改保留，只是从暂存区移除）
git restore --staged src/app.py

# 取消所有暂存
git restore --staged .
```

### 情景三：已经 commit 了，想撤销最近一次提交

```bash
# 方法一：撤销提交，但保留文件修改（最安全！）
git reset --soft HEAD~1
# 效果：提交消失了，但代码修改还在，可以重新提交

# 方法二：撤销提交，文件回到修改前（未暂存状态）
git reset HEAD~1
# 等同于 git reset --mixed HEAD~1

# 方法三：完全撤销，代码也回滚（危险！会丢失代码）
git reset --hard HEAD~1
```

**HEAD~1 的含义：**
```
HEAD~1 = 当前提交的前一个
HEAD~2 = 当前提交的前两个
HEAD~3 = 当前提交的前三个
```

### 情景四：想回到某个历史版本（查看或永久回滚）

```bash
# 第一步：查看历史，找到目标版本的哈希值
git log --oneline
# 输出：
# a3f9c2e (HEAD) 出BUG的版本
# 7b2d1a4 feat: 添加记住密码功能   ← 想回到这里
# 3c8e5f1 feat: 完成用户登录功能

# 方法一：临时查看旧版本（不影响当前代码）
git checkout 7b2d1a4
# 查看完后回到最新版本：
git checkout main

# 方法二：创建新提交来"撤销"某次提交（推荐，最安全）
git revert a3f9c2e
# 效果：不删除历史，而是新增一个"撤销"提交

# 方法三：永久回滚到某个版本（会丢失之后的所有提交）
git reset --hard 7b2d1a4
git push --force  # ⚠️ 危险！只在个人分支使用
```

### 情景五：代码已经推送到 GitHub，想撤销

```bash
# 推荐：用 revert 创建一个撤销提交（安全）
git revert HEAD
git push

# 不推荐：强制覆盖远程（会影响他人，谨慎！）
git reset --hard HEAD~1
git push --force-with-lease  # 比 --force 稍安全的版本
```

### 情景六：误删了文件，想找回来

```bash
# 找回已删除但已提交过的文件
git checkout HEAD -- 被删文件路径

# 找回某个历史版本的文件
git checkout 7b2d1a4 -- src/important_file.py
```

### 恢复决策树

```
出错了！
    │
    ├── 还没 add？
    │       └── git restore <文件>
    │
    ├── 已经 add，没有 commit？
    │       └── git restore --staged <文件>
    │
    ├── 已经 commit，没有 push？
    │       ├── 保留代码：git reset --soft HEAD~1
    │       └── 完全回滚：git reset --hard HEAD~1
    │
    └── 已经 push 到 GitHub？
            ├── 安全方式：git revert HEAD → git push
            └── 强制回滚：git reset --hard <版本> → git push --force-with-lease
```

---

## 6. 分支策略：安全开发新功能

分支是 Git 最强大的功能——在"平行宇宙"里开发，完成后再合并回主线。

### 推荐的分支模型

```
main（主分支，永远稳定可运行）
  │
  ├── feature/user-auth（开发用户认证）
  ├── feature/payment（开发支付功能）
  └── fix/login-bug（修复登录 Bug）
```

### 基本分支操作

```bash
# 创建并切换到新分支
git checkout -b feature/user-auth
# 或（新版 Git）
git switch -c feature/user-auth

# 查看所有分支（* 表示当前分支）
git branch -a

# 在新分支上正常开发、提交...
git add .
git commit -m "feat: 实现用户注册功能"

# 推送新分支到 GitHub
git push -u origin feature/user-auth

# 开发完成，合并回 main
git switch main
git merge feature/user-auth

# 删除已合并的分支
git branch -d feature/user-auth
```

### 实战工作流示例

```bash
# 1. 开始新功能前，确保 main 是最新的
git switch main
git pull

# 2. 创建功能分支
git switch -c feature/shopping-cart

# 3. 开发... 多次提交
git add .
git commit -m "feat: 添加购物车基础结构"
# 继续开发...
git commit -m "feat: 实现添加商品到购物车"
git commit -m "feat: 实现购物车结算逻辑"

# 4. 推送到 GitHub（可以在 GitHub 上创建 Pull Request）
git push -u origin feature/shopping-cart

# 5. 测试通过，合并回 main
git switch main
git merge feature/shopping-cart
git push

# 6. 清理分支
git branch -d feature/shopping-cart
git push origin --delete feature/shopping-cart
```

---

## 7. 自动化：让推送更顺手

### 7.1 创建实用的 Git 别名

```bash
# 一键查看漂亮的提交历史
git config --global alias.lg "log --oneline --graph --all --decorate"

# 快速查看状态
git config --global alias.st "status -s"

# 快速提交所有修改
git config --global alias.ca "commit -am"

# 撤销最后一次提交（保留代码）
git config --global alias.undo "reset --soft HEAD~1"
```

使用示例：
```bash
git lg    # 漂亮的历史图
git st    # 简洁状态
git ca "fix: 修复某个 bug"  # 等同于 git commit -am
git undo  # 撤销最后一次提交
```

### 7.2 创建提交脚本（快速存档）

在项目根目录创建 `save.sh`：

```bash
#!/bin/bash
# 快速保存脚本：git add + commit + push 一键完成

# 获取提交信息（如果没有传参，使用默认信息）
MSG="${1:-auto: 自动保存 $(date '+%Y-%m-%d %H:%M:%S')}"

echo "正在保存项目..."
git add .
git commit -m "$MSG"
git push

echo "✓ 保存完成！提交信息：$MSG"
```

```bash
# 给脚本执行权限
chmod +x save.sh

# 使用方式：
./save.sh                              # 使用默认时间戳信息
./save.sh "feat: 完成用户登录功能"     # 使用自定义信息
```

### 7.3 Git Hooks：提交前自动检查

在 `.git/hooks/pre-commit` 创建钩子，提交前自动运行测试：

```bash
#!/bin/bash
# 提交前自动运行测试，测试失败则阻止提交

echo "运行测试..."

# Python 项目示例
python -m pytest tests/ -q

if [ $? -ne 0 ]; then
    echo "❌ 测试失败！提交已阻止。请修复测试后再提交。"
    exit 1
fi

echo "✓ 测试通过，允许提交"
```

```bash
chmod +x .git/hooks/pre-commit
```

---

## 8. 常用命令速查表

### 基础操作

| 命令 | 作用 |
|------|------|
| `git init` | 初始化仓库 |
| `git status` | 查看当前状态 |
| `git add .` | 暂存所有修改 |
| `git add <文件>` | 暂存指定文件 |
| `git commit -m "信息"` | 提交（创建存档点） |
| `git push` | 推送到远程 |
| `git pull` | 拉取远程最新代码 |
| `git log --oneline` | 查看提交历史 |
| `git diff` | 查看未暂存的修改 |

### 回滚与恢复

| 命令 | 作用 | 危险程度 |
|------|------|----------|
| `git restore <文件>` | 撤销未暂存的修改 | 中（丢失修改） |
| `git restore --staged <文件>` | 取消暂存 | 低 |
| `git reset --soft HEAD~1` | 撤销提交，保留代码 | 低 |
| `git reset --hard HEAD~1` | 完全撤销最近提交 | 高 |
| `git revert <哈希>` | 安全撤销某次提交 | 低（推荐） |
| `git reset --hard <哈希>` | 回滚到指定版本 | 高 |

### 分支操作

| 命令 | 作用 |
|------|------|
| `git branch` | 查看本地分支 |
| `git branch -a` | 查看所有分支（含远程） |
| `git switch -c <分支名>` | 创建并切换到新分支 |
| `git switch <分支名>` | 切换分支 |
| `git merge <分支名>` | 合并分支 |
| `git branch -d <分支名>` | 删除已合并的分支 |

### 远程操作

| 命令 | 作用 |
|------|------|
| `git remote -v` | 查看远程仓库地址 |
| `git remote add origin <URL>` | 添加远程仓库 |
| `git push -u origin main` | 首次推送并设置上游 |
| `git fetch` | 获取远程更新（不合并） |
| `git clone <URL>` | 克隆远程仓库到本地 |

---

## 9. 最佳实践清单

### 提交习惯

- [ ] **小步提交**：每完成一个小功能就提交，不要攒很久再一次性提交
- [ ] **提交前测试**：确保代码能跑通再提交，不要提交明显有错的代码
- [ ] **写清楚信息**：`feat: 添加登录功能` 比 `修改了一些东西` 有用 100 倍
- [ ] **不提交敏感信息**：密码、API Key 等放在 `.env` 文件，加入 `.gitignore`

### 分支习惯

- [ ] **main 分支保持稳定**：始终确保 main 分支的代码是可运行的
- [ ] **新功能开新分支**：不要直接在 main 上开发实验性功能
- [ ] **合并前先更新**：合并前先 `git pull` 获取最新的 main

### 安全习惯

- [ ] **推送前检查**：`git log --oneline -5` 确认要推送的内容
- [ ] **谨慎使用 `--force`**：强制推送会覆盖远程历史，多人协作时非常危险
- [ ] **定期推送**：即使功能没完成，也要定期推送到 GitHub 作为云端备份

---

## 完整工作流示例

```bash
# ============================================
# 开始新的一天：同步最新代码
# ============================================
git pull

# ============================================
# 开始新功能：创建分支
# ============================================
git switch -c feature/user-profile

# ============================================
# 开发过程中：频繁小提交
# ============================================
# 写了一会儿代码...
git add .
git commit -m "feat: 添加用户资料页面结构"

# 继续写...
git add .
git commit -m "feat: 实现头像上传功能"

# 又写了一些...
git add .
git commit -m "feat: 完成用户资料编辑保存"

# ============================================
# 测试时发现 BUG！
# ============================================
# 方案一：直接修复并提交
git add .
git commit -m "fix: 修复头像上传路径错误"

# 方案二：情况严重，回滚到上一个好的版本
git reset --soft HEAD~1  # 撤销最后一次提交，代码保留
# 修复问题后重新提交
git commit -m "feat: 实现头像上传功能（修复路径问题）"

# ============================================
# 功能完成：推送并合并
# ============================================
git push -u origin feature/user-profile

# 切回主分支，合并
git switch main
git pull  # 先同步最新的 main
git merge feature/user-profile
git push

# 清理分支
git branch -d feature/user-profile

# ============================================
# 大功告成！GitHub 上已有最新代码
# ============================================
```

---

## 常见问题 FAQ

**Q：push 时提示 "rejected"（被拒绝）怎么办？**
```bash
# 通常是因为远程有你本地没有的提交，先 pull 再 push
git pull --rebase
git push
```

**Q：合并时出现冲突怎么办？**
```bash
# 查看冲突文件
git status

# 打开冲突文件，手动解决冲突标记：
# <<<<<<< HEAD
# 你的代码
# =======
# 别人的代码
# >>>>>>> feature/xxx

# 解决后，标记为已解决
git add <冲突文件>
git commit -m "merge: 解决合并冲突"
```

**Q：不小心把密码提交了怎么办？**
```bash
# 立即修改密码/吊销 API Key！提交历史是公开的！
# 然后从历史中移除敏感信息：
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch 包含密码的文件' \
  --prune-empty --tag-name-filter cat -- --all
git push --force
```

**Q：怎么看某个文件是谁修改的？**
```bash
git blame src/app.py
# 每一行代码都显示是谁、什么时候修改的
```

---

*文档版本：1.0 | 最后更新：2026-03-18*
