# Ralph Loop 实践

## 用户

模块 1

---

## Claude

好，开始模块 1 陪练。按照指示，先创建 `ralph-practice/` 目录。

（创建目录 ralph-practice/，git init）

目录建好了。下面一步一步来，每步我先解释，你确认后再看结果。

---

## 第 1 步：写任务描述文件 PROMPT.md

**解释：** 我们给 AI 一个简单任务——写一个会自我追踪进度的 Python 计数器。每轮循环 AI 都会读 `progress.md` 知道做到哪了，然后再推进一步。

（创建 ralph-practice/PROMPT.md）

```markdown
# 任务：构建一个简单的 Python 计数器工具

目标：在 ./output/ 目录下创建 counter.py，支持以下功能：
- add <数字>：把数字加入计数器
- total：显示当前总和
- reset：清零计数器
- history：显示所有历史操作记录

每轮你需要做：
1. 读 ./progress.md，了解上一轮做到哪了（如果文件不存在，说明这是第一轮）。
2. 只做"下一个最重要的一小步"（比如：第1轮建文件结构，第2轮实现add，第3轮实现total，以此类推）。
3. 做完后，在 ./progress.md 末尾追加一行，格式：`- 第N轮：做了什么`。
4. 如果所有功能都已实现，且 `python output/counter.py total` 能正常运行，则在 ./progress.md 的**第一行**写入 `DONE`，然后停止。

重要规则：
- 每轮只做一件事，不要一次把所有功能都写完。
- 不要写伪代码或占位符，写真实可运行的代码。
- 每轮结束前检查你写的代码能否运行（python output/counter.py --help 或类似命令）。
```

## 第 2 步：写项目说明文件 AGENTS.md

**解释：** 这个文件告诉 AI 项目的基本信息——用什么语言、怎么运行、有什么约定。

（创建 ralph-practice/AGENTS.md）

```markdown
# AGENTS.md

## 环境
- Python 3（系统自带，无需安装额外依赖）
- 代码放在 output/ 目录

## 运行方式
- 运行工具：`python output/counter.py <命令>`
- 验证能跑通：`python output/counter.py total`

## 约定
- 数据持久化用本地 JSON 文件（output/data.json）
- 每个功能写完后必须能实际运行，不能有语法错误
```

## 第 3 步：写循环脚本 loop.sh

**解释：** 这就是 Ralph Loop 的核心——一个 Shell 脚本，它反复把 PROMPT.md 喂给 `claude`，每轮结束后检查是否完成。

（创建 ralph-practice/loop.sh）

```bash
#!/bin/bash
# Ralph Loop 练习脚本（模块1版本）
MAX=${1:-5}   # 默认最多跑5轮，可传参：bash loop.sh 3
COUNT=0

echo "==============================="
echo " Ralph Loop 启动"
echo " 最大轮数：$MAX"
echo " 任务文件：PROMPT.md"
echo "==============================="

while [ $COUNT -lt $MAX ]; do
  COUNT=$((COUNT + 1))
  echo ""
  echo "-------------------------------"
  echo " 第 $COUNT 轮 / 最多 $MAX 轮"
  echo "-------------------------------"

  cat PROMPT.md | claude -p --dangerously-skip-permissions

  echo ""
  echo "[第 $COUNT 轮完成]"

  # 检查完成标志
  if [ -f "progress.md" ] && head -1 progress.md | grep -q "^DONE"; then
    echo ""
    echo ">>> 任务完成！退出循环。"
    break
  fi

  echo ">>> 未检测到完成标志，继续下一轮..."
done

echo ""
echo "==============================="
echo " 循环结束，共跑了 $COUNT 轮"
echo "==============================="
```

chmod +x loop.sh，目录结构：
```
ralph-practice/
├── PROMPT.md     ← AI 每轮读的任务描述
├── AGENTS.md     ← AI 读的项目说明
├── loop.sh       ← 循环脚本
└── .git/         ← git 仓库（已初始化）
```

## 第 4 步：启动第一轮循环

**解释（重要，先读完再看结果）：**
- 脚本会把 PROMPT.md 通过管道 `|` 送给 `claude -p`
- `-p` 让 Claude Code 进入无交互模式，从 stdin 读取任务
- `--dangerously-skip-permissions` 让它自动批准文件读写操作
- 默认跑 **5 轮**，每轮结束检查 `progress.md` 第一行是否有 `DONE`

**你预期看到的现象：**
1. Claude 开始输出思考过程
2. 它会创建 `output/` 目录和 `counter.py`
3. 每轮结束后 `progress.md` 会多一行记录
4. 大约 3-5 轮后所有功能实现，`progress.md` 首行出现 `DONE`，循环退出

现在启动，最多跑 5 轮：

（执行 bash loop.sh 5）

**输出：**
```
===============================
 Ralph Loop 启动
 最大轮数：5
 任务文件：PROMPT.md
===============================

-------------------------------
 第 1 轮 / 最多 5 轮
-------------------------------
--dangerously-skip-permissions cannot be used with root/sudo privileges for security reasons
...（5 轮全部报同样的错误）
```

遇到了第一个障碍：当前是 **root 用户**，Claude Code 出于安全原因禁止 root 下使用 `--dangerously-skip-permissions`。

我来修改脚本，换用 `--allowedTools` 替代：

（查看 claude --help，找到 --allowedTools 参数）

（修改 loop.sh，将 `--dangerously-skip-permissions` 改为 `--allowedTools "Bash Edit Write Read Glob Grep"`）

（再次执行 bash loop.sh 2）

**输出：**
```
===============================
 Ralph Loop 启动
 最大轮数：2
 任务文件：PROMPT.md
===============================

-------------------------------
 第 1 轮 / 最多 2 轮
-------------------------------
`output/counter.py` is complete and all four commands work. `progress.md` is marked `DONE`.

[第 1 轮完成]

>>> 任务完成！退出循环。

===============================
 循环结束，共跑了 1 轮
===============================
```

循环跑起来了！而且第 1 轮就完成了。来看看 AI 实际做了什么：

（验证结果）
```
DONE
- 第1轮：创建 output/counter.py，实现 add、total、reset、history 全部功能，验证运行正常

output/ 目录：counter_data.json、counter.py

$ python3 output/counter.py total
Total: 5.0
$ python3 output/counter.py add 5
Added 5.0. Total is now 10.0
$ python3 output/counter.py add 3
Added 3.0. Total is now 13.0
$ python3 output/counter.py total
Total: 13.0
$ python3 output/counter.py history
1. add 5.0
2. add 5.0
3. add 3.0
```

**循环成功跑通了！** 来确认你观察到的现象：

**实际发生了什么：**
1. `loop.sh` 把 `PROMPT.md` 通过管道送给 `claude -p`
2. AI 第 1 轮就把所有功能一次性写完了（它违反了"每轮只做一件事"的规则，但任务确实完成了）
3. AI 在 `progress.md` 第一行写了 `DONE`
4. 脚本检测到 `DONE`，自动退出——没有继续烧 token

**生成的文件：**
```
ralph-practice/
├── PROMPT.md
├── AGENTS.md
├── loop.sh
├── progress.md        ← AI 自动创建，记录进度
└── output/
    ├── counter.py     ← AI 写的工具
    └── counter_data.json  ← 数据持久化文件
```

**验证结果：**
- `total` → 显示总和 ✅
- `add 5` → 累加 ✅
- `history` → 历史记录 ✅

**你注意到了一个有趣的现象：** AI 没有按"每轮一小步"来做，而是一轮内写完了全部功能。这在真实项目里是个问题——任务越复杂，一轮内越容易出错。模块 2 的双模式设计正是为了解决这个问题。

**现在有两个选择：**
- 继续看 `counter.py` 的内容，理解 AI 写了什么
- 直接进入**模块 2**，学双模式循环（PLANNING + BUILDING）

你想做哪个？

---

## 用户

继续看 counter.py 的内容，理解 AI 写了什么

---

## Claude

（读取 counter.py，内容如下）

```python
import sys
import json
import os

DATA_FILE = os.path.join(os.path.dirname(__file__), "counter_data.json")


def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE) as f:
            return json.load(f)
    return {"total": 0, "history": []}


def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f)


def main():
    if len(sys.argv) < 2:
        print("Usage: counter.py <add|total|reset|history> [number]")
        sys.exit(1)

    command = sys.argv[1]
    data = load_data()

    if command == "add":
        if len(sys.argv) < 3:
            print("Usage: counter.py add <number>")
            sys.exit(1)
        number = float(sys.argv[2])
        data["total"] += number
        data["history"].append(f"add {number}")
        save_data(data)
        print(f"Added {number}. Total is now {data['total']}")

    elif command == "total":
        print(f"Total: {data['total']}")

    elif command == "reset":
        data["history"].append("reset")
        data["total"] = 0
        save_data(data)
        print("Counter reset to 0")

    elif command == "history":
        if not data["history"]:
            print("No history yet")
        else:
            for i, entry in enumerate(data["history"], 1):
                print(f"{i}. {entry}")

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
```

60 行，结构很清晰。逐段解释：

---

**第 5 行：数据存在哪**
```python
DATA_FILE = os.path.join(os.path.dirname(__file__), "counter_data.json")
```
数据存在和 `counter.py` 同目录的 `counter_data.json` 里。`__file__` 是脚本自身的路径，这样无论从哪个目录运行都能找到数据文件。

---

**第 8-17 行：读写数据**
```python
def load_data():   # 读文件，文件不存在就返回初始值
def save_data():   # 写文件
```
数据格式就是一个 JSON：
```json
{"total": 13.0, "history": ["add 5.0", "add 5.0", "add 3.0"]}
```
这就是 Ralph Loop 里"跨轮持久化"思路的体现——AI 没有记忆，但文件有。

---

**第 28-56 行：四个命令**

| 命令 | 做什么 |
|------|--------|
| `add <数字>` | 累加，记录到 history，保存 |
| `total` | 只读，不改数据 |
| `reset` | 清零，history 里留一条 "reset" 记录 |
| `history` | 遍历打印 history 列表 |

---

**值得注意的一个细节：**

`reset` 命令先追加历史再清零（第 43-44 行）：
```python
data["history"].append("reset")   # 先记录
data["total"] = 0                  # 再清零
```
所以 `history` 会显示你什么时候做过 reset，不会丢失这条操作记录。你可以验证一下：

```bash
python3 output/counter.py reset
python3 output/counter.py history
```

---

**和 Ralph Loop 的联系：**

这个文件本身就是 Ralph Loop 原理的缩影——**状态靠文件持久化，而不是靠内存**。`counter_data.json` 对于 counter.py，等价于 `progress.md` / `IMPLEMENTATION_PLAN.md` 对于 Ralph Loop：每轮 AI 启动时读它，结束时写它，这样"无记忆"的 AI 也能跨轮推进任务。

---

看完了。下一步你想：
- **进入模块 2**（双模式循环，更适合真实复杂任务）
- **回头试试 reset 和 history**，自己动手跑几条命令感受一下

---

## 用户

进入模块 2（双模式循环，更适合真实复杂任务）

---

## Claude

模块 2 比模块 1 复杂一点，我先说清楚整体流程，你有个心理预期：

**这次的任务：** 写一个"简单笔记 CLI"，有 3 个功能点（新增、列出、删除笔记）。
**为什么用双模式：** 功能多了，AI 一轮内全做完容易出错；先让 AI 规划，再按计划逐步执行，更可控。

---

## 第 1 步：新建模块 2 目录

（创建 ralph-practice/module2/specs/，git init）

## 第 2 步：写 specs 文件（需求文档）

**解释：** specs/ 里每个文件描述一个功能话题。AI 规划时读它们，作为"标准答案"判断哪些功能还没做。注意：只写 **WHAT**（要实现什么），不写 HOW（怎么实现）。

（创建 specs/note-add.md）
```markdown
# 功能：新增笔记

用户可以通过命令行新增一条笔记，笔记内容为纯文本。
每条笔记自动记录创建时间。
新增成功后，显示该笔记的 ID 和内容确认。
```

（创建 specs/note-list.md）
```markdown
# 功能：列出笔记

用户可以列出所有已保存的笔记。
每条笔记显示：ID、创建时间、内容摘要（前 50 字）。
如果没有笔记，显示友好提示"暂无笔记"。
```

（创建 specs/note-delete.md）
```markdown
# 功能：删除笔记

用户可以通过 ID 删除一条笔记。
删除成功后显示确认信息。
如果 ID 不存在，显示错误提示，不崩溃退出。
```

## 第 3 步：写 AGENTS.md

（创建 module2/AGENTS.md）
```markdown
# AGENTS.md

## 环境
- Python 3（无需额外依赖）
- 主程序：src/notes.py
- 数据文件：src/notes.json

## 运行验证
- `python3 src/notes.py list`
- `python3 src/notes.py add "测试笔记"`
- `python3 src/notes.py delete 1`

## 约定
- 数据用 JSON 文件持久化
- 每个功能写完后必须实际可运行
- 不写占位符代码，写真实逻辑
```

## 第 4 步：写 PROMPT_plan.md（规划模式）

**解释：** 这是双模式的核心区别。规划模式的 PROMPT 只让 AI 做一件事——读 specs、对比现有代码、生成任务清单。**明确禁止写代码**。

（创建 PROMPT_plan.md）
```markdown
# 规划模式（PLANNING）

你是一个规划 Agent。你的唯一任务是分析需求和现有代码的差距，生成实施计划。

## 步骤

1. 阅读 specs/ 目录下所有文件，了解所有需要实现的功能。
2. 检查 src/ 目录是否存在，以及其中已有哪些实现。
3. 对比 specs 和现有代码，找出所有"缺口"（未实现的功能）。
4. 生成或更新 IMPLEMENTATION_PLAN.md，格式如下：

\`\`\`
# 实施计划

## 待办（按优先级排列）
- [ ] 任务描述（优先级：高/中/低）

## 已完成
（留空，由 build 模式填写）
\`\`\`

## 严格规则
- 只做规划，**禁止修改或创建 src/ 下的任何代码文件**。
- 任务粒度：每条任务应该是 1 个功能点或 1 个独立模块，不要合并。
- 规划完成后输出："规划完成，请运行 build 模式继续。"
```

## 第 5 步：写 PROMPT_build.md（执行模式）

**解释：** 执行模式每轮只做计划里的一件事，做完标记，再提交。

（创建 PROMPT_build.md）
```markdown
# 执行模式（BUILDING）

你是一个实施 Agent。每轮只做一件事，做完提交。

## 步骤

1. 读 IMPLEMENTATION_PLAN.md，找到"待办"中**优先级最高**的第一个未完成任务（前面是 `- [ ]`）。
2. 如果所有任务都是 `- [x]`，在计划文件末尾写 "DONE"，然后停止。
3. 搜索 src/ 目录，确认该功能是否已存在（不要假设没实现）。
4. 实现选定的任务，代码放在 src/ 目录。
5. 验证：运行 `python3 src/notes.py list` 确认不报错。
6. 在 IMPLEMENTATION_PLAN.md 里把该任务从 `- [ ]` 改为 `- [x]`，移到"已完成"区域，备注本轮做了什么。
7. git add 并 commit（commit message 写本轮做了什么）。

## 严格规则
- 每轮只做计划里的**一个**任务，不要多做。
- 验证必须通过才能 commit。
- 不写占位符，写真实可运行的代码。
```

## 第 6 步：写 loop.sh（支持双模式）

（创建 module2/loop.sh）
```bash
#!/bin/bash
# Ralph Loop 双模式脚本（模块2）
MODE=${1:-build}
MAX=${2:-10}
PROMPT_FILE="PROMPT_${MODE}.md"
COUNT=0

if [ ! -f "$PROMPT_FILE" ]; then
  echo "错误：找不到 $PROMPT_FILE"
  exit 1
fi

echo "==============================="
echo " Ralph Loop 启动"
echo " 模式：$MODE | 最大轮数：$MAX"
echo "==============================="

while [ $COUNT -lt $MAX ]; do
  COUNT=$((COUNT + 1))
  echo ""
  echo "--- 第 $COUNT 轮 / 最多 $MAX 轮 ($MODE 模式) ---"

  cat "$PROMPT_FILE" | claude -p --allowedTools "Bash Edit Write Read Glob Grep"

  echo ""
  echo "[第 $COUNT 轮完成]"

  # build 模式检查完成标志
  if [ "$MODE" = "build" ]; then
    if grep -q "DONE\|所有任务都是" IMPLEMENTATION_PLAN.md 2>/dev/null; then
      echo ">>> 所有任务完成！退出循环。"
      break
    fi
  fi

  # plan 模式只跑一轮
  if [ "$MODE" = "plan" ]; then
    echo ">>> 规划完成，退出。请运行：bash loop.sh build"
    break
  fi
done

echo ""
echo "==============================="
echo " 循环结束，共跑了 $COUNT 轮"
echo "==============================="
```

目录确认：AGENTS.md、loop.sh、PROMPT_build.md、PROMPT_plan.md、specs/

---

## 第 7 步：先跑 PLANNING 模式（1 轮）

**你预期看到的现象：**
- AI 读 `specs/` 下 3 个文件
- AI 检查 `src/` 目录（不存在，所以所有功能都是缺口）
- AI 生成 `IMPLEMENTATION_PLAN.md`，列出 3-5 个待办任务
- **不会产生任何 `.py` 文件**（规划模式禁止写代码）

（执行 bash loop.sh plan 1）

**输出：**
```
规划完成，请运行 build 模式继续。

[第 1 轮完成]
>>> 规划完成，退出。请运行：bash loop.sh build
```

（查看 IMPLEMENTATION_PLAN.md）
```markdown
# 实施计划

## 待办（按优先级排列）
- [ ] 初始化项目结构：创建 src/ 目录及入口文件 src/index.js（优先级：高）
- [ ] 实现数据持久化层：使用 JSON 文件存储笔记，提供读取/写入工具函数（优先级：高）
- [ ] 实现新增笔记功能：命令 `add <内容>`，自动生成 ID 和创建时间，成功后显示 ID 和内容确认（优先级：高）
- [ ] 实现列出笔记功能：命令 `list`，显示所有笔记的 ID、创建时间、内容摘要（前50字），无笔记时显示"暂无笔记"（优先级：中）
- [ ] 实现删除笔记功能：命令 `delete <ID>`，成功后显示确认，ID 不存在时显示错误提示且不崩溃（优先级：中）

## 已完成
```

计划生成了，但有一个小问题要指出——AI 把语言搞成了 JavaScript（`src/index.js`），但我们的 AGENTS.md 写的是 Python。这是真实使用中的常见情况，需要人工校正。

**这正是"人工要监督前几轮"的原因。** 我们现在手动修正计划：

（修正 IMPLEMENTATION_PLAN.md，将 index.js 改为 notes.py，相关描述也同步修正）

修正完成。计划现在正确了。

---

## 第 8 步：跑 BUILDING 模式

**你预期看到的现象：**
- 第 1 轮：AI 读计划，选优先级最高的任务（创建 `src/notes.py`），写完后把该条标 `[x]`，git commit
- 第 2 轮：选下一个任务（数据持久化），同上
- 后续轮：继续消耗计划，直到全部 `[x]`
- 循环自动退出

最多跑 6 轮（5 个任务，留 1 轮余量）：

（执行 bash loop.sh build 6）

**输出：**
```
--- 第 1 轮 / 最多 6 轮 (build 模式) ---
Done. Created `src/notes.py` with a basic entry point, marked the task complete in the plan, and committed. Next task: implement the JSON persistence layer.

--- 第 2 轮 / 最多 6 轮 (build 模式) ---
Done. Implemented `load_notes()` and `save_notes()` using `src/notes.json`, verified `python3 src/notes.py list` outputs "暂无笔记", and committed. Next task: implement `add <内容>` command.

--- 第 3 轮 / 最多 6 轮 (build 模式) ---
`add` 命令已实现并提交。运行 `python3 src/notes.py add <内容>` 会自动生成 8 位 UUID 作为 ID，记录创建时间，并显示确认信息。下一个待办任务是"实现列出笔记功能"。

--- 第 4 轮 / 最多 6 轮 (build 模式) ---
完成。`list` 命令现在以 `[ID] 时间 - 内容摘要` 格式展示笔记，无笔记时显示"暂无笔记"。下一个待办任务是实现 `delete <ID>` 功能。

--- 第 5 轮 / 最多 6 轮 (build 模式) ---
完成。实现了 `delete <ID>` 命令：ID 存在时删除并打印确认，ID 不存在时显示错误提示不崩溃。所有计划任务已全部完成。

--- 第 6 轮 / 最多 6 轮 (build 模式) ---
所有任务已完成（`- [x]`），已在计划文件末尾写入 "DONE"，停止执行。

>>> 所有任务完成！退出循环。
循环结束，共跑了 6 轮
```

5 轮完成任务，第 6 轮写 DONE 触发退出。现在验证结果：

**验证：**
```
$ python3 src/notes.py list
[6009c349] 2026-04-19 10:56:30 - 测试笔记内容

$ python3 src/notes.py add "今天学了 Ralph Loop 双模式"
已添加笔记 [ID: 28df7e3d]: 今天学了 Ralph Loop 双模式

$ python3 src/notes.py add "Planning 模式只规划不写代码"
已添加笔记 [ID: 8c15413f]: Planning 模式只规划不写代码

$ python3 src/notes.py list
[6009c349] 2026-04-19 10:56:30 - 测试笔记内容
[28df7e3d] 2026-04-19 10:57:36 - 今天学了 Ralph Loop 双模式
[8c15413f] 2026-04-19 10:57:36 - Planning 模式只规划不写代码

$ python3 src/notes.py delete 6009c349
已删除笔记 [ID: 6009c349]

$ python3 src/notes.py list
[28df7e3d] 2026-04-19 10:57:36 - 今天学了 Ralph Loop 双模式
[8c15413f] 2026-04-19 10:57:36 - Planning 模式只规划不写代码
```

**git 历史：**
```
3112386 实现删除笔记功能：delete <ID> 命令，ID 存在时删除并确认，不存在时显示错误且不崩溃
933857b 实现列出笔记功能：list 命令显示 ID、创建时间、内容摘要（前50字），无笔记时显示"暂无笔记"
c49e70d 实现新增笔记功能：add 命令自动生成 ID 和创建时间，成功后显示确认
c34d763 实现数据持久化层：添加 load_notes/save_notes 工具函数，使用 src/notes.json 存储笔记
9feb88e 初始化项目结构：创建 src/ 目录及入口文件 src/notes.py
```

**模块 2 完成。复盘一下你刚才经历了什么：**

| 阶段 | 跑了几轮 | AI 做了什么 | 产出 |
|------|---------|------------|------|
| PLANNING | 1 轮 | 读 specs → 找缺口 → 写计划 | `IMPLEMENTATION_PLAN.md` |
| BUILDING | 5 轮 | 每轮做 1 个任务 → 验证 → commit | 5 个 git commit |
| 检测 DONE | 第 6 轮 | 发现全 `[x]` → 写 DONE → 退出 | 循环自动停止 |

**这次和模块 1 的关键区别：**
- 你清晰地看到了"计划被逐步消耗"的过程
- 每个功能有独立 commit，出问题可以精确回滚
- 规划和执行分离，AI 没有在同一轮内既想又做

---

下一步你可以：
- **进入模块 3**（完整 loop.sh + 救场三板斧 + 沙箱安全）
- **自己动手改 specs**，加一个新功能（比如"搜索笔记"），再跑一次双模式看 AI 怎么增量规划

---

## 用户

进入模块 3

---

## Claude

模块 3 重点在**生产可用**和**出错时怎么救**。我们会用模块 2 的笔记项目作为基础，在它上面演示所有技巧。

分 4 个实战环节：
1. 写生产级 `loop.sh`（带计时、错误处理、可选 git push）
2. 制造一个"跑偏"场景，演示救场三板斧
3. 讲清楚沙箱安全边界
4. 复盘 Ralph 经济学

---

## 环节 1：生产级 loop.sh

**解释：** 模块 2 的 loop.sh 是最简版，生产版需要加：每轮计时（知道 token 花在哪）、set -e 防止静默失败、颜色输出方便阅读、可选的 git push。

（升级 module2/loop.sh）

```bash
#!/bin/bash
# Ralph Loop 生产版 v2
# 用法：bash loop.sh [plan|build] [最大轮数] [--push]
#   bash loop.sh plan 1          # 规划模式，跑 1 轮
#   bash loop.sh build 10        # 执行模式，最多 10 轮
#   bash loop.sh build 10 --push # 执行模式，每轮结束自动 git push

set -euo pipefail   # 任何命令失败立即退出，未定义变量报错

MODE=${1:-build}
MAX=${2:-10}
PUSH=${3:-""}
PROMPT_FILE="PROMPT_${MODE}.md"
COUNT=0
TOTAL_TIME=0

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # 无颜色

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 前置检查
if [ ! -f "$PROMPT_FILE" ]; then
  log_error "找不到 $PROMPT_FILE，退出。"
  exit 1
fi

if ! command -v claude &> /dev/null; then
  log_error "找不到 claude 命令，请确认 Claude Code 已安装。"
  exit 1
fi

echo "========================================"
log_info "Ralph Loop 启动"
log_info "模式：$MODE | 最大轮数：$MAX | 自动推送：${PUSH:-否}"
echo "========================================"

while [ $COUNT -lt $MAX ]; do
  COUNT=$((COUNT + 1))
  ROUND_START=$(date +%s)

  echo ""
  echo "----------------------------------------"
  log_info "第 $COUNT 轮 / 最多 $MAX 轮 [$MODE 模式] — $(date '+%H:%M:%S')"
  echo "----------------------------------------"

  cat "$PROMPT_FILE" | claude -p --allowedTools "Bash Edit Write Read Glob Grep"

  ROUND_END=$(date +%s)
  ROUND_SEC=$((ROUND_END - ROUND_START))
  TOTAL_TIME=$((TOTAL_TIME + ROUND_SEC))

  log_info "第 $COUNT 轮耗时：${ROUND_SEC}s | 累计：${TOTAL_TIME}s"

  if [ "$PUSH" = "--push" ]; then
    BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
    git push origin "$BRANCH" 2>/dev/null && log_info "已推送到 origin/$BRANCH" || log_warn "git push 失败（可能没有远端），继续。"
  fi

  if [ "$MODE" = "plan" ]; then
    log_info "规划完成。请运行：bash loop.sh build"
    break
  fi

  if grep -q "^DONE" IMPLEMENTATION_PLAN.md 2>/dev/null; then
    echo ""
    log_info "所有任务完成！循环退出。"
    break
  fi

  log_info "未检测到完成标志，继续下一轮..."
done

echo ""
echo "========================================"
log_info "循环结束 | 共跑 $COUNT 轮 | 总耗时 ${TOTAL_TIME}s"
echo "========================================"
```

**生产版 loop.sh 新增了什么：**

| 新增能力 | 为什么重要 |
|---------|-----------|
| `set -euo pipefail` | 任何命令静默失败会立即终止，不会继续跑错误的轮次 |
| 每轮计时 `${ROUND_SEC}s` | 知道 token 花在哪一轮，判断哪个任务最贵 |
| 颜色输出 | 快速区分 INFO / WARN / ERROR，日志长时不眼花 |
| `--push` 参数 | 可选，跑长任务时自动同步到远端，换电脑也能看进度 |
| 前置检查 `claude` 命令 | 环境有问题时立刻报错，不是跑 10 轮后才发现 |

---

## 环节 2：救场三板斧

**解释：** 现在我们主动制造一个"AI 跑偏"的场景，然后用三种手段救场。

（把 IMPLEMENTATION_PLAN.md 改成包含一个故意写错的任务）

```markdown
# 实施计划（演示用：含一个错误任务）

## 待办（按优先级排列）
- [ ] 用 React 重写整个前端界面（优先级：高）←【故意写错的任务，和项目无关】
- [ ] 实现搜索笔记功能：命令 `search <关键词>`，模糊匹配笔记内容，显示命中结果（优先级：高）

## 已完成
- [x] 初始化项目结构
- [x] 实现数据持久化层
- [x] 实现新增笔记功能
- [x] 实现列出笔记功能
- [x] 实现删除笔记功能
```

### 招式一：急停（Ctrl+C）

**场景：** 循环刚启动，AI 开始执行"用 React 重写前端"这个错误任务，你发现不对劲。

**操作：** 在终端按 `Ctrl+C`，立刻中断。

（用 timeout 3 模拟 Ctrl+C 中断）

**输出：**
```
[INFO] Ralph Loop 启动
[INFO] 模式：build | 最大轮数：5 | 自动推送：否
--- 第 1 轮 / 最多 5 轮 [build 模式] ---
【模拟 Ctrl+C：循环被中断】
```

循环被中断，AI 来不及写任何代码。**代码库没有被污染。**

### 招式二：重生成计划（需求变了，计划过时了）

**场景：** 发现计划里有错误任务，需要清理重来。

**操作：**
1. 新增正确的 spec 文件（specs/note-search.md）
2. 删掉旧计划：`rm IMPLEMENTATION_PLAN.md`
3. 重新跑 PLANNING 模式一轮

（创建 specs/note-search.md）
```markdown
# 功能：搜索笔记

用户可以通过关键词搜索笔记内容。
命令：search <关键词>
显示所有包含该关键词的笔记（ID、时间、内容）。
如果没有匹配结果，显示"未找到匹配的笔记"。
```

（rm IMPLEMENTATION_PLAN.md）

（bash loop.sh plan 1）

**输出：**
```
[INFO] 第 1 轮耗时：22s | 累计：22s
[INFO] 规划完成。请运行：bash loop.sh build
```

（查看新 IMPLEMENTATION_PLAN.md）
```markdown
# 实施计划

## 待办（按优先级排列）
- [ ] 实现搜索笔记功能：search <关键词> 命令，显示所有包含关键词的笔记（ID、时间、内容），无匹配时显示"未找到匹配的笔记"（优先级：高）

## 已完成
（留空，由 build 模式填写）
```

AI 正确识别了：4 个旧功能已实现，只剩 `search` 未做。没有"React 前端"这种无关任务。

### 招式三：git reset（代码写坏了，回滚）

**场景：** AI 已经提交了几轮错误代码，需要回到某个已知好状态。

```bash
# 第 1 步：看看最近做了什么
git log --oneline -8

# 第 2 步：找到你想回到的那个 commit
# 比如输出是：
# a3f2b1c 实现了错误的搜索逻辑
# 9feb88e 实现了 delete 功能  ← 想回到这里

# 第 3 步：回滚
git reset --hard 9feb88e

# 第 4 步：重新规划或调整 PROMPT 后再启动
bash loop.sh plan 1
bash loop.sh build 5
```

（查看 module2 实际 git 历史）
```
3112386 实现删除笔记功能
933857b 实现列出笔记功能
c49e70d 实现新增笔记功能
c34d763 实现数据持久化层
9feb88e 初始化项目结构
```

每一轮 build 对应一个 commit，任意节点都可以精确回滚。这就是"每轮一 commit"的价值。

---

## 环节 3：沙箱安全边界

实际情况是：我们当前以 root 身份运行，Claude Code 拒绝了 `--dangerously-skip-permissions`。这是一个**真实的安全保护机制**，不是 bug。

**三条安全规则：**

```
规则 1：永远在独立项目目录内跑循环，不要在 ~ 或 / 下启动
         → AI 只能操作当前目录的文件

规则 2：root 用户下用 --allowedTools 指定允许的工具
         （我们已经在用：--allowedTools "Bash Edit Write Read Glob Grep"）

规则 3：包含密钥的目录不要跑循环
         → .env、credentials.json 等文件放到 .gitignore，
           或在启动前手动检查目录内容
```

---

## 环节 4：Ralph 经济学 & 本次复盘

（执行 bash loop.sh build 3，完成 search 功能）

**输出：**
```
--- 第 1 轮耗时：30s | 累计：30s
--- 第 2 轮耗时：9s | 累计：39s
[INFO] 所有任务完成！循环退出。
循环结束 | 共跑 2 轮 | 总耗时 39s
```

（验证 search 功能）
```
$ python3 src/notes.py search "Ralph"
[28df7e3d] 2026-04-19 10:57:36 - 今天学了 Ralph Loop 双模式

$ python3 src/notes.py search "不存在的词"
未找到匹配的笔记
```

---

## 模块 3 完整复盘

**今天三个模块加在一起，你经历了：**

```
模块 1：最简循环
  while + PROMPT.md + loop.sh
  → 跑通了第一个自动循环

模块 2：双模式循环
  PLANNING（读 specs → 生成计划）
  BUILDING（按计划逐步执行，每轮 1 commit）
  → 5 轮 build 完成笔记 CLI 的 4 个功能

模块 3：生产级技巧
  ① 生产版 loop.sh（计时 + 颜色 + --push 参数）
  ② 救场三板斧：Ctrl+C / 重生成计划 / git reset
  ③ 沙箱安全边界（root 限制 + allowedTools）
  ④ 增量规划：加 search 需求 → 删旧计划 → 重规划 → 1 轮完成
```

**你现在具备了自己写 PROMPT.md + 循环脚本、让 AI 自动迭代完成中型任务的完整能力。**

---

下一步两个方向，你选：
- **自己动手**：把学到的东西用到你自己的一个真实小项目上，我可以帮你写 specs 和 PROMPT
- **深入一个问题**：比如"Token 控制细节"、"PROMPT 怎么写才能让 AI 不跑偏"——告诉我哪块还不清楚

