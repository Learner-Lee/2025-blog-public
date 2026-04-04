# Claude Code Agent Skill 使用与学习指南

> 版本：2026-03 | 适用：Claude Code CLI

---

## 目录

1. [什么是 Skill](#1-什么是-skill)
2. [Skill 的存储位置](#2-skill-的存储位置)
3. [创建你的第一个 Skill](#3-创建你的第一个-skill)
4. [SKILL.md 文件格式详解](#4-skillmd-文件格式详解)
5. [Frontmatter 配置参考](#5-frontmatter-配置参考)
6. [变量与占位符](#6-变量与占位符)
7. [调用 Skill 的方式](#7-调用-skill-的方式)
8. [动态上下文注入](#8-动态上下文注入)
9. [高级用法：Subagent 集成](#9-高级用法subagent-集成)
10. [Skill vs 其他功能对比](#10-skill-vs-其他功能对比)
11. [最佳实践](#11-最佳实践)
12. [故障排查](#12-故障排查)
13. [完整示例集](#13-完整示例集)

---

## 1. 什么是 Skill

**Skill（技能）** 是 Claude Code 中可复用的扩展单元，本质上是一段结构化的提示词（Prompt），以 `/斜杠命令` 的形式供用户调用，或由 Claude 在对话中自动识别并调用。

### 核心特点

- **提示词驱动**：Skill 是指令集合，Claude 根据这些指令决定如何操作
- **可复用**：一次定义，多处使用，支持跨项目共享
- **可自动触发**：Claude 会根据 `description` 字段判断何时主动加载
- **支持参数**：可传入动态参数，实现灵活调用
- **遵循开放标准**：基于 [Agent Skills](https://agentskills.io) 开放标准

### Skill 的两种主要用途

| 类型 | 说明 | 示例 |
|------|------|------|
| **参考内容型** | 给 Claude 注入领域知识、规范 | API 编码规范、测试约定 |
| **任务执行型** | 执行具体工作流程 | 部署应用、修复 Bug、生成文档 |

---

## 2. Skill 的存储位置

Skill 位置决定其作用范围，优先级从高到低：

```
企业级（Enterprise）      最高优先级
  ↓
个人级（Personal）         ~/.claude/skills/<skill-name>/SKILL.md
  ↓
项目级（Project）          .claude/skills/<skill-name>/SKILL.md
  ↓
插件级（Plugin）           <plugin>/skills/<skill-name>/SKILL.md
```

### 目录结构

```
.claude/
└── skills/
    ├── deploy/
    │   ├── SKILL.md          # 必须文件（大小写敏感）
    │   ├── reference.md      # 可选：详细参考文档
    │   └── scripts/
    │       └── validate.sh   # 可选：辅助脚本
    ├── code-review/
    │   └── SKILL.md
    └── api-docs/
        ├── SKILL.md
        └── examples.md
```

> **重要**：文件必须命名为 `SKILL.md`（大小写敏感），放在以 skill 名称命名的子目录中。

### Monorepo 支持

Claude Code 会自动发现嵌套 `.claude/skills/` 目录中的 Skill：

```
packages/
├── frontend/
│   ├── .claude/
│   │   └── skills/
│   │       └── component-gen/   # 仅前端包有效
│   └── src/
└── backend/
    ├── .claude/
    │   └── skills/
    │       └── api-endpoint/    # 仅后端包有效
    └── src/
```

---

## 3. 创建你的第一个 Skill

### 步骤一：创建目录

```bash
# 个人级 Skill（适用所有项目）
mkdir -p ~/.claude/skills/explain-code

# 项目级 Skill（仅限当前项目）
mkdir -p .claude/skills/explain-code
```

### 步骤二：创建 SKILL.md

```bash
cat > ~/.claude/skills/explain-code/SKILL.md << 'EOF'
---
name: explain-code
description: 用类比和图示解释代码。当用户询问"这段代码怎么工作"时自动使用。
---

解释代码时，请按以下结构进行：

1. **类比**：用日常生活中的事物类比这段代码
2. **ASCII 图示**：用 ASCII 艺术展示数据流或结构关系
3. **逐步解析**：按执行顺序解释每个步骤
4. **常见误区**：指出一个容易犯的错误或常见误解

保持解释通俗易懂，避免过度技术术语。
EOF
```

### 步骤三：验证 Skill

在 Claude Code 中输入：
```
/explain-code
```

或直接问：
```
这段认证代码是怎么工作的？
```

---

## 4. SKILL.md 文件格式详解

每个 `SKILL.md` 由两部分组成：

```markdown
---
# YAML Frontmatter（配置区）
name: skill-name
description: 这个 skill 做什么，Claude 用这个决定何时自动加载
---

# Markdown 内容（指令区）
你的具体指令写在这里...

可以包含：
- 有序/无序列表
- 代码块
- 表格
- 对其他文件的引用
```

### 支持的文件组织

```
my-skill/
├── SKILL.md          # 主文件，包含导航和核心指令
├── reference.md      # 详细 API 参考（从 SKILL.md 引用）
├── examples.md       # 使用示例
└── scripts/
    └── helper.sh     # Claude 可以执行的辅助脚本
```

在 SKILL.md 中引用其他文件：
```markdown
---
name: code-generator
description: 从模板生成样板代码
---

详细 API 参考请见 [reference.md](reference.md)
使用示例请见 [examples.md](examples.md)
```

---

## 5. Frontmatter 配置参考

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `name` | 目录名 | 显示名称（小写，连字符，最多 64 字符） |
| `description` | 内容第一段 | Skill 的用途描述，**Claude 用此决定何时自动加载** |
| `argument-hint` | 无 | 自动补全中显示的参数提示，如 `[issue-number]` |
| `disable-model-invocation` | `false` | 设为 `true` 则禁止 Claude 自动调用，仅允许用户手动触发 |
| `user-invocable` | `true` | 设为 `false` 则从 `/` 菜单隐藏，仅供 Claude 内部使用 |
| `allowed-tools` | 所有工具 | 无需权限确认即可使用的工具列表 |
| `model` | 继承会话设置 | 覆盖此 Skill 使用的模型 |
| `context` | 主对话 | 设为 `fork` 则在隔离的子 Agent 中运行 |
| `agent` | `general-purpose` | 当 `context: fork` 时使用的 Agent 类型 |
| `hooks` | 无 | 作用于此 Skill 生命周期的 Hooks |

### 调用控制矩阵

| 配置 | 用户可调用 | Claude 可自动调用 |
|------|-----------|-----------------|
| 默认 | ✅ | ✅ |
| `disable-model-invocation: true` | ✅ | ❌ |
| `user-invocable: false` | ❌ | ✅ |

### model 可用值

```yaml
model: sonnet        # claude-sonnet-4-6（推荐）
model: opus          # claude-opus-4-6（最强大）
model: haiku         # claude-haiku-4-5（最快速）
model: claude-opus-4-6  # 完整模型 ID
```

---

## 6. 变量与占位符

Skill 内容支持动态字符串替换：

### 变量列表

| 变量 | 说明 | 示例 |
|------|------|------|
| `$ARGUMENTS` | 调用时传入的所有参数 | `/fix-issue 123` → `123` |
| `$ARGUMENTS[N]` | 按索引获取参数（0-based） | `$ARGUMENTS[0]` = 第一个参数 |
| `$N` | `$ARGUMENTS[N]` 的简写 | `$0`, `$1`, `$2` |
| `${CLAUDE_SESSION_ID}` | 当前会话 ID | 用于日志或会话特定文件 |
| `${CLAUDE_SKILL_DIR}` | Skill 的 SKILL.md 所在目录 | 引用同目录下的脚本 |

### 示例：单参数

```yaml
---
name: fix-issue
description: 修复指定 GitHub Issue
disable-model-invocation: true
---

修复 GitHub Issue #$ARGUMENTS，遵循我们的编码规范：

1. 获取 Issue 详情
2. 理解需求和复现步骤
3. 定位相关代码
4. 实现最小化修复
5. 编写/更新测试
```

调用：`/fix-issue 123` → `$ARGUMENTS` 替换为 `123`

### 示例：多参数

```yaml
---
name: migrate-component
description: 将组件从一个框架迁移到另一个
argument-hint: [组件名] [源框架] [目标框架]
---

将 $0 组件从 $1 迁移到 $2：

1. 分析 $0 的现有实现
2. 理解 $1 和 $2 的差异
3. 编写等效的 $2 实现
4. 保留所有现有行为和测试
```

调用：`/migrate-component SearchBar React Vue`
- `$0` = `SearchBar`
- `$1` = `React`
- `$2` = `Vue`

---

## 7. 调用 Skill 的方式

### 方式一：斜杠命令（手动调用）

```
/skill-name
/skill-name argument
/skill-name arg1 arg2 arg3
```

输入 `/` 后会显示自动补全菜单。

### 方式二：Claude 自动调用

Claude 根据 `description` 字段判断对话是否与 Skill 相关，自动加载并使用。

优化 description 让自动触发更准确：
```yaml
description: 代码审查工具。**在代码修改后主动使用**。分析性能、安全性和最佳实践。
```

关键词 `use proactively`（主动使用）或 `use when`（当...时使用）会提示 Claude 主动调用。

### 方式三：@-提及（桌面/Web）

在对话框中输入 `@`，从弹出列表中选择 Skill，确保其一定被调用。

---

## 8. 动态上下文注入

使用 `` !`command` `` 语法在 Skill 内容发送给 Claude 前执行 shell 命令，并将输出嵌入：

```yaml
---
name: pr-summary
description: 总结 Pull Request 的变更
context: fork
agent: Explore
allowed-tools: Bash(gh *)
---

## 当前 PR 信息

- **Diff 内容**：
!`gh pr diff`

- **PR 描述和评论**：
!`gh pr view --comments`

## 你的任务

根据以上信息，写一份简洁的 PR 摘要，包含：
1. 主要变更内容
2. 影响范围
3. 需要审查者关注的重点
```

### 其他动态注入示例

```yaml
---
name: git-summary
description: 总结最近的提交记录
---

## 最近 10 条提交
!`git log --oneline -10`

## 最近变更的文件
!`git diff --name-only HEAD~5`

请总结这些变更，识别主要工作方向和潜在风险。
```

---

## 9. 高级用法：Subagent 集成

### 在隔离上下文中运行

使用 `context: fork` 让 Skill 在独立的 Subagent 中运行，不污染主对话：

```yaml
---
name: code-audit
description: 对代码库进行全面的安全审计
context: fork
agent: Plan
allowed-tools: Read, Grep, Glob
---

对代码库进行全面审计：

1. 搜索潜在的安全漏洞（SQL 注入、XSS、命令注入等）
2. 检查身份验证和授权逻辑
3. 识别敏感数据处理问题
4. 生成详细的审计报告，包含文件路径和行号
```

### Agent 类型选择

| Agent 类型 | 适用场景 |
|-----------|---------|
| `general-purpose` | 通用任务（默认） |
| `Explore` | 代码探索、文件搜索、只读分析 |
| `Plan` | 架构设计、实现规划 |

### 在 Subagent 中预加载 Skills

在 `.claude/agents/` 中定义 Agent，并预加载 Skill：

```yaml
---
name: api-developer
description: 负责实现 API 端点的专用 Agent
skills:
  - api-conventions
  - error-handling-patterns
---

实现 API 端点，遵循预加载的规范。
```

### 开启扩展思考模式

在 Skill 内容中任意位置包含 `ultrathink` 词语，即可启用扩展思考：

```yaml
---
name: architecture-design
description: 设计系统架构方案
---

这是一个需要深度思考的 ultrathink 架构设计任务。

分析需求，设计最优的系统架构...
```

---

## 10. Skill vs 其他功能对比

### Skill vs Hooks

| 维度 | Skill | Hooks |
|------|-------|-------|
| **本质** | 可复用的提示词/工作流 | 生命周期事件的自动化 |
| **触发方式** | 手动 (`/name`) 或 Claude 自动 | 事件驱动（PreToolUse、PostToolUse 等） |
| **执行者** | Claude | 确定性的 Shell 命令/脚本 |
| **适用场景** | 给 Claude 指令和上下文 | 自动格式化、校验命令、通知 |
| **示例** | `/explain-code src/auth.ts` | 编辑文件后自动运行 lint |

### Skill vs CLAUDE.md

| 维度 | Skill | CLAUDE.md |
|------|-------|-----------|
| **加载时机** | 按需（手动或自动触发） | 始终加载（有大小限制） |
| **作用域** | 特定工作流或知识领域 | 整个项目的持久上下文 |
| **适用场景** | 可复用模板、特定工作流 | 项目规范、架构概览 |
| **示例** | `/deploy production` | "使用 Bun 而非 npm" |

### Skill vs Subagents

| 维度 | Skill | Subagents |
|------|-------|-----------|
| **上下文** | 加载到主对话 | 独立的上下文窗口 |
| **隔离性** | 无（除非 context: fork） | 完全隔离 |
| **适用场景** | 参考资料、指令集 | 复杂的独立任务 |

---

## 11. 最佳实践

### 1. 保持 SKILL.md 简洁

SKILL.md 建议不超过 500 行。将详细资料移至独立文件：

```
my-skill/
├── SKILL.md        # 概述和导航（<100 行）
├── reference.md    # 详细参考（从 SKILL.md 链接）
└── examples.md     # 使用示例
```

### 2. 编写精确的 description

`description` 是 Claude 判断何时自动加载的依据：

```yaml
# ❌ 不好：太模糊
description: 处理代码

# ✅ 好：明确说明场景
description: 代码审查工具。在用户完成代码修改后主动使用。检查性能、安全性和最佳实践，提供具体改进建议。
```

### 3. 为副作用 Skill 禁用自动调用

有副作用的工作流（部署、提交、删除等）应禁用自动调用：

```yaml
---
name: deploy
description: 部署应用到生产环境
disable-model-invocation: true  # 必须！防止意外部署
---
```

### 4. 最小权限原则

只授权 Skill 实际需要的工具：

```yaml
---
name: code-explorer
description: 探索代码结构（只读）
allowed-tools: Read, Grep, Glob    # 只允许只读工具
# 不允许 Bash、Edit、Write 等修改工具
---
```

### 5. 为复杂任务使用 context: fork

长时间运行的分析任务应在隔离环境中执行：

```yaml
---
name: deep-analysis
context: fork
agent: Explore
---
```

### 6. 提供参数提示

帮助用户了解如何传参：

```yaml
---
name: generate-test
argument-hint: [文件路径] [测试类型]
---
```

在 `/` 菜单中会显示：`generate-test [文件路径] [测试类型]`

---

## 12. 故障排查

### Skill 不触发

1. 检查 `description` 中是否包含用户自然表达的关键词
2. 验证文件路径：`.claude/skills/<skill-name>/SKILL.md`
3. 文件名大小写是否正确（必须是 `SKILL.md`）
4. 重启会话（新增文件后需要重启）
5. 直接用 `/skill-name` 手动测试

### Skill 触发太频繁

1. 让 `description` 更具体，减少误触发
2. 使用 `disable-model-invocation: true` 改为纯手动调用

### Claude 看不到所有 Skill

Skill descriptions 最多占用约 2% 的上下文窗口（最少 16,000 字符）。如果有太多 Skill，部分会被排除：

```bash
# 扩大 Skill 描述的上下文预算
export SLASH_COMMAND_TOOL_CHAR_BUDGET=20000
```

运行 `/context` 查看上下文使用情况的警告信息。

### 调试 Shell 命令注入

测试 `` !`command` `` 语法：

```bash
# 先在终端测试命令
gh pr diff
git log --oneline -10
```

确保命令在当前目录下可以正常执行。

---

## 13. 完整示例集

### 示例 1：GitHub Issue 修复器

```yaml
---
name: fix-issue
description: 修复指定的 GitHub Issue。当用户提到修复某个 Issue 时自动使用。
argument-hint: [issue-number]
disable-model-invocation: true
allowed-tools: Bash(gh *), Read, Edit, Grep, Glob
---

修复 GitHub Issue #$ARGUMENTS：

1. **获取 Issue 信息**
   ```bash
   gh issue view $ARGUMENTS
   ```

2. **理解问题**：阅读 Issue 描述、复现步骤和期望行为

3. **定位代码**：使用 Grep/Glob 找到相关代码

4. **实现修复**：做最小化、精准的修改

5. **编写测试**：确保修复被测试覆盖

6. **提交信息**：格式为 `fix: 修复 #$ARGUMENTS <简短描述>`
```

### 示例 2：自动代码审查

```yaml
---
name: review
description: 审查代码变更，检查质量、安全性和最佳实践。代码修改后主动使用。
allowed-tools: Read, Grep, Glob, Bash(git *)
---

审查以下代码变更：

## 当前变更
!`git diff --staged`

## 审查清单

### 代码质量
- [ ] 命名是否清晰表达意图
- [ ] 是否有重复代码（DRY 原则）
- [ ] 函数/方法职责是否单一

### 安全性
- [ ] 是否存在 SQL 注入风险
- [ ] 用户输入是否有适当验证
- [ ] 是否有敏感信息泄露

### 测试
- [ ] 新功能是否有测试覆盖
- [ ] 边界条件是否被测试

提供具体、可操作的改进建议，附上文件路径和行号。
```

### 示例 3：API 文档生成器

```yaml
---
name: api-docs
description: 从代码生成 API 文档。当需要为 API 端点编写文档时使用。
argument-hint: [文件路径或目录]
context: fork
agent: Explore
allowed-tools: Read, Grep, Glob
---

为 $ARGUMENTS 中的 API 端点生成文档：

1. **扫描端点**：查找所有路由定义
2. **提取信息**：
   - HTTP 方法和路径
   - 请求参数（query、body、headers）
   - 响应格式和状态码
   - 认证要求
3. **生成 Markdown**：按以下格式输出

```markdown
## POST /api/users

**描述**：创建新用户

**请求体**：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 用户姓名 |

**响应**：
- `201 Created`：用户创建成功
- `400 Bad Request`：参数验证失败
```
```

### 示例 4：性能分析助手

```yaml
---
name: perf-analyze
description: 分析代码的性能瓶颈。当用户询问性能问题时使用。
allowed-tools: Read, Grep, Glob, Bash
---

分析性能问题：

1. **识别热点代码**
   - 搜索 N+1 查询模式
   - 检查循环中的同步操作
   - 识别不必要的重新渲染（前端）

2. **数据库性能**
   - 检查缺失的索引
   - 识别未优化的查询
   - 查找 SELECT * 用法

3. **内存使用**
   - 检查大型对象的生命周期
   - 识别潜在的内存泄漏

4. **网络请求**
   - 检查并发请求的优化空间
   - 识别可缓存的请求

对每个问题，提供：
- 问题描述
- 具体代码位置（文件:行号）
- 优化建议和预期收益
```

### 示例 5：项目 API 规范（知识型 Skill）

```yaml
---
name: api-conventions
description: 本项目的 API 设计规范。编写 API 端点时自动加载。
user-invocable: false   # 不在菜单显示，仅供 Claude 自动使用
---

## API 设计规范

### URL 结构
- 使用 RESTful 命名：`/api/v1/resources/{id}`
- 资源名用复数形式
- 使用连字符分隔单词：`/api/v1/user-profiles`

### 响应格式
```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "pagination": {}
  }
}
```

### 错误处理
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "用户可读的错误信息",
    "details": []
  }
}
```

### 状态码规范
- `200 OK`：成功查询/更新
- `201 Created`：成功创建
- `400 Bad Request`：参数验证失败
- `401 Unauthorized`：未认证
- `403 Forbidden`：权限不足
- `404 Not Found`：资源不存在
- `422 Unprocessable Entity`：业务逻辑错误
- `500 Internal Server Error`：服务器错误
```

### 示例 6：无障碍审计（A11y）

```yaml
---
name: a11y-audit
description: 审计前端代码的无障碍问题（Accessibility）。修改 UI 组件后使用。
allowed-tools: Read, Grep, Glob
---

对 $ARGUMENTS 进行无障碍审计：

## 检查项目

### ARIA 标签
- 所有交互元素是否有 `aria-label` 或 `aria-labelledby`
- `role` 属性使用是否正确

### 键盘导航
- 所有功能是否可通过键盘操作
- Tab 键顺序是否合理
- 是否有焦点管理逻辑

### 语义化 HTML
- 是否使用正确的 HTML 元素（`<button>` vs `<div onClick>`）
- 标题层级是否正确（`h1` → `h2` → `h3`）
- 表单是否有关联的 `<label>`

### 视觉对比度
- 文字与背景的对比度是否符合 WCAG AA 标准（4.5:1）
- 不依赖颜色传达信息

### 图片和媒体
- 图片是否有描述性的 `alt` 文本
- 纯装饰性图片是否用 `alt=""`

对每个问题提供具体修复建议和代码示例。
```

---

## 快速参考卡

```bash
# 查看所有可用 Skill
/

# 调用 Skill
/skill-name
/skill-name argument1 argument2

# 个人 Skill 目录
~/.claude/skills/

# 项目 Skill 目录
.claude/skills/

# 最小 SKILL.md 模板
cat > .claude/skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: 这个 skill 的用途，Claude 用来判断何时调用
---

你的指令写在这里...
EOF
```

---

*本文档基于 Claude Code 2026-03 版本，技能系统遵循 [Agent Skills 开放标准](https://agentskills.io)。*
