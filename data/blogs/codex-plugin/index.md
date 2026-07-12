# 在 Claude Code 里用 GPT-5.4 审查 Claude 的代码：Codex 插件使用指南

> 核心思路：**写代码的模型和审查代码的模型应该分开。** 每个模型对自己的"写法"都有盲点——Claude 写完代码、Claude 自己审查，结论往往是"看起来不错"，然后 bug 在生产环境冒出来。只品尝自己菜的厨师永远觉得自己做得好。让另一个模型（GPT-5.4 / Codex）来挑刺，能稳定地发现自我审查发现不了的东西。

OpenAI 发布的 **Codex 插件**让这件事变得很简单：在 Claude Code 终端里直接调用 GPT-5.4，不用切换环境。两个最强的模型在同一个工作流里协作。

---

## 一、三步安装

> 前置条件：
> - 一个 ChatGPT 账户（免费账户也可以）。
> - 本地已安装 **Node.js 18.18+**——插件的所有斜杠命令底层都通过 Node 运行的 companion 脚本执行，没有合适的 `node`，`/codex:setup` 无法运行、也无法引导你安装 Codex。

```bash
# 步骤 1：添加 OpenAI 插件市场
/plugin marketplace add openai/codex-plugin-cc

# 步骤 2：安装 Codex 插件
/plugin install codex@openai-codex

# 步骤 3：检查环境并连接 ChatGPT 账户
/codex:setup
```

- 步骤 2 会问你"为当前项目安装"还是"全局安装"——选**全局（为你安装）**，这样在任何项目里都能用。
- 步骤 3 会检查本地 Codex CLI 是否就绪。如果没装会提示你安装；如果没登录，在 Claude Code 里要输入 `!codex login`（`!` 前缀才会作为 shell 命令执行，否则会被当成聊天文字而卡住），在浏览器里完成认证。
- 如果安装后命令没出现，运行 `/reload-plugins`。
- 验证：输入 `/codex` 应能看到下面这一组命令。

**一个硬性要求：项目必须是已初始化的 git 仓库。** Codex 从 `git status` 开始判断改动范围，没有 git 会直接中止。

---

## 二、命令速查表

| 命令 | 作用 | 是否改你的代码 |
|------|------|:---:|
| `/codex:review` | 对未提交的改动做标准代码审查 | 否（只读） |
| `/codex:adversarial-review` | 对抗式审查，质疑实现方式与设计决策 | 否（只读） |
| `/codex:rescue` | 让 Codex 直接调查问题 / 修代码 | **是**（会动代码） |
| `/codex:status` | 查看本仓库正在跑和跑过的 Codex 任务 | 否 |
| `/codex:result <job-id>` | 取某个已完成任务的完整结果 | 否 |
| `/codex:cancel <job-id>` | 取消一个后台任务 | 否 |
| `/codex:transfer` | 把当前 Claude 会话转成可恢复的 Codex 线程 | 否 |
| `/codex:setup` | 检查环境 / 开关审查门禁 | 否 |

---

## 三、最常用：两种审查

### `/codex:review` —— 标准审查（推送前必跑）

只读，不会改你的代码，只把 GPT-5.4 的审查结论原样返回。它擅长抓 Claude 容易忽略的**边缘情况和性能问题**——不同的训练、不同的习惯、不同的盲点。

```bash
/codex:review                      # 审查当前工作区未提交的改动
/codex:review --wait               # 前台运行，等结果（适合小改动）
/codex:review --background         # 后台运行，用 /codex:status 查进度（适合大 diff）
/codex:review --base main          # 与 main 分支对比来确定审查范围
/codex:review --scope branch       # 审查整条分支，而非仅工作区
```

`--scope` 可选 `auto`（默认，自动判断）/ `working-tree`（仅未提交改动）/ `branch`（整条分支）。

### `/codex:adversarial-review` —— 对抗式审查（重要决策时用）

比标准审查更"狠"，但重点不是抓更多代码缺陷，而是**质疑你的方法本身**：当前实现是不是最优的？依赖了哪些假设？在真实环境下哪里会崩？

```bash
/codex:adversarial-review
/codex:adversarial-review 重点看并发安全和数据一致性   # 可以追加关注点
```

> 经验：别对所有改动都跑对抗式审查——对小改动是杀鸡用牛刀。**日常用标准审查，把对抗式留给架构决策和复杂功能。** 标准审查足够快，可以每次提交前都跑，不拖节奏。

---

## 四、超出文章的实用用法

### 1. 让 Codex 不止"审查"，而是直接"救火"：`/codex:rescue`

`review` 系列是只读的。当你想让 GPT-5.4 **真正动手**调查 bug 或写修复时，用 `rescue`——它会把任务委派给 Codex 子代理。适合 Claude 卡住了、想要第二种实现思路、或需要更深的根因分析时。

```bash
/codex:rescue 这个测试间歇性失败，帮我定位根因并修复
/codex:rescue --background 重构这个模块的错误处理
/codex:rescue --model spark --effort high 复杂的性能问题
```

常用参数：
- `--wait` / `--background`：前台等结果 / 后台跑。
- `--resume` / `--fresh`：接着上次的上下文 / 全新开始。
- `--effort none|minimal|low|medium|high|xhigh`：思考深度，越高越慢越细。

### 2. 把会话交接给 Codex：`/codex:transfer`

把当前 Claude Code 会话转成一个**可恢复的 Codex 线程**，拿到一个 session ID 后可以在 Codex CLI 里用 `codex resume <session-id>` 继续。适合在 Claude 里规划、到 Codex 里接手执行的场景。

### 3. 后台任务三件套：`status` / `result` / `cancel`

大 diff 的审查会比较慢。用 `--background` 把它丢到后台，然后：

```bash
/codex:status              # 看本仓库所有任务的状态表（job-id、类型、阶段、耗时）
/codex:status <job-id>     # 看某个任务的详细进度
/codex:result <job-id>     # 任务跑完后取完整结论（含 verdict、findings、文件行号）
/codex:cancel <job-id>     # 不想等了就取消
```

### 4. 停止前强制审查：审查门禁（Review Gate）

可以让 Claude 在结束一次工作前**强制先过一遍 Codex 审查**，避免"忘了 review 就推送"。

```bash
/codex:setup --enable-review-gate    # 开启
/codex:setup --disable-review-gate   # 关闭
```

---

## 五、推荐工作流

```
1. Claude 写代码（后端、架构、复杂逻辑、多文件重构）
2. 提交前：/codex:review                  → 验证：GPT-5.4 无高优先级 findings
3. 重要决策再加：/codex:adversarial-review  → 验证：方法/假设经得起质疑
4. Claude 根据 Codex 的反馈修复
5. （可选）/codex:rescue 让 Codex 直接处理它更擅长的部分
6. 推送 / 发布
```

---

## 六、两个模型，各有所长

把它们配在一起的意义，正是因为强弱互补：

| 维度 | Claude (Opus 4.6) | GPT-5.4 (Codex) |
|------|------|------|
| 后端架构 / 多文件重构 / 结构化规划 | **更强**（Plan 模式领先） | 一般 |
| 前端 / 快速出好看的原型 | 一般 | **更精致、更快** |
| 复杂真实工程问题（SWE-bench Pro） | ~45% | **57.7%** |
| 典型缺点 | 容易**过度设计**（要个小功能给你一套十年架构） | 命名约定偏**死板** |

> 标准基准上两者很接近（SWE-bench Verified：GPT-5.4 80% / Opus 4.6 80.8%；HumanEval：93.1% / 90.4%）。真正拉开差距的是更难"刷分"的 SWE-bench Pro。两个都不完美，但放一起会相互平衡——这正是跨模型审查的价值。

### 成本参考（每百万 token）

| 模型 | 输入 | 输出 |
|------|------|------|
| GPT-5.4 | $2.50 | $15 |
| Opus 4.6 | $5 | $25 |

GPT-5.4 输入价是一半、输出便宜约 40%。对整天跑的代理团队来说，这笔差价不容忽视。

---

## 小结

如果你已经在用 Claude Code，安装只要三分钟。**在你下次推送前，先跑一下 `/codex:review`**——让另一个模型而不是 Claude 自己来审查，差别会立刻显现出来。
