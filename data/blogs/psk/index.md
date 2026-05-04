# Prompt: 帮我系统学习 Agent Skills（给 Claude Code 的任务书）

## T — Task（任务）
你是我的**技术导师 + 陪练**。我要学习 **Agent Skills**（Anthropic 推出的能力封装机制：通过 `SKILL.md` + 配套文件，让 Claude 按需加载特定领域的知识、流程和脚本）。请为我产出一份**实践导向**的学习文档，并在我准备好之后，**带我从零写一个属于自己的 Skill**，再逐步升级到能复用、能分发的 Master 级。

交付物分两阶段：
1. **阶段一（文档）**：生成 `agent-skills-learning.md`，按三层模块组织。
2. **阶段二（陪练）**：文档写完后暂停，问我："要从哪个模块开始动手？" 然后在本机带我真实写一个 Skill 并跑通。

## R — Request（具体要求）

### 文档结构（严格遵守）
```
# Agent Skills 学习路线
## 0. 它是什么 & 和 Tool / MCP / System Prompt 的区别（150 字以内白话）
## 1. 基础必学模块 —— 写出第一个能被加载的 Skill
## 2. 进阶模块 —— 写出能干真活的 Skill
## 3. Master 模块 —— 可分发、可复用、可组合的 Skill
## 4. 什么时候【不该】用 Skill（用 Tool / MCP / Prompt 更合适的场景）
## 5. 动手路线图（从哪个练习开始）
```

### 三层模块必须覆盖的知识点（最少这些，可多不可少）

**基础必学（目标：写出第一个 Skill 并被 Claude 正确触发）**
- Skill 的本质：什么是"渐进式披露"（progressive disclosure），为什么这是 Skill 的核心设计哲学
- `SKILL.md` 的 frontmatter 必填字段：`name` 和 `description` 各自的作用
- `description` 写法的关键：它决定 Claude **要不要加载这个 Skill**，所以必须包含触发词
- Skill 的目录结构：`SKILL.md` + 可选的脚本、模板、参考文档
- Skill 在哪里放、Claude Code 怎么发现它（`/mnt/skills/...` 或项目本地路径）
- 一个 Hello-World 级 Skill 的最小结构

**进阶（目标：Skill 真的能改变 Claude 的行为）**
- 在 `SKILL.md` 里写"工作流"：步骤化指令、必须先做 X 再做 Y 的强约束
- 引用配套文件：什么时候让 Claude 读 `reference.md`，什么时候让它执行 `script.py`
- "上下文窗口预算"思维：为什么 Skill 主体要短，细节放进可选文件
- `description` 的触发精度调优：太宽会乱触发，太窄会触发不到
- Skill 和 Tool 的协作：Skill 教 Claude **怎么用** Tool，Tool 提供**能力**
- 如何在 Skill 里嵌入"反例"和"禁止事项"（比这么做更有效：只写"应该怎么做"）
- 调试：Claude 没触发我的 Skill 怎么办？触发了但没按我说的做怎么办？

**Master（目标：写出能交付给别人/团队/产品的 Skill）**
- 多文件 Skill 的组织模式：主文件路由 + 子文件深度内容
- 用脚本（Python / Bash）做"确定性兜底"：把不该让 LLM 自由发挥的步骤固化成代码
- Skill 的版本化与测试：怎么验证改了 `description` 之后触发率是变好还是变坏
- Skill 和 MCP 的关系与边界：什么时候该把 Skill 升级成 MCP server
- 安全考虑：Skill 里的脚本会被执行，如何防止 prompt injection 或恶意路径访问
- 分发方式：项目级 / 用户级 / 公共 skill，以及 Anthropic 官方仓库的贡献流程
- 反模式集合：常见写废的 Skill 长什么样（口号式 description、巨型单文件、和 system prompt 重复等）

### 每个知识点必须包含这 4 块（缺一不可）
- **🔧 这是什么**：一句话。
- **✅ 加上它/这么做，你会得到**：具体、可观察的效果。例："Claude 在用户说'帮我做个 PPT'时会自动加载 pptx skill，而不是凭记忆瞎写 python-pptx 代码"。
- **⚠️ 改动它，会发生什么**：2-3 个常见修改和后果。例："把 description 写成'一个很有用的 PPT skill'→ Claude 永远不知道什么时候该用它，触发率近 0"。
- **🧪 最小可跑示例**：一段真实的 `SKILL.md` 片段或目录结构，**能直接复制使用**，不要 `# ... 省略`。

### 风格要求
- 新手友好。术语第一次出现一句话解释（progressive disclosure、frontmatter、触发词等）。
- 多用「如果你…就会…」句式。
- 每个模块开头一句"**学完这节你能做到什么**"。
- 每个知识点 1 屏以内。
- 大量使用**对比示例**：好的 description vs 坏的 description，并排放、标注差异。

## A — Action（执行步骤）

按顺序，不要跳步：

1. **先看一手资料**，三个来源都要看：
   - **官方文档**：用 WebSearch + WebFetch 抓 `docs.claude.com` 上 Agent Skills 的官方文档（关键词："Agent Skills" site:docs.claude.com、"SKILL.md" anthropic）。
   - **官方示例仓库**：搜 `github.com/anthropics/skills`，挑 2-3 个有代表性的 skill 把 `SKILL.md` 完整读一遍。
   - **本机现成 skill**：直接 `view /mnt/skills/public/`，挑 `pdf`、`docx`、`pptx`、`xlsx`、`skill-creator` 这几个里的 `SKILL.md` 至少读 3 个。**这一步特别重要**，因为这是 Anthropic 自己写的标杆，比任何二手教程都准。
   
   如果某个来源访问不到，**停下来告诉我**，不要编造结构。
2. **列大纲**：把三层模块的知识点清单 + 你打算引用的官方实例发给我，等我说 "OK 继续"。
3. **写文档**：按上面结构和四块格式生成 `agent-skills-learning.md`。
4. **自检**：逐条对照 Request 打勾。重点检查每个 `SKILL.md` 示例的 frontmatter 字段名和官方实例**完全一致**（不要凭印象写）。
5. **暂停提问**：问我从哪个模块开始动手，并给我 3 个候选练习题（例如：写一个"中文邮件润色" skill / 写一个"读取 CSV 并出诊断报告" skill / 写一个"提交前 git 检查清单" skill）。
6. **陪练**：根据我的选择，创建 `skills-practice/<skill-name>/` 目录，带我真实写一个 Skill 并验证：
   - 每一步先解释原理 → 再让我尝试 → 再点评修改。
   - 写完 `description` 后，先让我**预测** Claude 在哪些 prompt 下会/不会触发它，再实测。
   - Master 阶段的练习要求至少包含一个配套脚本和一个 reference 文件，让我体会"渐进披露"。

## C — Context（上下文）

- 我是**新手**，刚接触 Claude Code。会写一点 Markdown，Python 能看懂能改，但还没写过 Skill。
- 我的最终目标：能写出一个我自己每天都用的 Skill（比如个人写作风格、工作流程检查清单、领域专属代码规范），并且知道什么时候该升级成 MCP。
- 边界澄清（文档里必须讲清楚，否则我会混淆）：
  - **Skill ≠ System Prompt**：System Prompt 永远在上下文，Skill 是按需加载。
  - **Skill ≠ Tool**：Tool 是"能力"（能调 API、能读文件），Skill 是"知识 + 流程"（教 Claude 在某种场景下该怎么思考和做事）。
  - **Skill ≠ MCP Server**：MCP 是跨进程的服务接口，Skill 是同进程的指令文件。
  - **Skill ≠ RAG**：RAG 是按相似度查文档片段，Skill 是按 description 整体决定要不要加载。
- 我担心的事：写了 Claude 不触发、触发了不照做、写得太长烧 token。文档里请针对这三点给具体手段。
- 环境：macOS / Linux，已经能用 Claude Code，本机 `/mnt/skills/` 下有公共 skill 可参考。

## E — Example（样板，请照此风格写每个知识点）

> ### 1.2 description —— Skill 的"广告语"，决定它会不会被翻牌
> **🔧 这是什么**  
> `SKILL.md` frontmatter 里的一段描述文字。Claude 在每轮对话开头会扫一眼所有 Skill 的 `description`，决定**这次要不要把这个 Skill 的正文加载进上下文**。
>
> **✅ 这么做，你会得到**  
> - description 写得准 → 用户一说相关需求，Skill 自动被加载，Claude 行为立刻按你的规则走。
> - 写得包含**具体触发词 + 适用场景 + 不适用场景** → 在该用的时候用、不该用的时候不乱触发。
>
> **⚠️ 改动它，会发生什么**  
> - 写成 "一个有用的 Excel skill" → 太抽象，Claude 不知道何时触发，等于没写。
> - 写得太宽 "处理任何数据相关的请求" → 用户问个简单加法都触发，浪费上下文。
> - 只写功能不写场景 "可以创建、读取、修改 Excel 文件" → Claude 不知道**何时**该用它，触发不稳定。
>
> **🧪 对比示例**
>
> ❌ 坏的：
> ```yaml
> ---
> name: excel-helper
> description: A skill for working with Excel files.
> ---
> ```
>
> ✅ 好的（参考官方 xlsx skill 的写法）：
> ```yaml
> ---
> name: xlsx
> description: Use this skill any time a spreadsheet file is the primary input
>   or output. Trigger when the user wants to open, read, edit, or fix .xlsx /
>   .xlsm / .csv / .tsv files; create new spreadsheets; or convert between
>   tabular formats. Do NOT trigger when the deliverable is a Word document,
>   HTML report, or standalone Python script even if tabular data is involved.
> ---
> ```
> **差异在哪：** 好的版本包含①具体文件类型触发词 ②动作动词清单 ③明确的"不触发"边界。

---

**请现在开始执行 Action 第 1 步。三个来源都要看，看完先把找到的资料和你打算引用的官方 skill 实例列给我，再进入第 2 步。**