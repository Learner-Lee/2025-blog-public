# 使用 Claude Code + Opus 5.5 实现长时间任务：完整实战指南

> 适用对象：希望让 Claude Code 连续工作数小时（大规模迁移、全仓库审计、重构、跨语言重写等）的开发者 更新时间：2026 年 9 月（Opus 5.5 发布后） 说明：Claude Code 迭代很快，文中的命令和参数请以 `claude --help`、`/help` 和官方文档为准。

------

## 目录

1. [为什么 Opus 5.5 适合长任务](#1-为什么-opus-55-适合长任务)
2. [环境准备](#2-环境准备)
3. [长任务的五条核心原则](#3-长任务的五条核心原则)
4. [搭建项目脚手架：CLAUDE.md + 状态文件](#4-搭建项目脚手架claudemd-状态文件)
5. [标准工作流：规划 → 启动 → 运行中引导 → 验收](#5-标准工作流规划-启动-运行中引导-验收)
6. [上下文管理：让任务跨越上下文窗口](#6-上下文管理让任务跨越上下文窗口)
7. [子代理与并行：拆分大任务](#7-子代理与并行拆分大任务)
8. [无人值守运行：Headless 模式、循环脚本与 Hooks](#8-无人值守运行headless-模式循环脚本与-hooks)
9. [安全护栏](#9-安全护栏)
10. [成本与速度控制](#10-成本与速度控制)
11. [验收与代码审查](#11-验收与代码审查)
12. [常见问题排查](#12-常见问题排查)
13. [完整实战示例：一次 Python 2 → 3 迁移](#13-完整实战示例一次-python-2-3-迁移)
14. [启动前检查清单](#14-启动前检查清单)
15. [参考资料](#15-参考资料)

------

## 1. 为什么 Opus 5.5 适合长任务

Claude Opus 5.5（模型 ID：`claude-opus-5-5`）于 2026 年 9 月发布，官方定位就是**长时间运行的智能体编码和知识工作**。和长任务相关的关键特性：

| 特性                   | 说明                                                         | 对长任务的意义                       |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------ |
| 长程执行能力           | 相比之前的 Opus，最大提升在多步骤工作上，例如在大型仓库里把一个改动推进到测试全部通过 | 可以交付完整任务，而不是一步步手把手 |
| 自适应思考始终开启     | 模型每次回复前都会思考，并自行决定思考多少                   | 不需要在提示词里写"仔细思考"         |
| effort（思考力度）参数 | API 默认 `medium`，可调 `low` / `high` / `xhigh` / `max`     | 用来平衡质量、速度和成本             |
| 更清晰的汇报           | 进度更新和最终总结会讲清：做了什么、发现了什么、需要你做什么 | 长任务结束后更容易验收               |
| 子代理编排             | 早期测试者用它协调并行子代理完成长时间审计和迁移             | 大任务可以扇出并行                   |
| 价格                   | $4 / $20 每百万输入/输出 token（低于 Opus 5 的 $5 / $25）    | 长任务成本更可控                     |

官方公布的案例可以帮助你建立预期：有测试者不到一天完成了 68 万行代码迁移；有测试者在 3 小时内完成了 20 万行代码库的审计和修复；把 HAProxy 从 C 翻译为 Rust 的内部测试耗时约 9.5 小时。

**结论**：Opus 5.5 的正确用法是"把整件事交给它，说清楚完成标准，然后让它跑"，而不是像以前一样切成很多小步骤反复对话。

------

## 2. 环境准备

### 2.1 安装 / 更新 Claude Code

```bash
# 安装（首次）
npm install -g @anthropic-ai/claude-code

# 更新到最新版（Opus 5.5 需要较新的版本）
claude update

# 确认版本
claude --version
```

### 2.2 选择模型

```bash
# 启动时指定模型
claude --model claude-opus-5-5

# 或在会话中切换
/model
```

在 `/model` 选择界面中也可以调整 effort。建议：

| 场景                                 | 推荐 effort                          |
| ------------------------------------ | ------------------------------------ |
| 日常交互、小改动                     | `medium`（默认）                     |
| 大型迁移、复杂重构、长时间自主运行   | `high`                               |
| 极难问题（复杂并发 bug、架构级重写） | `xhigh` 或 `max`，注意成本会明显上升 |
| 批量简单任务、代码审查初筛           | `low`                                |

> Opus 5.5 在相同 effort 下比 Opus 5 思考得更多，从旧模型迁移时不要直接照搬原来的 effort 设置，建议重新试一下。

### 2.3 项目准备（非常重要）

长任务启动前，确保仓库满足以下条件：

- **在独立分支上工作**：`git checkout -b claude/long-task-xxx`
- **工作区干净**：先提交或暂存你自己的改动
- **测试能一键运行**：例如 `npm test`、`pytest`、`cargo test`。测试就是 Claude 判断"是否完成"的客观依据
- **Lint / 类型检查可用**：`eslint`、`mypy`、`tsc --noEmit` 等
- **构建命令明确**：写进 CLAUDE.md

没有可自动运行的验证手段，长任务就只能靠模型"自我感觉"，质量会大打折扣。

------

## 3. 长任务的五条核心原则

### 原则 1：一次说清整个任务和"完成标准"

在一条消息里给出完整任务、明确的终点，以及什么时候需要停下来问你。

```text
把 payments 模块的所有接口从旧的 HTTP 客户端迁移到新客户端。
完成标准：所有接口都使用新客户端，旧客户端代码被删除，完整测试套件通过。
只有当某个测试失败且你无法解释原因时，才停下来问我。
```

✅ 好的完成标准：可验证、可观测（测试通过、某个函数不再被引用、所有文件都已处理） ❌ 差的完成标准："优化一下代码"、"让它更好"

### 原则 2：删除"仔细思考"类的指令

Opus 5.5 每次回复前都会思考，并自行决定深度。"think step by step"、"仔细思考"、"反复检查你的答案"这类话会增加成本，却不会提升质量。想要更深入的思考，就调高 effort。

### 原则 3：明确"停下"和"继续"的规则

Opus 5.5 会主动汇报进度，长任务中有时会停下来总结、询问"要继续吗？"或列出一些并不阻塞工作的选项。如果你希望它一路跑到底，要在 CLAUDE.md 里写清楚（见第 4 节）。

### 原则 4：任务状态写进文件，而不是只留在对话里

长任务会填满上下文窗口，Claude Code 会自动压缩（总结）较早的对话。写在文件里的任务清单不会丢失，你也可以直接查看文件来了解进度，而不用翻滚动记录。

### 原则 5：用客观验证代替主观判断

让 Claude 用测试、类型检查、构建、脚本输出来证明工作完成，而不是说"应该可以了"。

------

## 4. 搭建项目脚手架：CLAUDE.md + 状态文件

### 4.1 CLAUDE.md 模板（长任务版）

在仓库根目录创建 `CLAUDE.md`（建议控制在 200 行以内，过长容易被忽略）：

```markdown
# 项目说明

## 技术栈
- Python 3.12, FastAPI, PostgreSQL
- 包管理：uv

## 常用命令
- 安装依赖：`uv sync`
- 运行全部测试：`uv run pytest -q`
- 运行单个测试：`uv run pytest tests/path/test_x.py -q`
- 类型检查：`uv run mypy src/`
- Lint：`uv run ruff check src/ tests/`

## 代码规范
- 所有公共函数必须有类型注解
- 不要修改 `migrations/` 下已存在的迁移文件
- 新增依赖前先说明理由

## 长任务工作方式
- 当某一步不需要我的输入时，继续做下去。把状态说明和下一步动作放在同一条消息里。
- 只有在两种情况下停下来问我：
  1. 没有我就无法继续（缺少凭据、需求有歧义且会影响结果）
  2. 执行任何破坏性操作之前：删除数据、force push、修改本仓库以外的任何东西
- 在 TASKS.md 中维护任务清单：完成一项就打勾，发现新问题就加进去。
- 每完成一个逻辑单元，运行相关测试，通过后用清晰的 message 提交一次 commit。
- 上下文被压缩后，先读 TASKS.md 和 PROGRESS.md 再继续。

## 最终汇报格式
每次运行结束时，用三个标题汇报：
- **需要我处理的**（阻塞项、待我决定的问题）
- **已变更**（改了什么）
- **发现**（发现的问题、风险、未能确认的内容以及你查过哪里）
```

> 如果你想要结对编程式的节奏（开始前先给一行计划、结束后简短回顾），就在 CLAUDE.md 里写相反的规则，Opus 5.5 两种都能遵循。

### 4.2 模块化规则（可选）

规则多了之后可以拆分到 `.claude/rules/*.md`，并用 frontmatter 中的 `paths` 让某些规则只在处理匹配文件时加载，避免上下文膨胀：

```markdown
---
paths: ["src/payments/**"]
---
# 支付模块规则
- 金额一律使用 Decimal，禁止 float
- 所有外部调用必须有超时和重试
```

### 4.3 状态文件

**TASKS.md**：任务清单（Claude 维护）

```markdown
# 迁移任务清单

## 待办
- [ ] 迁移 src/payments/charge.py
- [ ] 迁移 src/payments/refund.py
- [ ] 迁移 src/payments/webhook.py
- [ ] 删除 src/legacy/http_client.py
- [ ] 全量测试通过

## 已完成
- [x] 盘点所有使用旧客户端的调用点（共 37 处）

## 过程中发现的新问题
- [ ] webhook.py 中存在未覆盖测试的分支，需补测试
```

**PROGRESS.md**：工作日志与关键决策（Claude 维护，给"未来的自己"看）

```markdown
# 进度日志

## 关键决策
- 新客户端的超时统一设为 10s（与旧客户端保持一致）
- 旧接口名保留为别名，计划下个版本删除

## 当前状态
- 正在处理：refund.py
- 已知问题：test_refund_partial 偶发失败，疑似与时间相关，已记录待查

## 下一步
1. 完成 refund.py 迁移并跑测试
2. 处理 webhook.py
```

------

## 5. 标准工作流：规划 → 启动 → 运行中引导 → 验收

### 阶段 1：规划（Plan Mode）

对于大任务，先让 Claude 调研再动手。按 `Shift+Tab` 切换到 Plan Mode（或使用 `/plan`），它会只读地探索代码并给出方案，不做修改。

```text
我要把整个项目从 requests 迁移到 httpx（异步）。
先调研：列出所有调用点、测试覆盖情况、可能的风险点（同步/异步边界、
第三方库依赖、mock 方式变化）。然后给出分阶段计划，写入 TASKS.md。
```

审阅计划，有问题当场纠正。计划确认后退出 Plan Mode。

### 阶段 2：启动

一条消息交代全部：

```text
按 TASKS.md 的计划执行迁移。

完成标准：
- 项目中不再有任何 `import requests`
- `uv run pytest -q` 全部通过
- `uv run mypy src/` 无新增错误

工作方式：
- 每完成一个模块就跑相关测试并提交一次 commit
- 持续更新 TASKS.md 和 PROGRESS.md
- 只有遇到无法解释原因的测试失败，或需要执行破坏性操作时才停下来问我
```

### 阶段 3：运行中引导

- **追加指令**：Claude 工作时直接输入消息并回车即可插入补充要求，例如"另外保留旧的接口名作为别名"。任务越长，重启代价越高，所以追加比中断重来更划算。
- **中断**：按 `Esc` 停止当前动作；按两次 `Esc` 可以编辑上一条消息或回退。
- **查看进度**：直接看 `TASKS.md`，而不是翻终端输出。
- **后台任务**：`/tasks` 查看和管理后台运行的命令（例如 dev server、watch 构建）。
- **给会话命名**：`/rename 迁移-httpx`，之后可以用 `/resume` 找回。
- **远程查看**：可以通过 Claude 移动端远程查看和引导正在运行的会话。

### 阶段 4：验收

任务结束后按以下顺序看：

1. **先看"需要我处理的"**：它在等你做什么决定？
2. 再看变更和发现
3. 自己跑一遍测试
4. 让 Claude 做一轮代码审查（见第 11 节）
5. 审查 git log，必要时 squash

------

## 6. 上下文管理：让任务跨越上下文窗口

长任务一定会碰到上下文上限。Claude Code 会自动压缩旧对话，但压缩是有损的。策略如下：

### 6.1 关键原则：状态外置

凡是"压缩后不能丢"的东西，都应该在文件里：任务清单（TASKS.md）、关键决策（PROGRESS.md）、项目约定（CLAUDE.md）。在 CLAUDE.md 中写明"压缩后先读状态文件"。

### 6.2 每个回合都是一个分叉点

| 操作            | 何时用                               | 特点                                                         |
| --------------- | ------------------------------------ | ------------------------------------------------------------ |
| 继续            | 当前上下文仍有价值                   | 最省事                                                       |
| `/compact`      | 任务中途，细节丢一些没关系           | 有损但保持节奏；可以附带指示，如 `/compact 保留所有与 refund 相关的决策` |
| `/clear` + 简报 | 下一步风险高，你想精确控制带入的信息 | 更费事，但完全可控                                           |
| `/rewind`       | 走错了方向，想回退代码和对话         | 回到之前的检查点                                             |
| 子代理          | 需要大量读文件/搜索，但只需要结论    | 中间过程留在子代理的上下文里                                 |

### 6.3 交接技巧

在 `/clear` 或回退之前，让 Claude 写一份交接说明：

```text
总结到目前为止的工作，写给接手这个任务的下一个 Claude：
已完成什么、当前卡在哪、做过哪些尝试以及为什么失败、下一步具体做什么。
写入 PROGRESS.md 的"交接"部分。
```

### 6.4 新任务开新会话

相关的后续任务（比如给刚写好的功能补文档）可以复用会话；真正不相关的新任务应该开新会话，避免无关上下文干扰。

------

## 7. 子代理与并行：拆分大任务

### 7.1 什么时候用子代理

判断标准：**我之后还需要这些工具输出本身吗，还是只需要结论？** 如果只需要结论（例如"读 20 个文件找出所有调用点"），交给子代理，这样 20 次文件读取、12 次搜索和 3 条死路都留在子代理的上下文里，主会话只收到最终报告。

### 7.2 扇出审计示例

```text
检查 services/ 下每个服务是否存在 issue #482 描述的重试 bug。
每个服务交给一个独立的子代理。子代理汇报后，先核对它给出的证据再采纳。
最后输出一张表：服务名、是否受影响、证据（文件:行号）。
```

### 7.3 自定义子代理

在 `.claude/agents/` 下定义专用子代理，例如一个只负责跑测试和分析失败的代理：

```markdown
---
name: test-runner
description: 运行测试并分析失败原因。在代码修改后主动使用。
tools: Bash, Read, Grep
---
你负责运行测试并定位失败原因。
1. 运行指定测试
2. 对每个失败：给出文件、行号、失败原因的最可能解释
3. 不要修改任何代码，只汇报
```

### 7.4 限制子代理数量和深度

防止失控扇出，可以设置环境变量：

```bash
export CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=4   # 最多同时运行的子代理
export CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=2   # 子代理最多嵌套层数
```

### 7.5 Git Worktree：多个 Claude 并行不互相干扰

多个独立任务同时进行时，每个任务一个 worktree：

```bash
git worktree add ../proj-migrate-auth -b claude/migrate-auth
git worktree add ../proj-migrate-billing -b claude/migrate-billing

# 分别在两个终端中启动
cd ../proj-migrate-auth && claude --model claude-opus-5-5
cd ../proj-migrate-billing && claude --model claude-opus-5-5
```

每个会话用 `/rename` 标注，方便区分。子代理也可以配置为在隔离的 worktree 中运行。

------

## 8. 无人值守运行：Headless 模式、循环脚本与 Hooks

### 8.1 Headless 模式基础

`claude -p`（`--print`）以非交互方式运行：处理提示、输出结果、退出。无人值守时，务必加上护栏参数：

```bash
claude -p "运行测试并修复所有失败" \
  --model claude-opus-5-5 \
  --allowedTools "Read,Edit,Write,Bash(uv run pytest:*),Bash(git add:*),Bash(git commit:*)" \
  --max-turns 150 \
  --max-budget-usd 15 \
  --output-format json
```

| 参数                | 作用                                                         |
| ------------------- | ------------------------------------------------------------ |
| `--allowedTools`    | 预先授权工具。Headless 下没人点"允许"，不授权就会卡住。Bash 尽量限定到具体命令 |
| `--permission-mode` | 权限模式，如 `acceptEdits`（自动接受文件编辑）               |
| `--max-turns`       | 最大轮数，熔断器                                             |
| `--max-budget-usd`  | 最大花费，熔断器                                             |
| `--output-format`   | `text` / `json` / `stream-json`；`json` 结果里带 `session_id` |

### 8.2 多轮续跑

```bash
# 第一轮，记下 session_id
session_id=$(claude -p "开始迁移，先完成 TASKS.md 的前三项" \
  --model claude-opus-5-5 --output-format json | jq -r '.session_id')

# 后续继续同一会话
claude -p "继续 TASKS.md 中剩余的项目" --resume "$session_id"

# 或者直接继续当前目录最近的会话
claude -p "继续" --continue
```

注意：通过 `-p` 创建的会话不会出现在交互式 `/resume` 选择器里，需要用 ID 或 `--continue` 恢复。

### 8.3 驱动脚本：直到任务清单清空

适合"睡前启动，早上验收"。每一轮都是新会话，依赖 TASKS.md 和 PROGRESS.md 衔接，天然规避上下文膨胀：

```bash
#!/usr/bin/env bash
# run-long-task.sh
set -euo pipefail

MAX_ROUNDS=20
BUDGET_PER_ROUND=10
mkdir -p logs

for i in $(seq 1 "$MAX_ROUNDS"); do
  remaining=$(grep -c '^- \[ \]' TASKS.md || true)
  if [ "$remaining" -eq 0 ]; then
    echo "✅ TASKS.md 已全部完成（第 $i 轮前）"
    break
  fi
  echo "▶ 第 $i 轮，剩余 $remaining 项"

  claude -p "$(cat prompts/continue.md)" \
    --model claude-opus-5-5 \
    --permission-mode acceptEdits \
    --allowedTools "Read,Edit,Write,Grep,Glob,Bash(uv run pytest:*),Bash(uv run mypy:*),Bash(git add:*),Bash(git commit:*),Bash(git status),Bash(git diff:*)" \
    --max-turns 200 \
    --max-budget-usd "$BUDGET_PER_ROUND" \
    --output-format json > "logs/round-$i.json" 2> "logs/round-$i.err" || {
      echo "⚠ 第 $i 轮异常退出，查看 logs/round-$i.err"
    }

  # 每轮结束后跑一次测试作为独立检查
  if ! uv run pytest -q > "logs/test-$i.txt" 2>&1; then
    echo "⚠ 第 $i 轮后测试未通过，下一轮会优先处理"
  fi
done
```

`prompts/continue.md`：

```markdown
你正在执行一个长时间迁移任务。

1. 先读 CLAUDE.md、TASKS.md、PROGRESS.md 了解当前状态。
2. 从 TASKS.md 中挑选下一批未完成项继续工作。如果测试当前未通过，优先修复。
3. 每完成一项：运行相关测试，通过后打勾并 commit。
4. 把关键决策和交接信息写进 PROGRESS.md。
5. 遇到需要人工决定的问题：记录到 PROGRESS.md 的"需要人工处理"部分，然后跳过该项继续其他项。
6. 不要执行任何破坏性操作（删除数据、force push、修改仓库外的文件）。
```

### 8.4 Stop Hook：没做完就不许停

Hooks 可以在特定事件时运行脚本。用 `Stop` hook 在 Claude 准备结束时检查任务清单，未完成就让它继续。

`.claude/settings.json`：

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": ".claude/hooks/check-tasks.sh" }
        ]
      }
    ]
  }
}
```

`.claude/hooks/check-tasks.sh`：

```bash
#!/usr/bin/env bash
input=$(cat)

# 防止无限循环：如果已经是被 Stop hook 拦截后的继续，就放行
if [ "$(echo "$input" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0
fi

remaining=$(grep -c '^- \[ \]' TASKS.md 2>/dev/null || true)
if [ "${remaining:-0}" -gt 0 ]; then
  cat <<EOF
{"decision": "block", "reason": "TASKS.md 中还有 $remaining 项未完成。请继续下一项；如果剩余项都需要人工决定，请在 PROGRESS.md 中说明原因后再结束。"}
EOF
  exit 0
fi
exit 0
chmod +x .claude/hooks/check-tasks.sh
```

> 这里用 `stop_hook_active` 只拦截一次；如果你想拦截多次，需要在脚本里自己记录次数并设置上限，千万不要写成可能无限拦截的逻辑。

### 8.5 PreToolUse Hook：拦截危险命令

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": ".claude/hooks/block-dangerous.sh" }
        ]
      }
    ]
  }
}
```

`.claude/hooks/block-dangerous.sh`：

```bash
#!/usr/bin/env bash
cmd=$(jq -r '.tool_input.command // ""')

if echo "$cmd" | grep -Eq 'rm -rf /|git push.*(--force|-f)|DROP (TABLE|DATABASE)|git reset --hard'; then
  echo "已拦截危险命令：$cmd" >&2
  exit 2   # 退出码 2 = 阻止该工具调用，stderr 会反馈给 Claude
fi
exit 0
```

### 8.6 定时与循环任务

- **`/loop`**：在当前会话中按间隔重复执行某个提示，适合"接下来一小时每 10 分钟检查一次部署状态"这类短期盯守。
- **`/schedule` / 定时任务（Routines）**：保存一个提示，按周期自动运行，适合每天、每周的例行任务，例如"每天早上审阅夜间 agent 的工作并标出需要人工看的项"。
- **cron + headless**：完全自控的方式：

```cron
# 每天凌晨 2 点启动长任务驱动脚本
0 2 * * * cd ~/repo && ./run-long-task.sh >> ~/logs/claude-$(date +\%F).log 2>&1
```

### 8.7 CI 中运行（GitHub Actions）

Claude Code 可以在 GitHub Actions 中运行，适合"给 issue 打标签 → 自动开分支修复 → 提 PR"的流程。长任务放在 CI 中的好处是天然隔离（干净的容器、独立分支）。具体配置参考官方 GitHub Actions 文档。

------

## 9. 安全护栏

"少停下来问"意味着你需要把风险控制前移。

| 护栏               | 做法                                                         |
| ------------------ | ------------------------------------------------------------ |
| 分支隔离           | 永远在新分支 / worktree 中运行长任务                         |
| 权限最小化         | `--allowedTools` 精确到命令；不要给无限制的 `Bash`           |
| 破坏性操作保留确认 | 即使 CLAUDE.md 让它"一路跑"，也要保留对删除、force push 等操作的权限确认 |
| PreToolUse hook    | 硬性拦截危险命令（见 8.5）                                   |
| 预算熔断           | `--max-turns`、`--max-budget-usd`                            |
| 频繁提交           | 每个逻辑单元一次 commit，出问题可精确回退                    |
| 敏感信息           | 不要把生产凭据放在 Claude 可读的位置；用只读、测试环境的凭据 |
| 沙箱               | 高风险任务放在容器或虚拟机中运行                             |
| 检查点             | 交互模式下可以用 `/rewind` 回退代码和对话                    |

------

## 10. 成本与速度控制

### 10.1 价格参考（API 计费）

| 项目                  | 价格（每百万 token） |
| --------------------- | -------------------- |
| 输入                  | $4                   |
| 输出                  | $20                  |
| 缓存读取              | $0.20                |
| Fast mode 输入 / 输出 | $8 / $40             |

如果你使用的是 Pro / Max 订阅，则按套餐用量计算，Fast mode 需要开启额外用量。

### 10.2 省钱技巧

- **effort 按需调**：不是所有任务都需要 `high`，审查初筛用 `low` 往往就够
- **删掉"再检查一遍"类指令**：模型本身会自我检查，额外要求只会叠加成本
- **子代理隔离大量读取**：避免主上下文膨胀导致每轮输入 token 暴涨
- **状态外置 + 分轮运行**：每轮新会话，避免在超长上下文上反复计费
- **设置预算上限**：`--max-budget-usd`
- **`/cost`**：查看当前会话花费

### 10.3 Fast mode

`/fast` 开启。同一个模型，输出更快（最高约 2.5 倍），但单价更高。适合你在盯着每一条回复的交互式工作；**无人值守的长任务通常不需要**，因为你并不在等。

------

## 11. 验收与代码审查

### 11.1 让 Claude 先审一轮

```text
审查当前分支相对 main 的 diff。
只列出你会因此阻止合并的问题。每个问题给出：文件和行号、为什么有问题、
如何用测试或复现步骤证明它有问题。
```

### 11.2 让它标出没能确认的内容

```text
列出所有你没能验证的假设，以及你查过哪些地方。
```

"我没找到"本身就是有价值的信息，明确要求它汇报，就更容易发现遗漏。

### 11.3 人工验收要点

- 测试是否被"修改"而不是"修复"？（重点看测试文件的 diff，警惕删测试、加 skip、放宽断言）
- 是否有 TODO、占位实现或被注释掉的代码？
- 提交历史是否清晰？
- PROGRESS.md 中"需要人工处理"的项是否都已处理？

可以在 CLAUDE.md 中明确写："禁止通过删除测试、添加 skip 或放宽断言来让测试通过；如确需修改测试，在 PROGRESS.md 中说明理由。"

------

## 12. 常见问题排查

| 现象                         | 原因                                             | 解决                                                         |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| 跑一会儿就停下问"要继续吗？" | Opus 5.5 倾向于主动汇报                          | 回复"继续"；频繁出现就在 CLAUDE.md 中加入第 4.1 节的停止规则 |
| 压缩后"忘了"之前的决定       | 自动压缩是有损的                                 | 状态写进 TASKS.md / PROGRESS.md；手动 `/compact` 时附带保留指示 |
| Headless 运行卡住不动        | 需要权限确认但无人响应                           | 检查 `--allowedTools` 是否覆盖了所需工具                     |
| 会话中途切换到了旧模型       | 某条消息触发了安全分类器，会话被切到较旧模型继续 | 用 `/model` 切回；按两次 `Esc` 编辑上一条消息重试；在 `/config` 中修改"消息被标记时切换模型"的行为；误判可用 `/feedback` 反馈 |
| 请求被拒绝，提到推理内容     | 要求在回复中复述内部推理可能被拒绝               | 改成"用三句话解释你为什么选这个方案"                         |
| 成本超出预期                 | effort 过高、上下文过长、子代理过多              | 降 effort、分轮运行、限制子代理并发数                        |
| 测试一直失败陷入循环         | 问题超出当前信息范围                             | 让它记录尝试过的方案并停下；你补充信息后再继续               |
| 多个会话找不到了             | 未命名                                           | `/rename` 命名，`/resume` 找回                               |

------

## 13. 完整实战示例：一次 Python 2 → 3 迁移

**背景**：一个约 8 万行的 Python 2 遗留项目，需要迁移到 Python 3.12，有基本的测试覆盖。

### 第 0 步：准备

```bash
cd legacy-app
git checkout -b claude/py3-migration
# 确认 Python 3.12 环境和测试命令可用
```

写好 CLAUDE.md（参考 4.1），并额外加入：

```markdown
## 迁移专项规则
- 目标：Python 3.12，不需要兼容 Python 2
- 不引入 six / future 等兼容库
- str / bytes 边界问题必须补充测试
- 禁止通过删除测试、添加 skip 或放宽断言让测试通过
```

### 第 1 步：规划（Plan Mode）

```text
这是一个 Python 2 项目，要迁移到 Python 3.12。
请调研：
1. 按模块统计需要改动的语法和 API（print、unicode/str、dict.iteritems、
   整数除法、urllib 等）
2. 第三方依赖中哪些没有 Python 3 版本，需要替换
3. 测试覆盖薄弱、风险高的模块
然后给出分阶段计划：先依赖、再基础模块、后业务模块。
把计划写成 TASKS.md，每个模块一项。
```

### 第 2 步：并行盘点（子代理）

```text
对 src/ 下的每个顶级包，各分配一个子代理，找出所有 str/bytes 混用的风险点。
子代理汇报后核对证据。汇总成表格追加到 PROGRESS.md。
```

### 第 3 步：启动长任务

交互式启动：

```text
按 TASKS.md 执行迁移。
完成标准：
- `python3.12 -m pytest -q` 全部通过
- `ruff check src/` 无错误
- 代码中不存在 Python 2 专有语法
每完成一个模块就测试并 commit。只有遇到无法解释的失败或破坏性操作时才问我。
```

或者晚上用 8.3 的驱动脚本无人值守运行，并配上 8.4 的 Stop hook 和 8.5 的危险命令拦截。

### 第 4 步：早上验收

```bash
cat PROGRESS.md          # 先看"需要人工处理"
git log --oneline main.. # 看提交历史
git diff main --stat     # 看改动范围
git diff main -- tests/  # 重点检查测试有没有被"放水"
python3.12 -m pytest -q  # 自己跑一遍
```

然后在 Claude Code 中执行 11.1 的审查提示，处理完阻塞项后提 PR。

------

## 14. 启动前检查清单

**提示词**

- [ ] 任务在一条消息里说完整，包含可验证的完成标准
- [ ] 提示词和 CLAUDE.md 中没有"仔细思考"类指令
- [ ] 写明什么情况下停下来问、什么情况下继续

**环境**

- [ ] Claude Code 已更新，模型为 `claude-opus-5-5`
- [ ] effort 设置合适
- [ ] 在独立分支 / worktree 中
- [ ] 测试、lint、类型检查可一键运行

**长任务机制**

- [ ] CLAUDE.md 包含停止规则和汇报格式
- [ ] 任务清单保存在 TASKS.md，进度与决策保存在 PROGRESS.md
- [ ] 大规模审计 / 迁移已规划拆分给子代理
- [ ] 无人值守时设置了 `--allowedTools`、`--max-turns`、`--max-budget-usd`

**安全**

- [ ] 破坏性命令仍然需要确认，或已被 hook 拦截
- [ ] 没有暴露生产凭据

**验收**

- [ ] 先看"需要我处理的"部分
- [ ] 人工审查前先让 Claude 审一轮
- [ ] 检查测试是否被弱化
- [ ] 要求标出无法确认的内容

------

## 15. 参考资料

- Opus 5.5 发布公告：https://www.anthropic.com/claude-opus-5-5
- 在 Claude 和 Claude Code 中用好 Opus 5.5：https://claude.dev/blog/getting-the-most-out-of-opus-5-5/
- Opus 5.5 新特性与迁移说明：https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5
- Opus 5.5 提示词指南：https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5
- Claude Code 文档首页：https://code.claude.com/docs
- Claude Code 最佳实践：https://code.claude.com/docs/en/best-practices
- Headless / 编程方式运行：https://code.claude.com/docs/en/headless
- Hooks 参考：https://code.claude.com/docs/en/hooks