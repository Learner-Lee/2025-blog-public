# Ralph Loop 学习路线

---

## 0. 它是什么 & 为什么存在

Ralph Loop 是一种**外层 Shell 循环 + Claude Code CLI**的组合用法，不是 Claude Code 的内置功能，没有按钮可点。它的核心就一行：把任务描述文件反复喂给 AI，让 AI 每轮做一小步，直到任务完成。名字来自《辛普森一家》里死心眼的 Ralph Wiggum——他不聪明，但他**会坚持不懈地重复**。

---

## 1. 基础必学模块

**学完这个模块你能做到：** 在本机跑起第一个自动循环，让 Claude Code 自动迭代修改文件，你只需盯着屏幕看。

---

### 1.1 核心机制：Shell 循环 + Claude Code CLI

**🔧 这是什么**
用 Bash 的 `while` 循环，把 `PROMPT.md` 的内容通过管道喂给 `claude`，每轮跑完自动重启，形成持续迭代。

**✅ 加上它，你会得到**
- AI 每轮拿到相同的任务描述，自动接着上一轮的工作继续推进。
- 你不需要反复手动执行命令，离开电脑去喝咖啡，回来看进展。

**⚠️ 改动它，会发生什么**
- 去掉 `-p` 标志 → Claude Code 进入交互模式，等你输入，循环卡死。
- 去掉 `--dangerously-skip-permissions` → 每次工具调用都要你手动确认，循环变成手动点击器。
- 把 `while :` 换成 `for i in {1..5}` → 最多跑 5 轮后自动停止（这是好事，后面会用到）。

**🧪 最小可跑示例**
```bash
# 最简版（直接跑起来）
while :; do
  cat PROMPT.md | claude -p --dangerously-skip-permissions
done
```

> **名词解释**
> - `-p`：headless 模式，从 stdin 读取任务，不打开交互界面。
> - `--dangerously-skip-permissions`：自动批准所有工具调用（读文件、写文件、跑命令）。在受控项目目录下使用，生产服务器上不要用。
> - `|`（管道）：把左边命令的输出作为右边命令的输入。

---

### 1.2 PROMPT.md —— 循环的"方向盘"

**🔧 这是什么**
一个纯文本文件，写着你想让 AI 每轮都做的事。循环脚本每次都把它喂给 Claude Code，是 AI 行动的唯一指令来源。

**✅ 加上它，你会得到**
- AI 每一轮都有一致的目标，不会"忘记自己在干嘛"（因为每轮是全新的上下文）。
- 你可以在循环跑着的时候直接编辑它，下一轮就生效——相当于"热更新"指令。

**⚠️ 改动它，会发生什么**
- 写得太笼统（"帮我写个网站"）→ AI 每轮都在重做同一件事，没有进展。
- 不写停止条件 → 任务完成了循环还在跑，继续烧 token。
- 写成多任务清单（1. A  2. B  3. C）→ AI 会反复横跳，建议只写"每轮做最重要的一件事"。

**🧪 最小可跑示例**
```markdown
# PROMPT.md
目标：在 ./output 下生成一个 TODO CLI 工具，支持 add / list / done。

每轮你需要：
1. 读 ./progress.md，看上轮做到哪了。
2. 推进一小步，并在 ./progress.md 末尾追加本轮做了什么。
3. 如果功能已全部完成且 `python output/todo.py --help` 能跑通，
   在 ./progress.md 首行写 DONE 并退出。

规则：每轮只做一件事，不要一次全写完。
```

---

### 1.3 AGENTS.md —— AI 的"项目说明书"

**🔧 这是什么**
告诉 AI 这个项目如何构建、如何运行测试、有哪些特殊约定。每轮循环开始时 AI 都会读它，保证行为一致。

**✅ 加上它，你会得到**
- AI 知道用 `npm test` 还是 `pytest` 还是 `cargo test`，不会瞎猜。
- AI 发现更好的构建命令时会自动更新它，积累项目知识。

**⚠️ 改动它，会发生什么**
- 写成变更日志（"今天修了 bug X"）→ 文件越来越长，挤占 token，该放在 IMPLEMENTATION_PLAN.md 里。
- 超过 60 行 → 信噪比降低，AI 开始忽略关键指令。
- 不写，或留空 → AI 每轮都要重新摸索构建命令，浪费时间和 token。

**🧪 最小可跑示例**
```markdown
# AGENTS.md
## 构建 & 运行
- 安装依赖：`pip install -r requirements.txt`
- 运行应用：`python src/main.py`
- 跑测试：`pytest tests/ -v`
- 类型检查：`pyright src/`

## 约定
- 所有新功能必须有对应测试才能提交。
- 不要修改 `legacy/` 目录下的文件。
```

---

### 1.4 停止条件 & 控制循环

**🔧 这是什么**
告诉 Shell 循环"什么时候该停"的机制。没有停止条件的循环会永远运行，直到你的钱包或电脑先撑不住。

**✅ 加上它，你会得到**
- 循环在任务完成后自动退出，而不是烧 token 到你睡醒。
- 可以设置最大轮数，防止意外失控。

**⚠️ 改动它，会发生什么**
- 删掉 `break` 条件 → 无限循环，账单警告。
- 最大轮数设太大（如 1000）→ 等于没有限制，失去安全网。
- 只靠 Ctrl+C → 手动干预，失去自动化意义；但紧急时 Ctrl+C 是最快的急刹车。

**🧪 最小可跑示例**
```bash
#!/bin/bash
# loop.sh —— 带最大轮数的安全循环
MAX=${1:-10}          # 默认最多跑 10 轮，可传参覆盖：bash loop.sh 20
COUNT=0

while [ $COUNT -lt $MAX ]; do
  echo "=== 第 $((COUNT+1)) 轮 ==="
  cat PROMPT.md | claude -p --dangerously-skip-permissions
  COUNT=$((COUNT + 1))

  # 检查 AI 是否写了完成标志
  if grep -q "^DONE" progress.md 2>/dev/null; then
    echo "任务完成，退出循环。"
    break
  fi
done

echo "循环结束，共跑了 $COUNT 轮。"
```
```bash
# 运行方式
chmod +x loop.sh
bash loop.sh        # 最多跑 10 轮
bash loop.sh 5      # 最多跑 5 轮
```

---

## 2. 进阶模块

**学完这个模块你能做到：** 用"先规划、后执行"的双模式跑完一个有多个功能点的中型任务，会写规范的 specs 文件，知道怎么让 AI 自我纠错。


**基础版**

```
my-ai-project/
├── loop.sh                 # 核心驱动脚本
├── AGENTS.md               # 全局约定与技术栈定义
├── PROMPT_plan.md          # 规划模式 Prompt
├── PROMPT_build.md         # 执行模式 Prompt
├── IMPLEMENTATION_PLAN.md  # 实施计划（由 plan 模式自动生成）
├── specs/                  # 需求文档目录（人工编写）
│   ├── 01-feature-a.md     # 具体功能点描述
│   ├── 02-feature-b.md     # 具体功能点描述
│   ├── 03-feature-c.md     # 具体功能点描述
│   └── 04-feature-d.md     # 具体功能点描述
└── src/                    # 源码目录（由 build 模式自动生成）
```

**工程版**

```
my-ai-project/
├── loop.sh                  # 主循环（驱动整个系统,先跑plan,人工检查后,再跑build）

├── AGENTS.md                  # 全局规则（代码规范 / 架构约束 / AI行为约束）

├── prompts/                   # Prompt 模块化
│   ├── plan.md                # 规划任务
│   ├── build.md               # 代码生成
│   ├── review.md              # 代码审查 ⭐关键
│   ├── test.md                # 测试生成（可选）

├── specs/                     # 需求池（任务流转核心）
│   ├── backlog/               # 待处理需求
│   │   ├── 01-feature-a.md    # 具体功能点描述
│   │   ├── 02-feature-b.md    # 具体功能点描述
│   │   ├── 03-feature-c.md    # 具体功能点描述
│   ├── ready/                 # 已准备好（可执行）
│   ├── doing/                 # 当前正在做
│   ├── done/                  # 已完成

├── plans/                     # 每个 feature 一个计划
│   ├── 001-plan.md
│   ├── 002-plan.md
│   ├── 003-plan.md

├── state/                     # ⭐ 状态管理（核心）
│   ├── current_task.json      # 当前任务
│   ├── history.json           # 历史记录
│   ├── metrics.json           # 成功率 / 错误统计

├── src/                       # 代码目录

├── tests/                     # 自动测试（非常重要）
│   ├── test_login.py
│   ├── test_dashboard.py

├── logs/                      # 日志
│   ├── loop.log
│   ├── errors.log

├── scripts/                   # 工具脚本
│   ├── pick_task.sh
│   ├── update_state.py
│   ├── run_tests.sh

└── README.md
```

---

### 2.1 双模式分离：PLANNING vs BUILDING

**🔧 这是什么**
把 PROMPT.md 拆成两个文件：`PROMPT_plan.md`（只规划，不写代码）和 `PROMPT_build.md`（只执行，不重新规划）。分两个阶段跑。

**✅ 加上它，你会得到**
- 规划和执行不混在一起，AI 不会边想边写导致计划越跑越歪。
- 计划错了，重新跑一次 PLANNING 就行，成本低（一轮）。

**⚠️ 改动它，会发生什么**
- 合并成一个 PROMPT → AI 每轮都在重新规划，实际代码进展极慢。
- 跳过 PLANNING 直接 BUILDING → AI 不知道优先级，乱做一气。
- PLANNING 里允许写代码 → 计划轮变成执行轮，下一轮 BUILDING 会重复实现。

**🧪 最小可跑示例**
```bash
# 第一阶段：生成计划（跑一轮就够）
cat PROMPT_plan.md | claude -p --dangerously-skip-permissions

# 第二阶段：循环执行（跑到计划清空）
bash loop.sh 20
```

```markdown
# PROMPT_plan.md（节选）
1. 阅读 specs/ 下所有文件，了解需求。
2. 对比 specs 和现有代码，找出缺口。
3. 生成 IMPLEMENTATION_PLAN.md，每项格式：
   - [ ] 任务描述（优先级：高/中/低）
重要：只做规划，不写任何代码，不修改 src/。
```

```markdown
# PROMPT_build.md（节选）
1. 读 IMPLEMENTATION_PLAN.md，选最重要的未完成任务。
2. 搜索代码库，确认功能是否已实现（不要假设没实现）。
3. 实现选定的任务，跑测试，通过后提交。
4. 在 IMPLEMENTATION_PLAN.md 里把该任务标记为 [x]。
5. 如果计划里所有任务都是 [x]，输出 "全部完成" 后退出。
```

---

### 2.2 IMPLEMENTATION_PLAN.md —— 循环的"共享内存"

**🔧 这是什么**
记录待办任务的文件，每轮循环结束后 AI 更新它。因为每轮上下文是全新的，这个文件是唯一跨轮传递"做到哪了"的方式。

**✅ 加上它，你会得到**
- AI 每轮都能接着上一轮的进度继续，不会重头开始。
- 你随时打开这个文件，就知道项目进展到哪里了。

**⚠️ 改动它，会发生什么**
- 手动乱改 → AI 下一轮读到混乱的计划，可能重做已完成的任务。
- 不让 AI 更新它 → AI 下一轮以为什么都没做，重复劳动。
- 任务粒度太大（"实现用户系统"）→ AI 一轮内完不成，进度卡在 0%。

**🧪 最小可跑示例**
```markdown
# IMPLEMENTATION_PLAN.md（AI 自动生成并维护）
## 待办
- [ ] 创建 User 数据模型（高优先级）
- [ ] 实现 /register 接口（高优先级）
- [ ] 实现 /login 接口（中优先级）
- [ ] 添加 JWT 验证中间件（中优先级）
- [ ] 编写用户模块集成测试（低优先级）

## 已完成
- [x] 初始化项目结构（第1轮）
- [x] 配置数据库连接（第2轮）
```

> **何时手动重生成计划：**
> - 计划跑偏了（AI 做了很多但没在推进核心目标）
> - 你修改了 specs 文件
> - 计划里全是 [x] 但还有功能没实现
> - 跑法：删掉 IMPLEMENTATION_PLAN.md，重新执行 PLANNING 模式一轮

---

### 2.3 specs/ 目录 —— 需求文档规范

**🔧 这是什么**
放功能需求描述的目录，每个文件描述一个话题（一个功能模块）。AI 在规划阶段读它们，作为"标准答案"来做 gap analysis。

**✅ 加上它，你会得到**
- AI 知道"做到什么程度算完成"，而不是自由发挥。
- 换一个 AI 模型也能接着跑，因为规格是文件，不是对话历史。

**⚠️ 改动它，会发生什么**
- 一个文件写多个话题 → 违反"一 spec 一话题"原则，AI 规划时容易遗漏细节。
- 写 HOW（"用 PostgreSQL 的 jsonb 类型存储"）而不是 WHAT（"支持存储结构化用户偏好"）→ 过度约束 AI 实现细节，灵活性丧失。
- spec 文件太长 → AI 读不完，关键需求被截断。

**🧪 最小可跑示例**
```markdown
# specs/user-auth.md
## 用户认证功能需求

用户可以注册账号（邮箱 + 密码）。
用户可以登录，登录成功后获得访问令牌。
令牌有效期为 24 小时，过期后需要重新登录。
密码必须加密存储，不能明文。
连续 5 次登录失败后账号锁定 15 分钟。
```

> **一句话测试法：** 如果你的 spec 需要用"和"连接两个句子才能描述，就把它拆成两个 spec 文件。

---

### 2.4 反压机制（Backpressure）

**🔧 这是什么**
在每轮循环里，AI 实现完代码后必须跑测试 / 类型检查 / lint。如果失败，AI 必须先修复再提交。这是"质量门"，不是可选项。

**✅ 加上它，你会得到**
- AI 生成的代码必须通过验证才能进入下一轮，防止错误积累。
- 失败信息自动反馈给 AI，AI 自我修复，不需要你介入。

**⚠️ 改动它，会发生什么**
- 去掉测试步骤 → AI 提交了跑不通的代码，后面几十轮都在修老问题。
- 允许测试失败也继续 → 技术债雪球越滚越大，最后崩盘。
- 测试太慢（单次 > 5 分钟）→ 每轮成本暴增，换成只跑修改涉及的单测。

**🧪 最小可跑示例（在 PROMPT_build.md 里加入这段）**
```markdown
## 验证步骤（每轮必做，不可跳过）
实现完成后，按顺序执行：
1. `pyright src/` —— 类型检查，必须 0 错误
2. `pytest tests/ -x` —— 跑测试，-x 表示第一个失败就停
3. 如果任一步骤失败，修复后重新执行，直到全部通过。
4. 全部通过后才能执行 git commit。
```

---

### 2.5 Token 控制 & 子 Agent 策略

**🔧 这是什么**
每轮循环的上下文窗口约 170k token，"智能区"在 40-60% 利用率。通过并行子 Agent 做探索，单 Agent 做验证，把 token 花在刀刃上。

**✅ 加上它，你会得到**
- AI 在"智能区"工作，推理质量最高，不会因为上下文撑爆而截断。
- 探索代码库时速度快（并行），验证时结果可靠（单进程）。

**⚠️ 改动它，会发生什么**
- 每轮做太多任务 → 上下文超过智能区，AI 开始"忘事"，质量下降。
- 用多个子 Agent 同时跑测试 → 测试结果相互干扰，出现假阳性/假阴性。
- 不用子 Agent 探索大代码库 → 主 Agent 把 token 都花在读文件上，没剩多少给实现。

**🧪 最小可跑示例（PROMPT 里的子 Agent 指令）**
```markdown
## 探索阶段（并行，快）
用 250 个并行子 Agent 阅读 specs/ 和 src/ 目录，汇总相关文件列表。

## 实现阶段（单 Agent，可靠）
只用 1 个 Agent 执行代码修改和 git 操作。

## 验证阶段（单 Agent，串行）
只用 1 个 Agent 跑构建和测试，确保结果准确。
```

---

## 3. Master 模块

**学完这个模块你能做到：** 写出生产级的 `loop.sh`，知道循环跑偏时怎么救场，理解沙箱安全边界，判断什么任务值得用 Ralph。

---

### 3.1 上游信号 & 下游反压：双向控制 Ralph

**🔧 这是什么**
控制 AI 行为有两个方向：**上游**（给 AI 看什么、怎么设置环境）和**下游**（用测试/检查拒绝不合格的输出）。两者结合才能精确引导 AI。

**✅ 加上它，你会得到**
- AI 的"偏差"在提交前就被捕获，不会污染代码库。
- 你不需要每轮都盯着，系统自我纠错。

**⚠️ 改动它，会发生什么**
- 只有上游、没有下游 → AI 写了不符合要求的代码，你却不知道，直到手动检查。
- 只有下游、没有上游 → AI 不断随机尝试，靠撞运气通过测试，效率极低。
- 上游信号矛盾（PROMPT 说 A，代码模式是 B）→ AI 行为不可预测。

**🧪 最小可跑示例**
```markdown
# 上游信号示例（PROMPT 里）
搜索 src/utils/ 下现有的工具函数后再实现，不要重复造轮子。
遵循 src/ 里已有的代码风格（函数命名、错误处理方式）。

# 下游反压示例（AGENTS.md 里）
验证命令：
- `mypy src/ --strict`
- `pytest tests/ --tb=short`
提交前两者必须全绿，否则禁止 git commit。
```

---

### 3.2 loop.sh 完整脚本

**🔧 这是什么**
生产可用的循环脚本，支持模式切换（plan/build）、最大轮数、自动 git push、完成检测。

**✅ 加上它，你会得到**
- 一条命令启动，全程无需干预，跑完自动停止。
- 每轮结束自动推送到远端，你在其他设备也能看进展。

**⚠️ 改动它，会发生什么**
- 去掉 `git push` → 本地有进展但远端没有，换电脑就丢失上下文。
- 去掉模式参数 → 每次都要手动改文件，容易出错。
- `MAX_ITERATIONS` 设为 0 → 无限循环，必须手动 Ctrl+C 才能停。

**🧪 最小可跑示例**
```bash
#!/bin/bash
# loop.sh —— 生产版
set -euo pipefail

MODE=${1:-build}                    # 默认 build 模式
MAX_ITERATIONS=${2:-20}             # 默认最多 20 轮
PROMPT_FILE="PROMPT_${MODE}.md"
ITERATION=0

if [ ! -f "$PROMPT_FILE" ]; then
  echo "错误：找不到 $PROMPT_FILE"
  exit 1
fi

echo "启动 Ralph Loop：模式=$MODE，最大轮数=$MAX_ITERATIONS"

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))
  echo ""
  echo "========== 第 $ITERATION 轮 / 最多 $MAX_ITERATIONS 轮 =========="

  cat "$PROMPT_FILE" | claude -p \
    --dangerously-skip-permissions \
    --model claude-opus-4-5

  # 自动推送（可选，注释掉就不推）
  git push origin "$(git branch --show-current)" 2>/dev/null || true

  # 检查完成标志
  if grep -q "^DONE\|全部完成" IMPLEMENTATION_PLAN.md 2>/dev/null; then
    echo "所有任务完成，退出循环。"
    break
  fi
done

echo "循环结束。共跑了 $ITERATION 轮。"
```
```bash
# 使用方式
chmod +x loop.sh
bash loop.sh plan 1     # 规划模式，跑 1 轮
bash loop.sh build 30   # 执行模式，最多跑 30 轮
bash loop.sh            # 默认：build 模式，最多 20 轮
```

---

### 3.3 救场三板斧

**🔧 这是什么**
循环跑偏时的三种恢复手段，按严重程度从轻到重使用。

**✅ 加上它，你会得到**
- 遇到意外不慌，30 秒内恢复状态，损失最多几轮的 token。

**⚠️ 改动它，会发生什么**
- 跑偏了不停 → AI 继续在错误方向挖坑，越来越难救。
- 直接 `git reset --hard` 而不先理解原因 → 可能删掉有价值的进展。

**🧪 最小可跑示例**
```bash
# 招式一：急停（AI 跑偏，立刻按）
Ctrl+C

# 招式二：重生成计划（计划过时或混乱）
rm IMPLEMENTATION_PLAN.md
bash loop.sh plan 1     # 重新规划一轮

# 招式三：回滚代码（AI 写了一堆错代码）
git log --oneline -10   # 先看看做了什么
git reset --hard HEAD~3 # 回滚最近 3 个提交（数字按需调整）
# 然后重新调整 PROMPT 再启动
```

---

### 3.4 沙箱安全

**🔧 这是什么**
`--dangerously-skip-permissions` 让 AI 可以不经确认执行任何命令。必须在受控环境下使用。

**✅ 加上它，你会得到**
- 循环全自动，不需要人工确认每一步工具调用。

**⚠️ 改动它，会发生什么**
- 在生产服务器上用 → AI 可能误删文件、执行破坏性命令，数据丢失。
- 在包含敏感凭据的目录里用 → AI 可能读取并意外泄露密钥。
- 不限制 AI 能访问的目录 → 循环可能修改项目外的文件。

**🧪 最小可跑示例（最安全的本地跑法）**
```bash
# 新建一个干净的项目目录
mkdir ~/ralph-sandbox && cd ~/ralph-sandbox
git init

# 把所有项目文件放在这个目录内
# 在这个目录内启动循环，AI 只能操作这里的文件
bash loop.sh build 10
```

---

### 3.5 Ralph 经济学

**🔧 这是什么**
Ralph Loop 的真实成本与收益，帮你判断什么时候值得用，什么时候是杀鸡用牛刀。

**✅ 加上它，你会得到**
- 对 token 消耗有预期，不会在账单来了才知道烧了多少。
- 知道哪类任务 ROI 最高。

**⚠️ 改动它，会发生什么**
- 对简单任务用 Ralph → 浪费 token，不如一次性让 AI 写完。
- 对超大遗留代码库用 Ralph → 上下文超载，AI 行为不可预测，ROI 极低。

**核心数据（来自真实案例）**
- 文档记录：$50k 的绿地项目合同，用 Ralph Loop 完成，含测试和 review，总 token 成本约 $297。
- 每轮消耗约 10k-50k token，取决于子 Agent 数量和任务复杂度。
- 最适合场景：绿地项目（从零开始）、重复性实现任务、有完整测试套件的代码库。

---

## 4. 什么时候【不该】用 Ralph Loop

这是最容易被忽视的部分，但可能是最重要的。

| 场景 | 为什么不适合 | 更好的做法 |
|------|------------|-----------|
| **遗留代码库**（大量历史包袱）| AI 理解不了隐性约定和历史决策，每轮都在踩雷 | 手动重构，逐步引入测试后再考虑 Ralph |
| **任务本身没有验证标准** | 没有测试 = 没有反压，AI 永远不知道做没做对 | 先写好测试或验收标准再启动 |
| **需要实时人工判断的设计决策** | 比如 UI 审美、产品方向，AI 自己跑容易偏离 | 人工参与决策，只用 AI 执行 |
| **一次性小任务**（< 1 小时工作量）| 设置 Ralph 的成本 > 直接让 AI 写完的成本 | 直接 `claude` 一次搞定 |
| **需要访问外部实时系统**（数据库生产环境）| `--dangerously-skip-permissions` 下风险不可控 | 手动执行，或先在沙箱验证 |
| **团队协作项目、有 PR 流程** | 无人审查的自动 push 会打乱 review 流程 | 用 Ralph 生成分支，人工 review 后合并 |

**三个担心的预防措施：**

- **Token 烧太快** → 设 `MAX_ITERATIONS`（每轮后看账单）+ 用 Haiku 模型做探索、Sonnet 做实现。
- **循环停不下来** → 在 PROMPT 里写明确的完成标志（如在某文件首行写 DONE），脚本检测到就 break。
- **AI 跑偏** → 前 3 轮必须盯着看，确认方向正确后再离开；遇到偏差立刻 Ctrl+C 调整 PROMPT。

---

## 5. 动手路线图

```
第 1 天：跑通最简循环
  □ 创建 ralph-practice/ 目录，git init
  □ 写第一个 PROMPT.md（参考 1.2 示例）
  □ 写 AGENTS.md（参考 1.3 示例）
  □ 跑 loop.sh，最多 3 轮，看 AI 做了什么
  □ 检查 progress.md，确认循环在推进

第 2 天：加入计划文件
  □ 把任务拆成 specs/ 文件（参考 2.3）
  □ 跑 PLANNING 模式生成 IMPLEMENTATION_PLAN.md
  □ 检查计划是否合理，手动修改
  □ 跑 BUILDING 模式 5 轮，观察计划被消耗的节奏

第 3 天：加入反压
  □ 为你的项目写测试（哪怕只有 3 个）
  □ 在 PROMPT_build.md 里加入验证步骤（参考 2.4）
  □ 故意引入一个 bug，看 AI 能不能自己发现并修复

第 4 天起：跑一个真实中型任务
  □ 选一个 2-5 个功能点的绿地项目
  □ 用完整的双模式 loop.sh
  □ 观察、记录、调整 PROMPT
  □ 完成后复盘：哪些 PROMPT 写法最有效？
```

**你现在可以做的第一件事：**
```bash
mkdir ralph-practice && cd ralph-practice && git init
```
然后告诉我你想做什么项目，我帮你写第一个 PROMPT.md。
