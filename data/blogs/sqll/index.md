# SQL 查询性能优化学习路线

> 默认使用 PostgreSQL 语法（版本 14+），每个知识点末尾标注 MySQL 差异。所有 SQL 示例可在真实数据库上运行，无伪代码。  
> 资料来源：[PostgreSQL 官方文档 Ch.14](https://www.postgresql.org/docs/current/performance-tips.html)、[Use The Index, Luke](https://use-the-index-luke.com/)、[MySQL 8.0 官方文档 Ch.10](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)

---

## 0. 核心心智模型：一条 SQL 经历了什么

> **学完这节你能做到**：画出一条 SQL 从文本到结果的完整路径，知道优化器在哪里工作、用什么数据做决定。

### 0.1 四个阶段：Parser → Rewriter → Planner → Executor

**🔧 这是什么**  
数据库收到 SQL 文本后经历四个阶段：

```
SQL 文本
  ↓ [Parser]    语法解析：把文本变成语法树，检查 SQL 是否合法
  ↓ [Rewriter]  规则改写：展开视图、应用重写规则
  ↓ [Planner]   生成执行计划：枚举多种路径，选 cost 最低的（性能关键！）
  ↓ [Executor]  执行计划：按计划读数据、做运算、返回结果
```

**✅ 理解这个，你会得到**
- 知道 `EXPLAIN` 展示的是 Planner 的输出，`EXPLAIN ANALYZE` 是 Planner + 真实执行结果。
- 知道优化的主战场在 Planner：给它更好的信息（索引、统计信息），它才能选出更好的计划。

**⚠️ 常见误解**
- "SQL 写法不同性能就不同"：逻辑等价的写法优化器往往生成相同计划，不要迷信"这种写法更快"——看 EXPLAIN 才算数。
- "数据库每次都重新解析"：预处理语句（prepared statement）可以缓存解析和计划。

**MySQL 差异**：阶段相同，MySQL 8.0 之前没有独立的 Rewriter（部分改写在 Optimizer 内完成）。MySQL 8.0+ 引入 Query Rewrite Plugin。

---

### 0.2 IO 是性能的根本瓶颈：Page 与 Buffer Pool

**🔧 这是什么**  
数据库不按行读数据，而是按**页（Page/Block）**读。PostgreSQL 默认页 8KB，MySQL InnoDB 默认 16KB。一个页装几十到几百行。

**Buffer Pool（缓冲池）/ shared_buffers**：把最近用过的页缓存在内存，下次访问相同页直接从内存取，避免磁盘 IO。

```
磁盘随机读耗时 ≈ 0.1ms–10ms
内存访问耗时   ≈ 0.0001ms
差距：约 1000–100000 倍
```

**✅ 理解这个，你会得到**
- 索引加速的本质：**减少需要读取的页数**。全表扫描读所有页；索引扫描只读符合条件的页。
- `EXPLAIN` 里的 `cost` 单位本质是"读页的代价"（顺序读 1 页 = 1.0，随机读 1 页 ≈ 4.0）。

**⚠️ 常见误解**
- "只要有索引就快"：如果结果集占全表 30% 以上的行，走索引要做 30 万次随机 IO，还不如全表顺序扫描（顺序 IO 比随机 IO 快得多）。
- "内存大就不需要优化"：内存再大也有边界，冷启动或大表仍会触发磁盘 IO。

**MySQL 差异**：MySQL InnoDB 缓冲池叫 `innodb_buffer_pool_size`，PostgreSQL 叫 `shared_buffers`。两者建议设为物理内存的 25%–75%。

---

### 0.3 优化器的"地图"：统计信息（Statistics）

**🔧 这是什么**  
**统计信息**是数据库对每张表、每个列收集的摘要：有多少行、值的分布（直方图）、有多少不同值（n_distinct）。优化器用这些数据**估算**每种执行计划会处理多少行，算出 cost，选最便宜的那个。

**统计信息过期** = 优化器用"旧地图"，估算行数严重偏差 → 选出烂计划。

**✅ 理解这个，你会得到**
- 遇到"明明有索引却没用"或"计划看起来奇怪"，第一反应：`ANALYZE 表名;` 刷新统计信息再 EXPLAIN 一次。
- 知道 `EXPLAIN ANALYZE` 里 `rows=10000`（估算）vs `actual rows=1`（实际）是统计信息有问题的信号。

**⚠️ 常见误解**
- "ANALYZE 很重，不能常跑"：PostgreSQL 有 auto-analyze 自动触发，大批量数据导入后手动 `ANALYZE` 是好习惯。
- "统计信息准了性能就一定好"：统计信息准确是必要条件，不是充分条件。

**MySQL 差异**：`ANALYZE TABLE 表名;` 刷新统计信息。MySQL 8.0 引入直方图（`ANALYZE TABLE ... UPDATE HISTOGRAM`）。

---

## 1. 基础必学模块 —— 读懂 EXPLAIN 和索引基础

> **学完这节你能做到**：拿到任意一条 SQL 的 `EXPLAIN ANALYZE` 输出，找出最贵的节点，判断扫描方式，知道是否命中了索引。

### 1.1 EXPLAIN / EXPLAIN ANALYZE 是什么，怎么读

**🔧 这是什么**  
`EXPLAIN` 让优化器显示执行计划（不真正执行）。`EXPLAIN ANALYZE` 实际执行并附上真实耗时和行数。

读一个典型输出：
```
Seq Scan on orders  (cost=0.00..18334.00 rows=1000000 width=50)
                    (actual time=0.012..89.234 rows=1000000 loops=1)
```

五个核心字段：

| 字段 | 含义 |
|------|------|
| `cost=0.00..18334.00` | 启动代价..总代价，相对值（顺序读 1 页 = 1.0），**估算值** |
| `rows=1000000` | 优化器**估算**返回行数 |
| `width=50` | 每行平均字节数（估算） |
| `actual time=0.012..89.234` | 实际`首行时间..完成时间`，单位**毫秒** |
| `loops=1` | 该节点执行了几次（Nested Loop 内层 loops 会很大）|

**怎么找"最贵的节点"**：在 `EXPLAIN ANALYZE` 树中，找 `actual time` 第二个数字最大、且不是被子节点贡献的节点——那里是瓶颈。

**✅ 这么做，你会得到**
- 5 分钟内定位慢查询根因，不靠猜。
- `rows` 估算和 `actual rows` 差距超过 10 倍，立刻知道要 `ANALYZE`。

**⚠️ 常见误解**
- "cost 小的一定快"：cost 是估算，不是毫秒，实际时间看 `actual time`。
- "loops=1 才正常"：Nested Loop 内层节点 loops 等于外层驱动行数，要看 `actual time × loops` 的总耗时。

**🧪 最小可验证示例**（PostgreSQL）
```sql
-- 先准备测试表（后续所有示例共用这张表）
CREATE TABLE orders (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT        NOT NULL,
  status     VARCHAR(20)   NOT NULL,
  amount     NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP     NOT NULL,
  updated_at TIMESTAMP     NOT NULL
);

INSERT INTO orders (user_id, status, amount, created_at, updated_at)
SELECT
  (random() * 99999 + 1)::BIGINT,
  (ARRAY['pending','paid','shipped','done'])[ceil(random()*4)::INT],
  (random() * 1000 + 1)::NUMERIC(10,2),
  NOW() - (random() * 730 || ' days')::INTERVAL,
  NOW()
FROM generate_series(1, 1000000);

ANALYZE orders;

-- 读 EXPLAIN（不执行）
EXPLAIN SELECT * FROM orders WHERE user_id = 12345;

-- 读 EXPLAIN ANALYZE（真正执行，BUFFERS 显示缓存命中情况）
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE user_id = 12345;
```

**MySQL 差异**：`EXPLAIN ANALYZE` 在 MySQL 8.0.18+ 支持（树形格式）。早期版本用 `EXPLAIN FORMAT=JSON SELECT ...`。MySQL EXPLAIN 关键字段：`type`（扫描方式）、`key`（使用的索引）、`rows`（估算行数）、`Extra`（附加信息）。

---

### 1.2 扫描方式：Seq Scan vs 各种 Index Scan

**🔧 这是什么**  
数据库从表里取数据有四种主要方式：

| 扫描方式 | 描述 | 适用场景 |
|---------|------|---------|
| **Seq Scan**（全表扫描）| 顺序读每一个数据页 | 大比例结果集、小表、无索引 |
| **Index Scan** | 遍历 B-tree 找行位置，再去堆取数据（有回表）| 高选择性查询（结果行少）|
| **Bitmap Index Scan** | 扫索引收集所有满足条件的行位置，排序后批量取堆 | 中等结果集，减少随机 IO |
| **Index Only Scan** | 只读索引，不取堆（所需列全在索引里）| 覆盖索引场景，最快 |

**✅ 理解这个，你会得到**
- 看到 `Seq Scan` 不必恐慌：对小表或大比例结果集，它是正确选择。
- 看到 `Index Only Scan` 是最优状态（无回表）。

**⚠️ 全表扫描反而比索引扫描更快的场景**
- 结果集占全表 **5%–10% 以上**：走索引要做大量随机 IO，不如顺序扫。
- **小表**（<几千行）：数据全在 shared_buffers 里，Seq Scan 几乎无代价。
- 这就是为什么"加了索引查询还是走全表扫"有时候是**正确行为**，不是 bug。

**🧪 最小可验证示例**
```sql
-- 1. 无索引时的全表扫描
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 12345;
-- 预期：Seq Scan，耗时约 80–200ms（100 万行）

-- 2. 加索引后
CREATE INDEX idx_orders_user_id ON orders(user_id);
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 12345;
-- 预期：Index Scan 或 Bitmap Index Scan，耗时约 0.1–2ms

-- 3. 低选择性查询：优化器选什么？
EXPLAIN ANALYZE SELECT * FROM orders WHERE amount > 100;
-- amount>100 可能覆盖 90% 的行，优化器选 Seq Scan（正确！）

-- 4. 观察 Index Only Scan
CREATE INDEX idx_orders_user_amount ON orders(user_id, amount);
EXPLAIN ANALYZE SELECT user_id, amount FROM orders WHERE user_id = 12345;
-- 预期：Index Only Scan（比 Index Scan 更快，无回表）
```

**MySQL 差异**：扫描方式在 `EXPLAIN` 的 `type` 列显示。从好到差：`const`（主键单值）> `eq_ref`（唯一索引等值）> `ref`（非唯一索引等值）> `range`（范围）> `index`（全索引扫）> `ALL`（全表扫）。

---

### 1.3 B-tree 索引工作原理

**🔧 这是什么**  
B-tree（平衡多叉树）是最常见的索引类型。核心：**有序 + 多叉树 → 查找是 O(log n)**。

```
根节点 [500, 800]
├── 内部节点 [200, 350]
└── 内部节点 [600, 700]
    └── 叶子节点 [500,501,...,599]  ← 存：排好序的键值 + 行的物理位置(TID)
                                      叶子节点之间通过双向链表连接（支持范围扫描）
```

查找 `user_id=12345`：根节点比较 → 走到子节点 → 最多 3–4 次 IO 到达叶子 → 找到行位置。100 万行的 B-tree 高度约 3–4 层。

**✅ 理解这个，你会得到**
- 等值查询（`=`）、范围查询（`BETWEEN`、`>`、`<`）、排序（`ORDER BY`）都能利用 B-tree。
- `LIKE 'abc%'`（前缀匹配）可以用 B-tree，`LIKE '%abc'`（后缀匹配）不行——因为后缀在 B-tree 里是无序的。

**⚠️ 常见误解**
- "B-tree 对所有查询都有效"：对 JSON 内部字段、数组包含、全文搜索，需要 GIN/GiST。
- "B-tree 维护代价可忽略"：每次 INSERT 都要在正确位置插入键，页满时触发页分裂（写放大来源）。

**🧪 最小可验证示例**
```sql
-- 查看 B-tree 索引内部信息（需要 pageinspect 扩展）
CREATE EXTENSION IF NOT EXISTS pageinspect;
SELECT * FROM bt_metap('idx_orders_user_id');
-- 结果含 level（树高，通常 2–3），root（根节点页号）

-- 范围查询利用 B-tree
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id BETWEEN 10000 AND 10100;
-- 预期：Bitmap Index Scan 或 Index Scan

-- 前缀 LIKE 能用索引，后缀不行
CREATE INDEX idx_orders_status ON orders(status);
EXPLAIN SELECT * FROM orders WHERE status LIKE 'pai%';   -- ✅ 可用
EXPLAIN SELECT * FROM orders WHERE status LIKE '%aid';   -- ❌ 全表扫
```

**MySQL 差异**：MySQL InnoDB 使用 B+tree（所有数据在叶子节点，叶子节点间有链表），PostgreSQL 使用标准 B-tree。InnoDB 主键索引（聚簇索引）叶子节点直接存行数据——这是与 PostgreSQL 堆存储最大的结构差异。

---

### 1.4 最左前缀原则

**🔧 这是什么**  
复合索引 `(a, b, c)` 内部按 `a` 排序、`a` 相同时按 `b`、再按 `c`。只有**从最左列开始的连续前缀**才能走这个索引：

| WHERE 条件 | 能否用 `(a,b,c)`？ | 原因 |
|-----------|-------------------|------|
| `WHERE a=1` | ✅ 用到前缀 `(a)` | a 是最左列 |
| `WHERE a=1 AND b=2` | ✅ 用到前缀 `(a,b)` | 连续前缀 |
| `WHERE a=1 AND b=2 AND c=3` | ✅ 完整使用 | 完整前缀 |
| `WHERE b=2` | ❌ 用不上 | 跳过了 a |
| `WHERE a=1 AND c=3` | ✅ 只用到 `(a)`，c 跳过 | b 中断，c 失效 |
| `WHERE a>1 AND b=2` | ✅ a 范围后 b 失效 | a 是范围，b 后面无法利用 |

**✅ 这么做，你会得到**
- 设计复合索引把**等值条件列放前面**，**范围条件列放后面**，最大化索引利用率。
- 例：查询 `WHERE status='paid' AND created_at>'2025-01-01'`，应建 `(status, created_at)` 而非 `(created_at, status)`。

**⚠️ 常见误解**
- "WHERE 里有 a 就一定能用 `(a,b,c)`"：a 是范围条件时，b 和 c 无法利用。
- "复合索引必须和 WHERE 列顺序一致"：不是，数据库自动匹配前缀；但**跳列**一定无效。

**🧪 最小可验证示例**
```sql
CREATE INDEX idx_orders_status_created ON orders(status, created_at);

-- ✅ 完整复合索引
EXPLAIN SELECT * FROM orders
WHERE status = 'paid' AND created_at > '2025-01-01';

-- ✅ 只用前缀 (status)
EXPLAIN SELECT * FROM orders WHERE status = 'paid';

-- ❌ 跳过 status，只有 created_at：用不上
EXPLAIN SELECT * FROM orders WHERE created_at > '2025-01-01';
-- 预期：Seq Scan（没有 status 这个最左列）

-- 验证范围列打断后续列
EXPLAIN SELECT * FROM orders
WHERE status LIKE 'p%' AND created_at > '2025-01-01';
-- LIKE 前缀是范围条件：status 前缀可用，created_at 可能不再用
-- 实际行为取决于选择性，用 EXPLAIN ANALYZE 实测
```

**MySQL 差异**：最左前缀规则完全相同。MySQL `EXPLAIN` 的 `key_len` 字段显示实际用了索引的字节数，可以推算用到了几列（用 key_len 除以每列字节数）。

---

### 1.5 覆盖索引（Index Only Scan）

**🔧 这是什么**  
**覆盖索引**：查询所需的所有列都在索引里，不需要去堆取原始行。PostgreSQL 称为 **Index Only Scan**。

```
普通 Index Scan：索引 → 找到行位置 TID → 回堆取完整行（回表）
覆盖索引：       索引 → 直接返回结果，完全不碰堆
```

**✅ 这么做，你会得到**
- 高频查询中，`SELECT id, user_id`（覆盖索引）vs `SELECT *`：可快 **5–50 倍**（消除所有回表 IO）。
- 具体数字：100 万行，非覆盖 Index Scan 约 10–50ms，覆盖 Index Only Scan 约 0.5–5ms。

**⚠️ 常见误解**
- "SELECT 列少就一定 Index Only Scan"：还需要这些列**全部包含在索引定义里**，漏一列就要回表。
- "Index Only Scan 总是比 Index Scan 快"：Index Only Scan 需要检查 **visibility map**（可见性映射）确认行可见。如果表刚大量写入而 VACUUM 还未运行，visibility map 不是最新的，反而会触发回堆检查——VACUUM 后才能真正获得好处。
- "`SELECT *` 永远是反模式"：如果确实需要所有列，`SELECT *` 并不比 `SELECT col1,col2,...` 慢多少；滥用 `SELECT *` 的真正问题是**破坏了覆盖索引的可能性**。

**🧪 最小可验证示例**
```sql
-- 普通 Index Scan（有回表）
DROP INDEX IF EXISTS idx_orders_user_amount;
CREATE INDEX idx_orders_user_id ON orders(user_id);

EXPLAIN (ANALYZE, BUFFERS)
SELECT user_id, amount FROM orders WHERE user_id = 12345;
-- 观察：Index Scan，Buffers 里有 Heap Fetches

-- 覆盖索引（无回表）
CREATE INDEX idx_orders_user_amount ON orders(user_id, amount);
EXPLAIN (ANALYZE, BUFFERS)
SELECT user_id, amount FROM orders WHERE user_id = 12345;
-- 观察：Index Only Scan，Heap Fetches = 0，速度提升

-- 加了索引外的列，退回 Index Scan
EXPLAIN (ANALYZE, BUFFERS)
SELECT user_id, amount, status FROM orders WHERE user_id = 12345;
-- status 不在索引里 → Index Scan（有 Heap Fetches）
```

**MySQL 差异**：MySQL InnoDB 二级索引叶子节点存"索引值 + 主键值"，查到主键后还需回聚簇索引取行（相当于 PG 的回表）。如果 SELECT 的列都在二级索引里，可以避免这步。MySQL `EXPLAIN` 的 `Extra` 字段显示 `Using index` 代表覆盖索引命中。

---

### 1.6 回表（Heap Fetch）是什么，为什么贵

**🔧 这是什么**  
**回表**：通过索引找到满足条件的行位置（TID：物理页号 + 行号），然后去堆取完整行。每次回表 = 一次额外的随机页 IO。

```
索引叶子节点：[user_id=12345] → TID=(页23, 行5)
回表：读磁盘第 23 页 → 取出第 5 行的所有字段
```

**✅ 理解这个，你会得到**
- 知道为什么"索引字段的等值查询"在大结果集时仍然慢：100 条结果可能在 100 个不同物理页上，产生 100 次随机 IO。
- 知道何时用覆盖索引消除回表。

**⚠️ 回表什么时候让优化器放弃索引**
- 结果集行数 × 随机 IO 代价 > 顺序全表扫描代价时，优化器选全表扫。
- 默认 `random_page_cost = 4.0`，`seq_page_cost = 1.0`（随机 IO 被认为是顺序 IO 的 4 倍贵）。
- 如果数据全在 SSD（随机/顺序 IO 差距小），可把 `random_page_cost` 调低到 1.1–2.0，让优化器更愿意用索引。

**🧪 最小可验证示例**
```sql
-- 观察回表行为
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 12345;
-- BUFFERS 输出里 "Heap Fetches" 的数量 = 回表次数

-- 覆盖索引对比（无回表）
EXPLAIN (ANALYZE, BUFFERS)
SELECT user_id, amount FROM orders WHERE user_id = 12345;
-- 有覆盖索引时：Heap Fetches = 0

-- 调低 random_page_cost，观察优化器是否更愿意用索引
SET random_page_cost = 1.1;
EXPLAIN SELECT * FROM orders WHERE amount > 800;
-- 对比 random_page_cost = 4.0 时的计划差异
RESET random_page_cost;
```

**MySQL 差异**：MySQL InnoDB 二级索引回表叫"回聚簇索引"。MySQL `EXPLAIN ANALYZE`（8.0.18+）的 `rows_examined` 可以间接推断回表次数。

---

### 1.7 常见慢查询元凶清单

**🔧 这是什么**  
拿到一条慢 SQL，先对照这张清单逐项排查：

**① 缺索引**
- 症状：EXPLAIN 显示 Seq Scan，actual time 高
- 修复：在高选择性的 WHERE / JOIN ON / ORDER BY 列上建索引
- **反例**：小表（<1 万行）全表扫描可能比索引扫描还快，不需要建

**② `SELECT *`**
- 症状：破坏覆盖索引；如果有 TEXT/BLOB 大字段，传输开销大
- 修复：只 SELECT 需要的列
- **反例**：确实需要所有列且没有大字段时，`SELECT *` 影响很小

**③ `LIKE '%xxx'`（前缀通配符）**
- 症状：B-tree 无法利用，强制 Seq Scan
- 修复：改为前缀匹配 `LIKE 'xxx%'`，或改用全文索引（GIN + tsvector）
- **反例**：表只有几千行，Seq Scan 也很快，不值得引入全文索引

**④ 函数包裹列**
- 症状：`WHERE YEAR(created_at)=2025`、`WHERE LOWER(name)='alice'`，索引失效
- 修复：改写为范围 `WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01'`，或建表达式索引
- **反例**：已经对该函数建了表达式索引，则函数包裹列没问题

**⑤ 隐式类型转换**
- 症状：列是 `BIGINT`，但条件写 `WHERE user_id='12345'`（字符串）
- 修复：保证 WHERE 条件数据类型与列类型一致
- **反例**：PostgreSQL 很多情况下会自动安全转换，但 MySQL 更容易踩坑

**🧪 最小可验证示例**
```sql
-- ④ 函数包裹列：索引失效 vs 改写后生效
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- ❌ 函数包裹：无法用索引
EXPLAIN SELECT * FROM orders
WHERE EXTRACT(YEAR FROM created_at) = 2025;
-- 预期：Seq Scan（即使有 created_at 索引）

-- ✅ 范围改写：能用索引
EXPLAIN SELECT * FROM orders
WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01';
-- 预期：Index Scan using idx_orders_created

-- ③ LIKE 前后缀对比
EXPLAIN SELECT * FROM orders WHERE status LIKE 'pai%';  -- ✅ 可用索引
EXPLAIN SELECT * FROM orders WHERE status LIKE '%aid';  -- ❌ Seq Scan

-- ⑤ 类型转换（PostgreSQL 通常自动处理，MySQL 更易出问题）
EXPLAIN SELECT * FROM orders WHERE user_id = 12345;    -- ✅ 整数字面量
EXPLAIN SELECT * FROM orders WHERE user_id = '12345';  -- ⚠️ 字符串，PG 会转换，MySQL 需验证
```

**MySQL 差异**：MySQL 隐式类型转换更容易踩坑——列是 `INT`，条件写字符串会导致索引完全失效。`EXPLAIN` 的 `Extra` 字段：`Using where` 有条件过滤，`Using index` 覆盖索引，`Using filesort` 需要排序，`Using temporary` 用了临时表（都是优化信号）。

---

## 2. 进阶模块 —— 系统性诊断和优化常见慢查询

> **学完这节你能做到**：面对包含 JOIN、分页、GROUP BY 的中等复杂查询，系统诊断慢在哪里，给出有 EXPLAIN ANALYZE 数据支撑的优化方案。

### 2.1 JOIN 算法三种：Nested Loop / Hash Join / Merge Join

**🔧 这是什么**

| 算法 | 工作方式 | 适用场景 | 注意点 |
|------|---------|---------|--------|
| **Nested Loop** | 外层每行，扫描/查找内层找匹配 | 小外层 + 内层有索引；OLTP 点查 | 外层行数大时代价爆炸 |
| **Hash Join** | 把小表 build 成哈希表，大表 probe 匹配 | 无索引的大表 JOIN；数据量均衡 | 内存不足时 spill 磁盘，更慢 |
| **Merge Join** | 两侧都已排序，一次扫描对比 | 两侧已排序或有索引；大数据集 | 需要预排序代价 |

**✅ 这么做，你会得到**
- 看到 Hash Join 且哈希表很大：考虑加索引改成 Nested Loop。
- 看到 Nested Loop 且 loops 很高（外层行数多）：考虑换 Hash Join 或加索引。

**⚠️ 常见误解**
- "Hash Join 总比 Nested Loop 快"：Hash Join 需要内存存哈希表（受 `work_mem` 限制），内存不足 spill 到磁盘反而更慢。
- "Nested Loop 一定慢"：外层很小（几行）且内层有索引时，Nested Loop 是最优选择。

**🧪 最小可验证示例**
```sql
-- 创建 users 表做 JOIN 测试
CREATE TABLE users (
  id   BIGSERIAL PRIMARY KEY,
  name VARCHAR(100)
);
INSERT INTO users (name)
SELECT 'user_' || i FROM generate_series(1, 100000) i;
ANALYZE users;

-- 无索引：Hash Join
EXPLAIN ANALYZE
SELECT o.id, u.name, o.amount
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status = 'paid'
LIMIT 100;

-- orders.user_id 有索引：可能切换为 Nested Loop
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
EXPLAIN ANALYZE
SELECT o.id, u.name, o.amount
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.user_id = 12345;
-- 预期：Nested Loop（小结果集，外层走索引，内层 PK 查找）

-- 强制禁用 Hash Join，观察替代计划（调试用）
SET enable_hashjoin = off;
EXPLAIN SELECT o.id, u.name FROM orders o JOIN users u ON o.user_id = u.id;
RESET enable_hashjoin;
```

**MySQL 差异**：MySQL 8.0.18 之前只有 Nested Loop（含 Block Nested Loop 变体）。MySQL 8.0.18+ 引入 Hash Join。MySQL 没有 Merge Join。所以 MySQL 老版本里，JOIN 性能严重依赖索引。

---

### 2.2 子查询 vs JOIN vs CTE：何时等价，何时有差异

**🔧 这是什么**  
三种写法表达同样逻辑时，优化器是否改写成等价形式决定了性能是否有差异。

| 写法 | 现代优化器行为 | 需要注意的情况 |
|------|--------------|--------------|
| 非关联子查询 `WHERE id IN (SELECT ...)` | 通常改写为 JOIN，等价 | MySQL 5.7 及以前有 IN 子查询优化缺陷 |
| 关联子查询（子查询引用外层表） | **无法改写**，每外层行执行一次 | 外层行多时极慢 |
| CTE（`WITH ...`） | PG 12+ 默认内联（等价 JOIN）；PG 11 及以前是优化隔离边界 | PG 12+ 可加 `MATERIALIZED` 强制物化 |

**✅ 这么做，你会得到**
- 遇到性能问题先 EXPLAIN 对比写法，而不是凭经验说"子查询比 JOIN 慢"。
- 关联子查询一律改写为 JOIN + 预聚合。

**⚠️ 常见误解**
- "子查询一定比 JOIN 慢"：这是 MySQL 5.7 时代的说法，现代优化器大多会改写。
- "CTE 总是有隔离性"：PostgreSQL 12+ 的 CTE 默认是内联的，不再是优化隔离边界。

**🧪 最小可验证示例**
```sql
-- 三种等价写法，对比计划是否相同
EXPLAIN
SELECT * FROM orders
WHERE user_id IN (SELECT id FROM users WHERE name LIKE 'user_1%');

EXPLAIN
SELECT o.* FROM orders o
JOIN users u ON o.user_id = u.id
WHERE u.name LIKE 'user_1%';

EXPLAIN
WITH target AS (SELECT id FROM users WHERE name LIKE 'user_1%')
SELECT * FROM orders WHERE user_id IN (SELECT id FROM target);
-- 对比三个 EXPLAIN 输出：如果计划相同，性能无差异

-- 关联子查询（慢！每外层行执行一次子查询）
EXPLAIN ANALYZE
SELECT * FROM orders o
WHERE amount > (
  SELECT AVG(amount) FROM orders WHERE user_id = o.user_id  -- 关联！
);
-- 观察：loops = 外层行数，极慢

-- 改写为 JOIN + 预聚合（快！）
EXPLAIN ANALYZE
SELECT o.* FROM orders o
JOIN (
  SELECT user_id, AVG(amount) AS avg_amt
  FROM orders GROUP BY user_id
) agg ON o.user_id = agg.user_id
WHERE o.amount > agg.avg_amt;
```

**MySQL 差异**：MySQL 5.7 及以前对 `IN (subquery)` 有优化缺陷（转成关联子查询），一定要改写为 JOIN。MySQL 8.0 已改进，但遇到性能问题仍先改写对比。

---

### 2.3 深翻页问题：`LIMIT 大偏移量` 为什么慢

**🔧 这是什么**  
`LIMIT 20 OFFSET 1000000`：数据库必须扫描（并丢弃）前 100 万行，然后返回 20 行。即使有索引，也要做 100 万次索引遍历。

**✅ 改用键集分页（Keyset Pagination），你会得到**
- 无论翻到第几页，查询耗时恒定：O(log n) + 20 行。
- 100 万行表第 5 万页：OFFSET 方式约 3000ms，键集方式约 2ms（约 1500 倍）。

**⚠️ 键集分页的局限**
- **不支持随机跳页**：用户无法直接跳到"第 5000 页"，只能"下一页/上一页"。
- **排序键必须有索引且唯一**（或组合唯一），否则会漏数据或重复。
- 如果总数据量不超过几万条，OFFSET 的性能问题不严重，不必过度优化。

**🧪 最小可验证示例**
```sql
-- ❌ 深翻页：极慢
EXPLAIN ANALYZE
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 999980;
-- 预期：要扫描 100 万行才能定位到第 999981 行，耗时 500ms+

-- ✅ 键集分页：恒定快
-- 第一页
SELECT * FROM orders ORDER BY id LIMIT 20;
-- 假设最后一行 id = 20

-- 下一页（把上一页最后一个 id 传入）
EXPLAIN ANALYZE
SELECT * FROM orders WHERE id > 999980 ORDER BY id LIMIT 20;
-- 预期：Index Scan，只扫 20 行，耗时 <1ms

-- 多列排序键集（created_at + id 保证唯一）
CREATE INDEX IF NOT EXISTS idx_orders_created_id ON orders(created_at, id);
-- 上一页末尾：created_at='2025-06-15 10:00:00', id=500000
SELECT * FROM orders
WHERE (created_at, id) > ('2025-06-15 10:00:00', 500000)
ORDER BY created_at, id
LIMIT 20;
```

**MySQL 差异**：MySQL 同样支持键集分页。另一个折中方案"延迟关联"（比直接 OFFSET 快，但仍是 O(offset)）：
```sql
-- MySQL 延迟关联（用覆盖索引先找 id，再 JOIN 取完整行）
SELECT o.* FROM orders o
JOIN (SELECT id FROM orders ORDER BY id LIMIT 20 OFFSET 999980) tmp
ON o.id = tmp.id;
```

---

### 2.4 统计信息过期导致计划走偏

**🔧 这是什么**  
优化器依赖统计信息估算行数。如果表数据大变但统计信息还是旧的，优化器用错误的行数做决策，选出非最优计划。

最常见症状：`EXPLAIN ANALYZE` 里 `rows=X`（估算）和 `actual rows=Y`（实际）差 10 倍以上。

**✅ 刷新统计信息后，你会得到**
- 优化器重新估算，可能从 Seq Scan 切换到 Index Scan，或从 Hash Join 切换到 Nested Loop。
- 某些"神奇的慢查询"在 `ANALYZE` 后自己变快。

**⚠️ 常见误解**
- "Auto-analyze 一定够用"：大批量导入（一次插入 100 万行）后，auto-analyze 触发有延迟，建议手动 `ANALYZE`。
- "`ANALYZE` 会锁表"：PostgreSQL 的 `ANALYZE` 只加很弱的共享锁，不影响正常读写。

**🧪 最小可验证示例**
```sql
-- 模拟统计信息过期
CREATE TABLE demo_stats (id INT, val INT);
INSERT INTO demo_stats SELECT i, i FROM generate_series(1, 100) i;
ANALYZE demo_stats;  -- 统计信息：100 行

EXPLAIN SELECT * FROM demo_stats WHERE val > 50;
-- 观察：rows 估算约 50

-- 大量插入数据但不 ANALYZE
INSERT INTO demo_stats SELECT i, i FROM generate_series(101, 1000000) i;
-- 不运行 ANALYZE！

EXPLAIN SELECT * FROM demo_stats WHERE val > 50;
-- 观察：rows 估算还是基于旧的 100 行！严重低估

-- 刷新统计信息
ANALYZE demo_stats;
EXPLAIN SELECT * FROM demo_stats WHERE val > 50;
-- 观察：rows 估算恢复准确（约 50 万行）

-- 查看统计信息收集状态
SELECT tablename, last_analyze, last_autoanalyze, n_live_tup, n_dead_tup
FROM pg_stat_user_tables
WHERE tablename = 'orders';
```

**MySQL 差异**：`ANALYZE TABLE orders;` 刷新统计信息。`innodb_stats_auto_recalc=ON`（默认）在 10% 数据变化后自动触发。`SHOW TABLE STATUS LIKE 'orders'\G` 查看统计状态。

---

### 2.5 索引设计权衡：写放大与低基数陷阱

**🔧 这是什么**  
索引是**用写性能和磁盘空间换读性能**的交易。每次 INSERT/UPDATE/DELETE 都要同步维护所有相关索引。

**✅ 这么做，你会得到**

| 场景 | 建议 | 预期收益 |
|------|------|---------|
| 高基数列（user_id、email）+ 高频等值查询 | ✅ 建索引 | 100 万行表，查询从 ~800ms 降到 ~2ms（约 400 倍）|
| 低基数列（status 只有 4 个值、gender）| ⚠️ 通常不建，优化器走全表更合算 | 索引占空间，写放大，白建 |
| 同一张表 >5–6 个索引 | ⚠️ 控制数量 | 每次写入维护所有索引，写吞吐下降 |
| 只查近 30 天的时序数据 | ✅ 建部分索引 | 索引体积是全列索引的 1/12，查询仍走索引 |

**⚠️ 常见误解**
- "给所有 WHERE 用过的列都建索引"：索引体积可能超过表本身，缓存命中率下降，写入吞吐崩溃。
- "低基数列加索引一定没用"：低基数列的**特定少数值**（如 status='cancelled' 只占 1%）可以用**部分索引**精确索引那部分行。

**🧪 最小可验证示例**
```sql
-- 高基数列建索引（应该有效）
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 12345;
-- 加索引前：Seq Scan，~150ms
CREATE INDEX idx_user ON orders(user_id);
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 12345;
-- 加索引后：Index Scan，~1ms

-- 低基数列建索引（通常无效）
CREATE INDEX idx_status ON orders(status);  -- status 只有 4 个值
EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'done';
-- 观察：优化器很可能仍然选 Seq Scan（~80% 的行是 done，走索引更贵）

-- 低基数列的特定少数值 → 部分索引
-- 假设 pending 只占 10%
CREATE INDEX idx_orders_pending ON orders(user_id)
WHERE status = 'pending';

EXPLAIN ANALYZE
SELECT * FROM orders WHERE status = 'pending' AND user_id = 12345;
-- 使用部分索引：比全列索引小 10 倍，且命中率高
```

**MySQL 差异**：`SHOW INDEX FROM orders` 查看所有索引及其基数（Cardinality）估算。MySQL 不支持部分索引（Filtered Index），变通方案：生成列（Generated Column）+ 索引。

---

### 2.6 慢查询日志：找出"最该优化的那条"

**🔧 这是什么**  
慢查询日志记录执行时间超过阈值的查询，帮你从成千上万条 SQL 里找出最值得优化的几条。

**✅ 这么做，你会得到**
- 10 分钟内定位生产环境真正的性能瓶颈，不靠猜。
- 发现"单次只慢 50ms，但每秒执行 1000 次"的查询（总耗时 50s/s）——这种才是真正的瓶颈。

**⚠️ 常见误解**
- "慢查询日志第一条就最重要"：应该按**总执行时间**排序，不是单次时间。
- "把阈值设为 0 记录所有查询"：日志记录本身有 IO 开销，生产环境建议 100ms–1s。

**🧪 最小可验证示例**
```sql
-- PostgreSQL：pg_stat_statements（最推荐）
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 总耗时最多的 10 条（最值得优化）
SELECT
  query,
  calls,
  round(total_exec_time::NUMERIC, 2)  AS total_ms,
  round(mean_exec_time::NUMERIC, 2)   AS avg_ms,
  rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- 平均最慢（过滤低频查询，避免偶发异常干扰）
SELECT query, calls, round(mean_exec_time::NUMERIC, 2) AS avg_ms
FROM pg_stat_statements
WHERE calls > 100
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 开启慢查询日志（仅当前会话，500ms 阈值）
SET log_min_duration_statement = 500;
-- 日志路径：/var/log/postgresql/postgresql-*.log
```

**MySQL 差异**：
```sql
-- 开启慢查询日志
SET GLOBAL slow_query_log    = 'ON';
SET GLOBAL long_query_time   = 0.5;   -- 秒
SET GLOBAL log_queries_not_using_indexes = 'ON';

-- 用命令行工具分析（按总耗时排序，显示前 10 条）
-- mysqldumpslow -s t -t 10 /var/log/mysql/slow.log

-- 或用 Performance Schema
SELECT digest_text, count_star, sum_timer_wait/1e12 AS total_sec
FROM performance_schema.events_statements_summary_by_digest
ORDER BY sum_timer_wait DESC LIMIT 10;
```

---

### 2.7 SARGable：什么样的 WHERE 条件能用索引

**🔧 这是什么**  
**SARGable**（Search ARGument ABLE）：WHERE 条件能被索引直接利用的写法。非 SARGable 条件强制扫描每一行，索引形同虚设。

| 非 SARGable（索引失效）| SARGable（能用索引）| 原因 |
|----------------------|-------------------|------|
| `WHERE UPPER(name) = 'ALICE'` | `WHERE name = UPPER('ALICE')`（或表达式索引）| 函数包裹了列 |
| `WHERE id + 1 = 100` | `WHERE id = 99` | 列参与了运算 |
| `WHERE CAST(created_at AS DATE) = '2025-01-01'` | `WHERE created_at >= '2025-01-01' AND created_at < '2025-01-02'` | 类型转换包裹了列 |
| `WHERE LEFT(phone, 3) = '138'` | `WHERE phone LIKE '138%'` | 函数包裹了列 |

**✅ 这么做，你会得到**
- 把所有函数移到**条件值那侧**（不是列那侧），索引立刻恢复使用。
- 或者建**表达式索引**，让数据库预先计算函数结果。

**⚠️ 常见误解**
- "改成 SARGable 就一定用索引"：还要看选择性。如果 WHERE 命中 80% 的行，即使 SARGable，优化器还是选全表扫（更合理）。

**🧪 最小可验证示例**
```sql
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- ❌ 非 SARGable：类型转换包裹列
EXPLAIN SELECT * FROM orders
WHERE created_at::DATE = '2025-01-15';
-- 预期：Seq Scan（即使有 created_at 索引）

-- ✅ SARGable：范围条件
EXPLAIN SELECT * FROM orders
WHERE created_at >= '2025-01-15' AND created_at < '2025-01-16';
-- 预期：Index Scan

-- 表达式索引解决函数包裹问题
CREATE TABLE customers (id SERIAL, email TEXT);
INSERT INTO customers (email)
SELECT 'User_' || i || '@Example.COM' FROM generate_series(1, 100000) i;

CREATE INDEX idx_customers_email ON customers(email);
-- ❌ 函数包裹：用不上普通索引
EXPLAIN SELECT * FROM customers WHERE LOWER(email) = 'user_50000@example.com';

-- ✅ 建表达式索引
CREATE INDEX idx_customers_email_lower ON customers(LOWER(email));
EXPLAIN SELECT * FROM customers WHERE LOWER(email) = 'user_50000@example.com';
-- 预期：Index Scan using idx_customers_email_lower
```

**MySQL 差异**：MySQL 8.0 支持函数索引（`CREATE INDEX ON t((LOWER(email)))`，注意双括号）。旧版本用生成列（Generated Column）变通：`ALTER TABLE t ADD COLUMN email_lower VARCHAR(200) GENERATED ALWAYS AS (LOWER(email)) STORED, ADD INDEX (email_lower);`。

---

### 2.8 ORDER BY / GROUP BY 的索引利用

**🔧 这是什么**  
B-tree 索引是有序的。如果 ORDER BY 顺序与索引顺序一致，数据库可以直接利用索引顺序返回数据，**跳过排序步骤**（避免 `Sort` 节点 / MySQL 的 `filesort`）。

**✅ 利用索引排序，你会得到**
- 消除 `Sort` 节点：100 万行排序约 500ms–2s，利用索引排序约 0ms（额外代价）。
- GROUP BY 走 `GroupAggregate`（要求有序输入）也能利用索引顺序，避免预排序。

**⚠️ 什么时候索引排序不生效**
- `ORDER BY a ASC, b DESC`：混合升降序，普通 B-tree 不支持（PG 支持 `CREATE INDEX ON t(a ASC, b DESC)` 指定方向）。
- 排序涉及的列不是索引前缀：`ORDER BY b`（只有 `(a,b)` 索引）无法利用。
- WHERE 过滤后剩余行数很少（<几百行）：排序代价微不足道，不值得专门建索引。

**🧪 最小可验证示例**
```sql
-- 无索引排序 vs 有索引排序
DROP INDEX IF EXISTS idx_orders_created;

-- ❌ 需要排序节点
EXPLAIN ANALYZE SELECT * FROM orders ORDER BY created_at LIMIT 20;
-- 预期：Limit → Sort → Seq Scan，耗时较高

-- ✅ 利用索引顺序（无 Sort 节点）
CREATE INDEX idx_orders_created ON orders(created_at);
EXPLAIN ANALYZE SELECT * FROM orders ORDER BY created_at LIMIT 20;
-- 预期：Limit → Index Scan（按索引顺序扫描，无 Sort 节点）

-- GROUP BY 对比：HashAggregate vs GroupAggregate
EXPLAIN ANALYZE
SELECT user_id, COUNT(*), SUM(amount)
FROM orders
GROUP BY user_id
ORDER BY user_id;
-- 有 idx_orders_user_id 时：GroupAggregate（利用索引顺序分组，无排序）
-- 无索引时：HashAggregate（构建哈希表分组）
-- 注意：HashAggregate 不一定更慢！小数据集下更快，因为省去了索引 IO

-- 混合升降序索引（PG 专有）
CREATE INDEX idx_created_desc ON orders(created_at DESC, id ASC);
EXPLAIN SELECT * FROM orders ORDER BY created_at DESC, id ASC LIMIT 20;
-- 预期：直接使用此索引，无 Sort
```

**MySQL 差异**：MySQL 8.0 引入倒序索引（`CREATE INDEX (col DESC)`）。`EXPLAIN` 的 `Extra` 字段显示 `Using filesort` 代表需要排序（优化信号），`Using index for group-by` 代表利用索引做 GROUP BY。

---

## 3. Master 模块 —— 优化器原理、并发、架构级取舍

> **学完这节你能做到**：理解优化器为什么选这个计划，并发操作对性能的影响，以及判断"这个问题靠 SQL 优化已经解决不了了"。

### 3.1 基于成本的优化器（CBO）：它怎么算 cost

**🔧 这是什么**  
CBO（Cost-Based Optimizer）枚举所有合理的执行计划，给每个计划计算 cost，选最低的执行。

Cost 计算简化公式：
```
总 Cost = Σ (每个节点的 cost)
节点 cost ≈ pages_read × page_cost + tuples_processed × cpu_tuple_cost
```

两个关键概念：
- **选择性（Selectivity）**：满足 WHERE 条件的行比例（0–1）。`user_id=12345` 选择性 = 0.00001（极高，用索引合算）；`amount>100` 选择性 = 0.9（走全表更合算）。
- **基数（Cardinality）**：一个节点预计输出的行数 = 总行数 × 选择性。

**✅ 理解 CBO，你会得到**
- 遇到"加了索引但优化器不用"：不是 bug，是优化器算下来走索引的 cost 更高（选择性低或统计信息过期）。
- 知道调整 `random_page_cost`/`cpu_tuple_cost` 可以影响优化器选择，但要谨慎。

**⚠️ CBO 的局限**
- **统计信息是采样的**：数据分布不均时估算误差大。
- **列间相关性**：`WHERE city='Shanghai' AND language='Chinese'` 两列高度相关，CBO 假设独立，行数估算可能偏低 100 倍。
- **参数嗅探**：针对某个参数生成的好计划，对其他参数可能是坏计划。

**🧪 最小可验证示例**
```sql
-- 高选择性 → 用索引
EXPLAIN SELECT * FROM orders WHERE user_id = 12345;

-- 低选择性 → 用全表扫描
EXPLAIN SELECT * FROM orders WHERE amount > 1;

-- 查看优化器的统计信息
SELECT attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'orders';
-- correlation 接近 1.0：物理顺序与逻辑顺序高度一致，范围扫描 IO 代价更低

-- 提高采样率（默认 100，增大可提高精度）
ALTER TABLE orders ALTER COLUMN user_id SET STATISTICS 500;
ANALYZE orders;
EXPLAIN SELECT * FROM orders WHERE user_id BETWEEN 1000 AND 2000;
-- 更精确的统计信息可能改变行数估算和计划选择

-- 多列相关性统计（PG 10+）
CREATE STATISTICS stat_orders_status_amount ON status, amount FROM orders;
ANALYZE orders;
-- 优化器现在知道 status 和 amount 之间的相关性
```

**MySQL 差异**：MySQL 8.0 引入直方图（Histogram）来精确估算非索引列的选择性。`ANALYZE TABLE orders UPDATE HISTOGRAM ON amount WITH 100 BUCKETS;`。查看：`SELECT * FROM information_schema.COLUMN_STATISTICS WHERE table_name='orders'\G`。

---

### 3.2 优化器走偏：原因与对策

**🔧 这是什么**

| 原因 | 症状 | 对策 |
|------|------|------|
| 统计信息过期 | rows 估算与实际差距大 | `ANALYZE 表名` |
| 数据倾斜 | 某参数下计划好，其他参数下差 | 更新统计信息；针对特殊值改写 SQL |
| 多列 AND 条件估算失败 | 行数估算极低（独立性假设失误）| 建扩展统计信息（`CREATE STATISTICS`）|
| JOIN 顺序不对 | 大表做驱动表，小表做被驱动表 | hint 指定 JOIN 顺序 |

**✅ 干预手段（从轻到重）**
1. `ANALYZE 表名` — 成本最低，先试这个
2. 改写 SQL — 把优化器处理不好的写法改成等价但更清晰的写法
3. `SET enable_hashjoin = off` 等 GUC 参数 — 临时禁用某种算法（调试用）
4. `pg_hint_plan` 扩展（PG）/ `FORCE INDEX`（MySQL）— 强制指定索引
5. 建扩展统计信息 — 告诉优化器列间相关性

**⚠️ 常见误解**
- "用 FORCE INDEX 强制好了"：hint 是硬编码，数据分布变化后 hint 指定的计划可能反而更慢。能不用 hint 就不用，优先解决根因。

**🧪 最小可验证示例**
```sql
-- 调试：临时禁用 Seq Scan，观察优化器的替代计划
SET enable_seqscan = off;
EXPLAIN SELECT * FROM orders WHERE user_id = 12345;
RESET enable_seqscan;

-- 扩展统计信息（解决多列相关性估算问题）
CREATE STATISTICS IF NOT EXISTS stat_status_amount
  ON status, amount FROM orders;
ANALYZE orders;

-- 查看扩展统计信息
SELECT stxname, stxkeys, stxkind FROM pg_statistic_ext;
```

**MySQL 差异**：`USE INDEX (idx_name)` 建议使用；`FORCE INDEX (idx_name)` 强制使用；`IGNORE INDEX (idx_name)` 忽略。MySQL 8.0 支持优化器提示（Optimizer Hints）：`SELECT /*+ INDEX(orders idx_user) */ ...`，比 SQL 注释形式更标准。

---

### 3.3 隔离级别与锁对性能的影响：MVCC

**🔧 这是什么**  
**MVCC（多版本并发控制）**：数据库保留数据的多个版本，读操作看"快照"不需要锁，写操作创建新版本——读写互不阻塞是高并发的基础。

但两大数据库的 MVCC 实现差异显著：

| | PostgreSQL | MySQL InnoDB |
|--|-----------|-------------|
| 旧版本存放位置 | 堆里（原地保留）| undo log |
| 清理机制 | VACUUM（需定期运行）| 自动清理 undo log |
| 长事务影响 | 阻止 VACUUM → 表膨胀（bloat）| undo log 增长，不能清理 |
| 默认隔离级别 | Read Committed | Repeatable Read |
| 间隙锁 | 无（默认 RC 级别）| 有 Next-Key Lock（防幻读，但易死锁）|

**✅ 理解 MVCC 和锁，你会得到**
- 遇到"查询在高并发下突然变慢"，先查锁等待，不是先优化 SQL。
- 知道 PostgreSQL 需要定期 VACUUM，检查表膨胀。

**⚠️ 常见性能杀手**
- **长事务**（运行几分钟的事务）：PostgreSQL 阻止 VACUUM，表越来越膨胀，查询越来越慢。
- **SELECT FOR UPDATE 范围过大**：锁住太多行，其他写操作全排队。
- **死锁**：两个事务互相等待，DB 自动 rollback 一个，应用重试，吞吐下降。

**🧪 最小可验证示例**
```sql
-- 查看当前锁等待（PostgreSQL）
SELECT
  blocking_pid,
  blocked_pid,
  substring(blocking_query, 1, 60) AS blocking_query,
  substring(blocked_query, 1, 60) AS blocked_query
FROM pg_stat_activity a
JOIN pg_stat_activity b ON a.pid = ANY(pg_blocking_pids(b.pid))
LIMIT 10;

-- 查看长事务
SELECT pid,
       round(EXTRACT(EPOCH FROM (now() - xact_start)))::INT AS duration_sec,
       state,
       substring(query, 1, 80) AS query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY duration_sec DESC
LIMIT 10;

-- 检查表膨胀（需要 pgstattuple 扩展）
CREATE EXTENSION IF NOT EXISTS pgstattuple;
SELECT
  table_len,
  tuple_count,
  dead_tuple_count,
  round(dead_tuple_percent::NUMERIC, 1) AS dead_pct
FROM pgstattuple('orders');
-- dead_tuple_percent 高（>10%）→ 需要 VACUUM

-- 手动 VACUUM（清理死行，不锁表）
VACUUM orders;
```

**MySQL 差异**：查看锁等待：`SELECT * FROM performance_schema.data_locks\G`（8.0）。查看长事务：`SELECT * FROM information_schema.INNODB_TRX ORDER BY trx_started\G`。MySQL InnoDB 有自动清理 undo log 的机制，不需要类似 VACUUM 的操作，但长事务会让 undo log 无法清理，导致 ibdata1 文件持续增大。

---

### 3.4 索引进阶类型

**🔧 这是什么**

| 索引类型 | 适用场景 | 不适用 |
|---------|---------|--------|
| **Hash 索引** | 等值查询（`=`），略快于 B-tree | 范围查询、排序（不支持）|
| **GIN**（倒排索引）| 数组包含（`@>`）、JSONB 查询、全文搜索 | 单值等值查询（维护代价重）|
| **GiST** | 地理位置、范围类型（tsrange）、几何形状 | 普通等值/范围查询 |
| **部分索引** | 只对满足条件的行建索引（`WHERE status='active'`）| 需要查询全部值 |
| **表达式索引** | 对函数结果建索引（`LOWER(email)`）| 函数未在查询中使用 |

**✅ 用对索引类型，你会得到**
- JSONB 查询加 GIN 索引：`WHERE data @> '{"tag": "vip"}'` 从全表扫到毫秒级。
- 部分索引（1% 的行 `status='cancelled'`）：索引体积是全列索引的 1/100，查询仍走索引。

**⚠️ 常见误解**
- "GIN 索引越多越好"：GIN 维护代价极高（写入时要更新倒排索引），高写入表慎用。
- "部分索引总是更好"：如果查询分布均匀，全列索引更合适；只有 WHERE 条件高度集中才值得建部分索引。

**🧪 最小可验证示例**
```sql
-- 部分索引
CREATE INDEX idx_orders_pending_user ON orders(user_id)
WHERE status = 'pending';

EXPLAIN SELECT * FROM orders
WHERE user_id = 12345 AND status = 'pending';
-- Index Scan using idx_orders_pending_user（比全列索引小很多）

-- 表达式索引
CREATE TABLE customers2 (id SERIAL, email TEXT);
INSERT INTO customers2 (email)
SELECT 'User_' || i || '@Example.COM' FROM generate_series(1, 100000) i;

CREATE INDEX idx_c2_email_lower ON customers2(LOWER(email));
EXPLAIN SELECT * FROM customers2
WHERE LOWER(email) = 'user_50000@example.com';
-- Index Scan using idx_c2_email_lower ✅

-- JSONB + GIN 索引
CREATE TABLE events (id SERIAL, data JSONB);
INSERT INTO events (data)
SELECT ('{"user_id": ' || (random()*1000)::INT || ', "type": "click"}')::JSONB
FROM generate_series(1, 100000);

EXPLAIN SELECT * FROM events WHERE data @> '{"type": "click"}';
-- 无索引：Seq Scan

CREATE INDEX idx_events_gin ON events USING GIN(data);
EXPLAIN SELECT * FROM events WHERE data @> '{"type": "click"}';
-- Bitmap Index Scan using idx_events_gin ✅
```

**MySQL 差异**：MySQL 不支持 GiST/GIN。全文搜索用 `FULLTEXT` 索引（`MATCH() AGAINST()`）。JSON 查询：MySQL 8.0 支持多值索引（`CREATE INDEX ON t((CAST(data->'$.tags' AS CHAR(100) ARRAY)))`）。不支持部分索引（Filtered Index），可用生成列变通。Hash 索引仅 Memory 存储引擎支持，InnoDB 内部有自适应哈希索引（不能手动创建）。

---

### 3.5 分区表：何时有用，何时挖坑

**🔧 这是什么**  
**分区表**：把一张大表按规则分成多个物理子表。查询时根据分区键做**分区裁剪（Partition Pruning）**，只扫描相关分区。

三种分区方式：Range（按范围）、List（按值列表）、Hash（按哈希均匀分布）。

**✅ 分区表真正有用的场景**
- **时序数据 + 主要按时间范围查询**：`WHERE created_at BETWEEN '2025-01' AND '2025-03'` 只扫 3 个月分区。
- **历史数据归档**：`DROP TABLE orders_2022_01` = 秒级删除上亿行（比 DELETE 快 1000 倍）。
- **VACUUM 加速**：每个分区独立 VACUUM，互不影响。

**⚠️ 分区表的陷阱（常见负优化）**
- **分区键没有出现在 WHERE 里**：没有分区裁剪，扫所有分区，比不分区还慢。
- **跨分区 JOIN**：两张分区表的 JOIN，分区组合爆炸，计划复杂度大增。
- **小表分区**：10 万行分成 12 个月份，每个 8000 行。查询反而要打开 12 个子表的元数据，比不分区还慢。
- **分区键选择错误**：按 user_id hash 分区，但主要查询是按时间范围——分区完全没用。

**🧪 最小可验证示例**
```sql
-- 创建按月分区的订单表
CREATE TABLE orders_part (
  id         BIGSERIAL,
  user_id    BIGINT        NOT NULL,
  status     VARCHAR(20)   NOT NULL,
  amount     NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP     NOT NULL
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_part_2025_01 PARTITION OF orders_part
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE orders_part_2025_02 PARTITION OF orders_part
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE orders_part_2025_03 PARTITION OF orders_part
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

INSERT INTO orders_part (user_id, status, amount, created_at)
SELECT (random()*99999+1)::BIGINT,
       'paid',
       (random()*1000)::NUMERIC(10,2),
       '2025-01-01'::TIMESTAMP + (random()*89||' days')::INTERVAL
FROM generate_series(1, 300000);
ANALYZE orders_part;

-- ✅ 分区裁剪效果
EXPLAIN SELECT * FROM orders_part
WHERE created_at BETWEEN '2025-01-01' AND '2025-01-31';
-- 观察：只扫 orders_part_2025_01，其他分区被 pruned

-- ❌ 无分区裁剪（分区键未出现在 WHERE）
EXPLAIN SELECT * FROM orders_part WHERE user_id = 12345;
-- 扫所有分区：比不分区还慢（有子表元数据开销）
```

**MySQL 差异**：MySQL 分区语法类似（`PARTITION BY RANGE`），但 InnoDB 要求分区键必须是主键的一部分；外键不能跨分区表使用。MySQL 8.0 对分区裁剪的支持更完善。

---

### 3.6 物化视图与查询缓存的取舍

**🔧 这是什么**
- **物化视图（Materialized View）**：把复杂查询的结果**物理存储**，查询时直接读结果，不重新计算。需要手动或定期 `REFRESH`。
- **查询缓存（Query Cache）**：MySQL 8.0 已**完全移除**（高并发写入场景锁竞争严重，是负优化）。

**✅ 物化视图的适用场景**
- **低频刷新 + 高频查询的聚合报表**：日销售额汇总每天刷新一次，被查询 10000 次。
- **复杂 JOIN + 聚合**：把 10 张表的 JOIN 聚合结果物化，查询从 30 秒降到 50ms。

**⚠️ 物化视图的局限**
- **数据有延迟**：刷新周期内数据不是最新的，业务能接受延迟才能用。
- **刷新成本**：`REFRESH MATERIALIZED VIEW` 重新执行整个查询，原查询是 30 秒，刷新也要 30 秒。
- **PostgreSQL 不支持原生增量刷新**：`REFRESH MATERIALIZED VIEW CONCURRENTLY` 不锁但更慢，且要求有唯一索引。

**🧪 最小可验证示例**
```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW user_order_stats AS
SELECT
  user_id,
  COUNT(*)       AS order_count,
  SUM(amount)    AS total_amount,
  AVG(amount)    AS avg_amount,
  MAX(created_at) AS last_order_at
FROM orders
GROUP BY user_id;

CREATE UNIQUE INDEX idx_mv_user_id ON user_order_stats(user_id);

-- 查询物化视图（极快）
EXPLAIN ANALYZE SELECT * FROM user_order_stats WHERE user_id = 12345;
-- Index Scan，毫秒级

-- 刷新物化视图
REFRESH MATERIALIZED VIEW user_order_stats;              -- 锁视图
REFRESH MATERIALIZED VIEW CONCURRENTLY user_order_stats; -- 不锁，需唯一索引
```

**MySQL 差异**：MySQL 没有原生物化视图。替代方案：普通表 + 定时 `INSERT ... SELECT` 刷新；或 MySQL 8.0 的派生表缓存。查询缓存在 MySQL 8.0 完全移除，新项目不要依赖它。

---

### 3.7 架构级信号：何时 SQL 优化已到极限

**🔧 这是什么**  
有些性能问题的根因不在 SQL 写法或索引，而在系统架构。继续优化 SQL 是在错误的层级解决问题。

| 信号 | 可能原因 | 架构级解法 |
|------|---------|-----------|
| 单实例 CPU 持续 >80% | 查询太多，单机算力不足 | 读写分离（只读副本分担读流量）|
| 即使加了索引查询仍慢 | IO 吞吐瓶颈（磁盘带宽打满）| 升级 SSD；换列存引擎（ClickHouse 等）|
| EXPLAIN 计划很好但应用层感受慢 | 连接池打满；网络延迟；N+1 查询 | 连接池调优；应用层缓存（Redis）|
| 表行数超 1 亿且持续增长 | 单表过大 | 分库分表；时序数据库；归档策略 |
| 复杂聚合报表超过 10 秒 | OLTP 数据库不适合 OLAP 工作负载 | ETL 到 OLAP 引擎（ClickHouse、Redshift）|

**⚠️ 常见误解**
- "先做分库分表"：分库分表引入的复杂度（跨库事务、分布式 ID、聚合困难）远超单机优化的收益。一台现代服务器（32 核、512GB 内存、NVMe SSD）能支撑每秒数万 TPS、表数十亿行——绝大多数应用永远不会到这个极限。
- "上了 Redis 就不用优化 SQL 了"：缓存解决热点读取，但数据库仍需处理缓存未命中、写入、复杂查询。

**MySQL 差异**：MySQL 读写分离方案：MySQL Replication + ProxySQL / MaxScale。

---

### 3.8 反模式集合：常见"网上技巧"的适用边界

**🔧 这是什么**  
SQL 优化建议充斥互联网，但每条建议都有适用边界：

| 流传的"技巧" | 什么时候是真的 | 什么时候是负优化 |
|------------|--------------|---------------|
| "避免 SELECT *" | SELECT 列多/有大字段/需要覆盖索引时 | 真正需要所有列，且无大字段时，区别几乎可忽略 |
| "子查询比 JOIN 慢" | MySQL 5.7 及以前，IN 子查询有优化缺陷 | MySQL 8.0+/PostgreSQL：优化器会改写，无差异，看 EXPLAIN 说了算 |
| "索引越多越好" | 读多写少的查询表 | 写多读少（日志表、事件表）：每次写入维护大量索引，写吞吐崩溃 |
| "用 LIMIT 1 优化单行查询" | 查询可能返回多行但你只要第一行 | 用了主键/唯一索引等值查询，结果本来就只有一行，LIMIT 1 没有任何效果 |
| "NOT IN 很慢，改 NOT EXISTS" | MySQL 5.7 及以前特定场景 | 现代优化器两者通常等价，具体看 EXPLAIN |
| "UNION ALL 比 UNION 快" | 确实不需要去重时 | 如果结果需要去重，UNION ALL 把去重负担转给应用层 |

**✅ 正确态度**
- **每条优化建议都要在你的真实数据上 `EXPLAIN ANALYZE` 验证**。
- 优化的目标是降低 `actual time`，不是让 EXPLAIN 看起来"更漂亮"。

**MySQL 差异**：MySQL 的反模式比 PostgreSQL 更多（历史版本优化器较弱），但 MySQL 8.0 已修复大部分。遇到 MySQL 5.x 的"经验"要特别小心，很多在 8.0 不再适用。

---

## 4. 什么时候【不该】继续优化 SQL

> **学完这节你能做到**：拿到一个性能问题，先判断它属于哪个层级，避免在错误的层级解决问题。

### 4.1 判断框架：慢的到底是什么

```
慢查询出现了
    ↓
Step 1：是应用层问题吗？
  → N+1 查询（循环里每次查一条）？→ 改成批量查询
  → 连接池耗尽（new connection 耗时）？→ 调整连接池大小

Step 2：是锁等待吗？
  → pg_stat_activity 有 waiting 状态？SHOW PROCESSLIST 有 Lock wait？
  → 找锁来源，缩短事务，减小锁粒度

Step 3：是 IO 瓶颈吗？
  → iostat 显示磁盘利用率 >80%？
  → 优化查询减少 IO，或升级存储（SSD）
  → 内存不足导致大量 buffer cache miss？
  → 增大 shared_buffers / innodb_buffer_pool

Step 4：是统计信息问题吗？
  → EXPLAIN 的估算行数与实际差 10 倍以上？
  → ANALYZE 表名

Step 5：是 SQL/索引问题吗？
  → 回到模块 1–2 的方法论优化 SQL 和索引

Step 6：到这里还慢？
  → 考虑架构层优化（见模块 3.7）
```

### 4.2 优化 SQL 的收益递减点

当查询已达到以下状态，继续优化 SQL 的收益极低：
- `EXPLAIN ANALYZE` 显示精确命中索引（Index Only Scan 或高选择性 Index Scan）
- 估算行数与实际行数误差 < 2 倍
- 查询耗时已在业务可接受范围（OLTP <10ms，报表 <5s）
- 瓶颈节点是 IO 本身（磁盘速度上限），而非查询计划问题

这时再去"优化 SQL 写法"属于过度优化，收益远不如升级硬件或改架构。

### 4.3 该改 Schema / 该上缓存 / 该分库分表的判断标准

**该改 Schema 的信号**：
- 查询总要 JOIN 5+ 张表才能取到一个完整对象 → 考虑反范式化（适当冗余）
- 高频查询的 WHERE 条件列无法加合适索引 → 考虑专门的查询表
- TEXT/BLOB 字段和高频查询列混在同一张宽表 → 拆分成主表 + 附加信息表

**该上缓存的信号**：
- 热点数据（相同参数重复查询）占查询量 80% 以上
- 数据允许一定延迟（缓存 TTL 内的旧数据业务可接受）
- 查询本身已经足够快（<10ms），但 QPS 太高，数据库连接数打满

**该分库分表的信号（慎重！）**：
- 单表超过 5 亿行，且增长不可控
- 写入 TPS 持续超过单机极限（高端服务器约 ~50000 TPS）
- 地理分布需求（不同地区就近存储）

---

## 5. 动手路线图

### 5.1 推荐练习顺序

```
Week 1：基础篇
  ① 搭测试环境（Docker PostgreSQL + 100 万行 orders 表）
  ② 练习读 EXPLAIN ANALYZE（找最贵节点，理解五个核心字段）
  ③ 亲手做"无索引 vs 有索引"对比，记录耗时
  ④ 练习覆盖索引（消除回表，观察 Heap Fetches 变化）
  ⑤ 触发常见慢查询元凶的全部 5 种情况

Week 2：进阶篇
  ⑥ 做深翻页问题改写练习（OFFSET vs 键集分页，对比耗时）
  ⑦ 验证 JOIN 算法切换（有索引/无索引，观察 Nested Loop vs Hash Join）
  ⑧ 制造统计信息过期，观察计划走偏，用 ANALYZE 修复
  ⑨ 练习 pg_stat_statements 慢查询分析

Week 3：Master 篇
  ⑩ 理解 CBO 的 cost 计算，调整 random_page_cost 观察计划变化
  ⑪ 建分区表，验证分区裁剪（和无裁剪的性能对比）
  ⑫ 创建物化视图，测试刷新前后查询耗时
  ⑬ 人为制造死锁，用系统视图观察和诊断
```

### 5.2 测试环境搭建（一条命令 + 建表脚本）

```bash
# 启动 PostgreSQL（Docker）
docker run -d \
  --name pg-perf-lab \
  -e POSTGRES_PASSWORD=perf123 \
  -e POSTGRES_DB=perfdb \
  -p 5432:5432 \
  postgres:16

# 连接数据库
docker exec -it pg-perf-lab psql -U postgres -d perfdb
```

```sql
-- 创建完整测试表（含合理数据分布）
CREATE TABLE orders (
  id         BIGSERIAL     PRIMARY KEY,
  user_id    BIGINT        NOT NULL,
  status     VARCHAR(20)   NOT NULL,
  amount     NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP     NOT NULL,
  updated_at TIMESTAMP     NOT NULL
);

-- 100 万行，数据分布贴近真实业务
INSERT INTO orders (user_id, status, amount, created_at, updated_at)
SELECT
  -- user_id: 幂律分布（少数用户下单多）
  (power(random(), 2) * 99999 + 1)::BIGINT,
  -- status: 真实比例（80% done，10% pending，其他各 5%）
  CASE
    WHEN random() < 0.80 THEN 'done'
    WHEN random() < 0.90 THEN 'pending'
    WHEN random() < 0.95 THEN 'paid'
    ELSE 'shipped'
  END,
  -- amount: 近似正态分布，均值 500
  GREATEST(1, ((random()+random()+random()+random()-2)*200 + 500))::NUMERIC(10,2),
  -- created_at: 最近两年，近期数据更多
  NOW() - (power(random(), 2) * 730 || ' days')::INTERVAL,
  NOW()
FROM generate_series(1, 1000000);

ANALYZE orders;

-- 验证数据分布
SELECT status,
       COUNT(*),
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM orders
GROUP BY status
ORDER BY 2 DESC;
```

### 5.3 自测清单（每个模块验收标准）

**基础篇完成标准：**
- [ ] 能在 5 分钟内从 `EXPLAIN ANALYZE` 输出中找到最慢节点
- [ ] 能解释 Seq Scan / Index Scan / Bitmap Index Scan / Index Only Scan 的区别和各自适用场景
- [ ] 亲手验证了至少 3 种"慢查询元凶"（有 EXPLAIN 记录）
- [ ] 知道什么时候全表扫描比索引扫描更合理

**进阶篇完成标准：**
- [ ] 能解释深翻页问题，并写出正确的键集分页 SQL
- [ ] 能通过 `pg_stat_statements` 找到"总耗时最多的前 5 条查询"
- [ ] 能人为触发统计信息过期问题，并用 ANALYZE 修复
- [ ] 理解 SARGable 概念，能识别并改写 5 种非 SARGable 写法

**Master 篇完成标准：**
- [ ] 能解释 CBO 的 cost 计算，知道 `random_page_cost` 影响什么
- [ ] 建过分区表，验证过分区裁剪（和无裁剪对比过）
- [ ] 遇到"有索引但不走索引"能独立诊断原因（统计信息？选择性？）
- [ ] 能判断当前问题是否需要从 SQL 层面升级到架构层面解决

---

*文档版本：2026-04 | 基于 PostgreSQL 16 & MySQL 8.0*  
*参考来源：[PostgreSQL 官方文档 Ch.14](https://www.postgresql.org/docs/current/performance-tips.html) · [Use The Index, Luke](https://use-the-index-luke.com/) · [MySQL 8.0 优化章节](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)*
