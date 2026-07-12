# SQL 查询性能优化 · 实战练习记录

> 测试环境：PostgreSQL 16（Docker）  
> 测试数据：`orders` 表 100 万行、`users` 表 10 万行、`events` 表 50 万行  
> 所有耗时均为 `EXPLAIN ANALYZE` 实测值

---

## Summery

- 不要用 `*` ，要哪列直接写列名
  - 这能大幅度减少内存缓冲区的读写压力从而提高速度（即 `Buffers` 的消耗）
- 可以添加索引
  - B-Tree：需要等值、范围、排序查询（默认先选它）
  - Hash：只做 = 比较，且写入不频繁
  - GIN：列是数组、JSONB、全文，需要包含/匹配查询
  - GiST：列是坐标、几何、范围类型，需要邻近/重叠/包含
  - BRIN：表超大（亿级）且数据按物理顺序写入（如时间戳、自增 ID）
  - SP-GiST：数据分布极不均匀，需要前缀匹配或多维空间分区（如 IP 段、电话号码）
- 如果需要多表查询，可以调用不同的Join算法
  - Nested Loop，**小**数据量或有索引
  - Hash Join，**等值**连接大数据量
  - Merge Join，数据**有序**或超大表
- 添加完数据后记得`ANALYZE`
  - 如果在添加完大量数据后没有`ANALYZE`，有可能会导致错判数据量，导致用错方法



## 模块 1：基础篇 —— 索引与执行计划

---

### 练习 1-1：缺索引导致全表扫描

**【问题 SQL】**
```sql
SELECT * FROM orders WHERE user_id = 42000;
```

**【结果】**
```
Gather  (cost=1000.00..15555.83 rows=15 width=43) (actual time=50.225..146.693 rows=8 loops=1)
  Workers Planned: 2 
  Workers Launched: 2

-> Parallel Seq Scan on orders(cost=0.00..14554.33 rows=6 width=43) (actual time=24.368..125.391 rows=3 loops=3)
  Filter: (user_id = 42000)
  Rows Removed by Filter: 333331
Execution Time: 147ms
(8 rows)
```

**【得到什么】**

- 扫描方式：**Parallel Seq Scan**（并行全表扫描）
- 扫描行数：**100 万行**，返回 8 行
- 3 个 worker (`loops=3`)各扫 33 万行(`Rows Removed by Filter: 333331`)，全部丢弃后只剩 8 行 (`actual rows=8`)
- 多线程调度 (Gather)**`Workers Planned: 2` / `Workers Launched: 2`**: 计划分配 2 个并行工人，并且成功启动了 2 个。数据库的并行配置正在正常工作。
- 执行耗时 147ms (`Execution Time: 147.020 ms`)

**【原因】**
`user_id` 列没有索引，数据库不知道 `user_id=42000` 的行在哪个物理页上，只能从第一行扫到最后一行逐行检查。

**【如何优化】**
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

**【优化结果】**

```
Bitmap Heap Scan on orders
  Heap Blocks: exact=8
  -> Bitmap Index Scan on idx_orders_user_id
       Index Cond: (user_id = 42000)
Execution Time: 1.188ms
```

- 使用B-tree 索引
- 计划从笨重的 `Seq Scan` 变成高效的 `Index Scan`。

**【结论】**

> 加 B-tree 索引后，扫描行数从 100 万降到 8 行，耗时从 **147ms → 1.188ms，快 124 倍**。  
> 根本原理：索引是有序结构，O(log n) 定位到目标行；全表扫描是 O(n)，必须逐行检查。



### 补充1：扫描方式

| **扫描方式**        | **访问对象**  | **访问模式**   | **适合场景**                     |
| ------------------- | ------------- | -------------- | -------------------------------- |
| **Seq Scan**        | Heap (全表)   | 顺序顺序读取   | 小表或返回大部分数据的查询       |
| **Index Scan**      | Index + Heap  | 随机/精准定位  | 返回极少量数据（高选择性）       |
| **Index Only Scan** | Index         | 仅读索引       | 索引覆盖了所有需要返回的字段     |
| **Bitmap Scan**     | Index -> Heap | 排序后批量读取 | 返回中等量数据，或多索引组合查询 |



### 补充2：指定索引类型

在 PostgreSQL 中，它默认创建的是 **B-Tree** 类型的索引。但你可以通过添加 `USING` 关键字来明确指定最适合你业务场景的索引类型。

**语法结构非常简单，只需加一个词：**

```SQL
CREATE INDEX idx_orders_user_id ON orders USING 索引类型 (user_id);
```

PostgreSQL 的强大之处在于它提供了极其丰富的索引武器库。以下是几种最核心的索引类型及其拿手好戏：

**PostgreSQL 核心索引类型对比表**

| **索引类型** | **核心算法**   | **最擅长的操作**                     | **适用数据类型**                       | **存储占用** | **备注**                                                    |
| ------------ | -------------- | ------------------------------------ | -------------------------------------- | ------------ | ----------------------------------------------------------- |
| **B-Tree**   | 多路平衡搜索树 | `=, <, <=, >, >=, BETWEEN, ORDER BY` | 基本所有类型 (int, text, date...)      | 中等         | **默认首选**。全能选手，支持范围查询和排序。                |
| **Hash**     | 哈希桶映射     | 仅支持等值匹配（`=`）                | 简单数据类型                           | 较小         | 不支持范围查询，不支持排序。仅在极高频单值查找时略快。      |
| **GIN**      | 倒排索引       | 成员包含（`@>`, `?`, `&&`）          | **JSONB**, 数组 (Array), 全文检索      | 较大         | 适合“一个字段包含多个元素”的情况。更新成本略高。            |
| **GiST**     | 通用搜索树     | 包含、相交、距离计算 (`<->`)         | **地理几何 (PostGIS)**, 范围类型, 向量 | 较大         | 空间索引的王者。美团找附近商家、滴滴找车全靠它。            |
| **BRIN**     | 块级范围索引   | 范围扫描（针对有序数据）             | 时间戳, 自增 ID (时序数据)             | **极小**     | 适合**超大型表**（TB级）。靠记录数据块的最大/最小值来过滤。 |
| **SP-GiST**  | 空间分区 GiST  | 非平衡分布的数据搜索                 | 电话号码, 前缀匹配, 空间点             | 中等         | 适合数据分布极度不均匀的场景。                              |



---

### 练习 1-2：SELECT * 破坏覆盖索引（回表问题）

**【问题 SQL】**
```sql
SELECT user_id, SUM(amount)
FROM orders
WHERE user_id = 42000
GROUP BY user_id;
```

**【结果】**
```
GroupAggregate
  -> Bitmap Heap Scan on orders(cost=4.54..62.93 rows=15 width=14) (actual time=0.317..0.636 rows=8 loops=1)
  		 Recheck Cond: (user_id = 42000)
       Heap Blocks: exact=8    ← 回表 8 次
       
  ->  Bitmap Index Scan on idx_orders_user_id  (cost=0.00..4.54 rows=15 width=0) (actual time=0.227..0.233 rows=8 loops=1)
       Index Cond: (user_id = 42000)
               
Execution Time: 1.016ms
(8 rows)
```

**【得到什么】**
- 已有 `idx_orders_user_id(user_id)` 索引，但仍有 `Heap Blocks: exact=8`
- 每次索引命中后还需要去堆取 `amount` 字段 → 回表 8 次
- GroupAggregate (分组聚合)
  - 发现这 8 条数据都是同一个 `user_id` (42000)，于是把它当成一个组（Group），然后把这 8 行里的 `amount` 金额全部加起来（Aggregate），最后输出唯一的 **1 行** 结果（`rows=1`）。


**【原因】**
索引 `idx_orders_user_id` 只包含 `user_id` 列，`amount` 不在索引里。数据库通过索引找到行地址后，必须再去堆（原始数据文件）取 `amount` 的值，这叫**回表（Heap Fetch）**。

**【如何优化】**

方案 A：复合索引（amount 参与 B-tree 键，支持 ORDER BY amount）
```sql
CREATE INDEX idx_orders_user_amount ON orders(user_id, amount);
```

方案 B：INCLUDE 索引（amount 只附带存储，不参与排序）
```sql
CREATE INDEX idx_orders_user_inc_amount ON orders(user_id) INCLUDE (amount);
```

**【优化结果】**
```
GroupAggregate
  -> Index Only Scan using idx_orders_user_inc_amount
       Index Cond: (user_id = 42000)
       Heap Fetches: 0    ← 回表完全消除
Execution Time: 0.455ms
```

**【结论】**
> `Heap Fetches: 0` 意味着完全不碰堆，查询只在索引里完成。  
> 耗时从 **1.016ms → 0.455ms**，读取页数从 8 降到 4。  
>
> **两种方案的区别：**
> | | `(user_id, amount)` | `(user_id) INCLUDE (amount)` |
> |--|--------------------|-----------------------------|
> | 覆盖索引 | ✅ | ✅ |
> | `ORDER BY amount` | ✅ 可利用索引排序 | ❌ amount 不是键，不能排序 |
> | 索引体积 | 略大 | 略小 |

---

### 练习 1-3：函数包裹列导致索引失效（非 SARGable）

**【问题 SQL】**

```sql
-- created_at 上已有索引 idx_orders_created
SELECT * FROM orders
WHERE EXTRACT(YEAR FROM created_at) = 2024;
```

**【结果】**
```
Parallel Seq Scan on orders
  Filter: (EXTRACT(year FROM created_at) = '2024'::numeric)
  Rows Removed by Filter: 813964
Execution Time: 345ms
```

**【得到什么】**
- 即使 `created_at` 上有 B-tree 索引，依然走全表扫描
- 索引完全没被使用

**【原因】**
`EXTRACT(YEAR FROM created_at)` 把列"包住"了。B-tree 索引按 `created_at` 的原始值（如 `2024-03-15 10:23:00`）排序，不认识 `EXTRACT` 的计算结果。数据库只能逐行计算函数值再比较，索引帮不上忙。

这种写法叫 **非 SARGable（Search ARGument ABLE）**：条件无法被索引直接利用。

**【如何优化】**
把函数移到**条件值那侧**，让列保持裸露：
```sql
# 方案一：改写 SQL（强烈推荐 —— 顺应索引）
SELECT * FROM orders
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01';

# 方案二：创建“函数索引”（Expression Index）
CREATE INDEX idx_orders_created_year ON orders( (EXTRACT(YEAR FROM created_at)) );
```

**其他可能的方法**

- BRIN 索引（块范围索引）
  - **它的原理**：它把数据表分成很多个“数据块”，只记录**每个数据块里时间的最小值和最大值**。
  - **巨大优势**：当你查 2024 年的数据时，数据库一看 BRIN 索引：“第 1 到 50 万个数据块的最大时间是 2023 年，直接跳过！第 50 万到 80 万个数据块的时间在 2024 年内，全部拿出来！”
  - **为什么用它**：它的体积惊人地小（只有 B-Tree 的千分之一甚至万分之一），创建极快，极其适合处理海量的时间序列数据。
  - **语法**：`CREATE INDEX idx_orders_created_brin ON orders USING brin (created_at);`
- 部分索引（Partial Index）：建一个**只包含 2024 年数据的专属索引**。
- 表分区（Table Partitioning）
  - **它的原理**：在逻辑上你依然是对 `orders` 这一张表做查询，但在物理硬盘上，PostgreSQL 已经悄悄按月或按年把数据拆分成了 `orders_2023`, `orders_2024` 等多张小表。
  - **巨大优势**：当你查询 2024 年的数据时，数据库会直接锁定 `orders_2024` 这张物理表进行查询，彻底无视其他年份的数据。这不仅是查询最快的方案，日后你想清理 5 年前的旧订单时，直接“删表”一秒搞定，不会产生任何系统卡顿。

**【优化结果】**

```
Bitmap Heap Scan on orders
  -> Bitmap Index Scan on idx_orders_created
       Index Cond: (created_at >= '2024-01-01' AND created_at < '2025-01-01')
Execution Time: 304ms
```

**【结论】**

> 改写后索引被使用，耗时从 **345ms → 304ms**。  
> 但提升有限（仅 12%），原因是结果集占全表约 **18.6%**——回表 9,346 次几乎等于全表 IO。  
>
> **双重教训：**
> 1. 函数包裹列必须改写（否则索引完全失效）
> 2. 结果集超过全表 10%，即使走索引收益也有限——这条查询的根本瓶颈是"查的范围太大"

---

### 练习 1-4：低基数列索引的真相

**【问题 SQL】**
```sql
-- 给 status 建索引（只有 4 个不同值）
CREATE INDEX idx_orders_status ON orders(status);

SELECT * FROM orders WHERE status = 'done';
SELECT * FROM orders WHERE status = 'paid';
SELECT * FROM orders WHERE status = 'shipped';
```

**【结果】**

```ini
# SELECT * FROM orders WHERE status = 'done';
Seq Scan on orders  (cost=0.00..21846.00 rows=800967 width=43) (actual time=0.038..385.521 rows=800350 loops=1)
   Filter: ((status)::text = 'done'::text)
   Rows Removed by Filter: 199650
   Buffers: shared hit=9346

 Planning Time: 0.616 ms
 Execution Time: 477.041 ms
(6 rows)

# SELECT * FROM orders WHERE status = 'paid';
Bitmap Heap Scan on orders  (cost=216.19..9800.53 rows=19067 width=43) (actual time=12.223..118.482 rows=18915 loops=1)
   Recheck Cond: ((status)::text = 'paid'::text)
   Heap Blocks: exact=8160
   ->  Bitmap Index Scan on idx_orders_status  (cost=0.00..211.43 rows=19067 width=0) (actual time=8.912..8.913 rows=18915 loops=1)
         Index Cond: ((status)::text = 'paid'::text)

 Planning Time: 0.293 ms
 Execution Time: 121.105 ms
(7 rows)

# SELECT * FROM orders WHERE status = 'shipped';
Index Scan using idx_orders_status on orders  (cost=0.42..1409.69 rows=667 width=43) (actual time=1.107..13.306 rows=982 loops=1)
   Index Cond: ((status)::text = 'shipped'::text)
   
 Planning Time: 1.584 ms
 Execution Time: 13.703 ms
(4 rows)
```

| 查询 | 返回行数 | 占比 | 扫描方式 | 耗时 |
|------|---------|------|---------|------|
| `status='done'` | 800,350 | 80% | **Seq Scan** | 477ms |
| `status='paid'` | 18,915 | 1.9% | Bitmap Index Scan | 121ms |
| `status='shipped'` | 982 | 0.1% | **Index Scan** | 13ms |

**【得到什么】**
- 同一个索引，对不同值有截然不同的行为
- `done`（80%）：优化器无视索引，走全表扫——索引没用上
- `shipped`（0.1%）：索引发挥作用，快 36 倍

**【原因】**

- `status = 'done'` (占 80%) ➔ 放弃索引，全表扫描
  - **执行计划**：`Seq Scan`
- `status = 'paid'` (占 2%) ➔ 智能折中：位图扫描
  - **执行计划**：`Bitmap Index Scan` + `Bitmap Heap Scan`
- `status = 'shipped'` (占 0.1%) ➔ 传统索引扫描
  - **执行计划**：`Index Scan`

- 

**【如何优化】**
如果只需要查询 `shipped` 和 `paid`，用**部分索引**节省空间：
```sql
-- 只索引稀有值，体积是全列索引的 2%
CREATE INDEX idx_orders_rare_status ON orders(status)
WHERE status IN ('shipped', 'paid');
```

**【结论】**
> "给低基数列建索引没用"是**错误**说法。准确说法是：  
> **对高频值（占比 >10%）没用；对稀有值（占比 <5%）很有用。**  
> 优化器永远根据每个值的实际选择性自动决定是否使用索引——不是你建了索引就一定用。

---

## 模块 2：进阶篇 —— 诊断和优化复杂查询

---

### 练习 2-1：深度分页（Deep Pagination）

**【问题 SQL】**
```sql
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 999980;
```

**【结果】**
```
Limit
  -> Index Scan using orders_pkey on orders
       actual rows=1000000    ← 扫描了全部 100 万行！
Execution Time: 732ms
```

**【得到什么】**
- 虽然用了主键索引，但 `actual rows=1000000`：扫描了全部 100 万行
- `LIMIT 20` 只取最后 20 行，但前 999,980 行必须逐个跳过

**【原因】**
`OFFSET N` 的语义是"跳过前 N 行"。数据库必须沿索引从头遍历，数到第 N 行才能开始返回结果。N 越大，代价越高——O(N) 复杂度，无法优化。

**【如何优化】**
**键集分页（Keyset Pagination）**：用上一页最后一行的 `id` 做条件，不用 OFFSET：
```sql
-- 把上一页最后一行的 id（如 1004495）传入
SELECT * FROM orders
WHERE id > 1004495
ORDER BY id
LIMIT 20;
```

对比：

**延迟关联（Deferred Join）**

```sql
SELECT o.* FROM orders o
JOIN (SELECT id FROM orders ORDER BY id LIMIT 20 OFFSET 999980) t
ON o.id = t.id;
```

**效果：** 虽然还是用了 `OFFSET`，但在括号里的子查询中，数据库只需要读取并丢弃极小的主键 `id` 字段，而不是读取一整行包含各种大文本的完整订单数据。等拿到那 20 个目标 `id` 后，再去主表里把完整数据拿出来。这能大幅度减少内存缓冲区的读写压力（即 `Buffers` 的消耗）。

**【优化结果】**

| 方案 | 扫描行数 | 读取页数 | 耗时 |
|------|---------|---------|------|
| 原始 OFFSET | 1,000,000 | 12,081 | 732ms |
| 延迟关联 | 1,000,000（Index Only）| 2,816 | 396ms |
| **键集分页** | **20** | **7** | **0.402ms** |

**【结论】**
> - 延迟关联：用 Index Only Scan 减少 IO，快 2 倍，但本质仍是 O(N)
> - 键集分页：直接跳到目标位置，O(1)，无论翻到第几页耗时恒定，**快 1800 倍**
> - 代价：不支持随机跳页，只能"上一页/下一页"

---

### 练习 2-2：JOIN 算法随结果集大小自动切换

**【问题 SQL】**
```sql
-- 大结果集：所有 paid 订单 JOIN 用户
SELECT o.id, u.name, o.amount
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status = 'paid';

-- 小结果集：单个用户的订单 JOIN
SELECT o.id, u.name, o.amount
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.user_id = 42000;
```

**【结果】**

| 查询 | 外层行数 | JOIN 算法 | 内存 | 耗时 |
|------|---------|---------|------|------|
| paid 订单 | 18,915 行 | **Hash Join** | 6,492KB | 267ms |
| 单用户 | **1 行** | **Nested Loop** | — | 1.357ms |

**【得到什么】**
- 相同的表结构，不同的过滤条件，优化器自动选择了不同的 JOIN 算法
- Hash Join：把 users（10 万行）build 成哈希表，orders 过滤结果 probe
- Nested Loop：先找到 1 个用户，再用索引找其所有订单

**【原因】**
优化器的决策逻辑：
```
外层结果集大 → 构建哈希表一次，批量 probe → Hash Join
外层结果集小 + 内层有索引 → 每外层行做一次索引查找 → Nested Loop
```

**【如何优化】**
保证 JOIN 关联列上有索引，让优化器在结果集小时能切换为 Nested Loop：
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
-- users.id 已是 PRIMARY KEY，自带索引
```

**【结论】**
> JOIN 算法不是你决定的，是优化器根据**结果集大小**和**索引是否存在**自动选的。  
> 你能做的是：给关联列建索引，让优化器有更多选择。



### 补充3：Join 算法

| **特性**     | **Nested Loop**                  | **Hash Join**                          | **Merge Join**                     |
| ------------ | -------------------------------- | -------------------------------------- | ---------------------------------- |
| **打个比方** | 拿着名单 A，去名单 B 里挨个查    | 把名单 A 存进手机通讯录，拿名单 B 匹配 | 两个名单都按姓名排好序，顺着往下对 |
| **数据量级** | **小数据量**（或右表有极快索引） | **大数据量**                           | **超大数据量**（或已有序）         |
| **内存依赖** | 低                               | **高**（需要放得下 Hash 表）           | 中（排序可能需要内存或磁盘）       |
| **条件限制** | 支持所有连接条件 (>, <, =)       | **仅支持等值连接 (=)**                 | **仅支持等值连接 (=)**             |
| **性能关键** | 右表关联字段是否有索引           | 内存 (`work_mem`) 是否够大             | 数据是否有序                       |



---

### 练习 2-3：ORDER BY 的索引利用与复合索引设计

**【问题 SQL】**
```sql
-- 有索引的列排序
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20;

-- 无索引的列排序
SELECT * FROM orders ORDER BY amount DESC LIMIT 20;

-- WHERE + ORDER BY 组合
SELECT * FROM orders
WHERE status = 'paid'
ORDER BY created_at DESC
LIMIT 20;
```

**【结果】**

| 查询 | 扫描方式 | Sort 节点 | 耗时 |
|------|---------|----------|------|
| `ORDER BY created_at DESC`（有索引）| Index Scan Backward | ❌ 无 | 2.8ms |
| `ORDER BY amount DESC`（无索引）| Parallel Seq Scan + Sort | ✅ 有（top-N heapsort）| 283ms |
| `WHERE status='paid' ORDER BY created_at DESC`（单列索引）| Index Scan Backward + Filter | ❌ 无（但扫 1163 行过滤）| 18.9ms |
| `WHERE status='paid' ORDER BY created_at DESC`（复合索引）| Index Scan（直接命中）| ❌ 无 | 0.494ms |

**【得到什么】**
- `created_at` 有索引 → `Index Scan Backward`，直接从末尾读 20 行，无排序
- `amount` 无索引 → 扫 100 万行 + `top-N heapsort` 维护 20 个槽找最大值
- 单列索引处理 `WHERE + ORDER BY` → 靠运气：扫索引边走边过滤，选择性差时退化
- 复合索引 `(status, created_at DESC)` → 直接跳到 paid 区间，按时间顺序读 20 行

**【原因】**
B-tree 索引是有序的：
- 排序方向与索引方向一致 → 顺序/逆序读索引，完全跳过 Sort 节点
- 无索引 → 必须扫全表，用 `top-N heapsort` 找 Top N（省内存但省不了扫描）
- 复合索引 `(等值列, 排序列)` → WHERE 用等值列定位，排序列已是目标顺序

**【如何优化】**
```sql
-- 修复 amount 排序慢
CREATE INDEX idx_orders_amount ON orders(amount DESC);

-- 修复 WHERE + ORDER BY 组合（等值列在前，排序列在后）
CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);
```

**【优化结果】**

| 方案 | 耗时 | 扫描行数 |
|------|------|---------|
| amount 无索引 | 283ms | 1,000,000 |
| amount 加索引后 | **0.387ms** | **20** |
| status + created_at 单列 | 18.9ms | 1,163（运气好）|
| `(status, created_at DESC)` 复合索引 | **0.494ms** | **20** |

**【结论】**

> 复合索引设计口诀：**等值条件列在前，排序列在后**。  
> `WHERE status='paid' ORDER BY created_at DESC` → 建 `(status, created_at DESC)`  
> 优化器能同时利用索引做过滤和排序，Sort 节点消失，只扫 20 行。

---

## 模块 3：Master 篇 —— 优化器、GIN、分区表

---

### 练习 3-1：统计信息过期导致计划走偏

**【问题 SQL】**
```sql
-- 建表 100 行 → ANALYZE → 插入 100 万行 → 不 ANALYZE → 查询
SELECT * FROM demo_stats WHERE category = 'rare';
```

**【结果】**

| 时间点 | 优化器估算 rows= | 实际行数 | 误差 |
|--------|----------------|---------|------|
| 100 行（ANALYZE 后）| 5 | 5 | 准确 |
| 插入 100 万行（未 ANALYZE）| **31,850** | **10,004** | **3 倍高估** |
| ANALYZE 后 | **10,167** | 10,004 | <2% |

**【得到什么】**
- 批量插入后未更新统计信息，优化器对行数的估算偏差达 3 倍
- `ANALYZE` 后估算立即恢复准确（误差 <2%）

**【原因】**
优化器依赖 `pg_statistic` 里的统计信息（直方图、不同值数量）估算行数。大批量插入后，统计信息仍是旧数据分布的采样，导致估算严重偏差。

单表扫描时 3 倍误差影响有限，但在多表 JOIN 场景下：
- 优化器以为中间结果是 3 万行 → 选 Hash Join（构建 3 万行哈希表）
- 实际只有 1 万行 → 本该选 Nested Loop（更快）

**【如何优化】**
```sql
-- 修复：刷新统计信息
ANALYZE demo_stats;

-- 生产环境诊断：找需要 ANALYZE 的表
SELECT tablename,
       last_analyze,
       n_mod_since_analyze   -- 上次 ANALYZE 后修改的行数
FROM pg_stat_user_tables
ORDER BY n_mod_since_analyze DESC
LIMIT 10;
```

**【结论】**
> 遇到"EXPLAIN ANALYZE 里 rows= 估算和 actual rows= 相差 10 倍以上"，第一步就是 `ANALYZE 表名`。  
> 大批量数据导入后务必手动 `ANALYZE`，不要依赖 auto-analyze 的延迟触发。

---

### 练习 3-2：GIN 倒排索引 —— JSONB 查询

**【问题 SQL】**
```sql
-- events 表 50 万行，data 是 JSONB 字段
SELECT * FROM events
WHERE data @> '{"type": "purchase", "tag": "vip"}';
```

**【结果（无 GIN 索引）】**
```
Seq Scan on events
  Filter: (data @> '{"tag": "vip", "type": "purchase"}')
  Rows Removed by Filter: 468856
Execution Time: 336ms
```

**【得到什么】**
- B-tree 索引对 `@>`（JSONB 包含）运算符完全无效
- 扫描 50 万行，丢弃 46 万行，只返回 3 万行

**【原因】**
B-tree 要求键值可排序。JSONB 是嵌套结构，没有单一排序值——数据库无法用 B-tree 判断"哪些行的 JSON 包含某个 key-value 对"。

GIN（倒排索引）的工作方式：
```
索引内容：
  "type=purchase" → [row 3, row 7, row 12, ...]
  "tag=vip"       → [row 7, row 15, row 89, ...]

查询时：取两个列表的交集
```

**【如何优化】**
```sql
CREATE INDEX idx_events_data_gin ON events USING GIN(data);
```

**【优化结果】**
```
Bitmap Heap Scan on events
  -> Bitmap Index Scan on idx_events_data_gin
       Index Cond: (data @> '{"tag": "vip", "type": "purchase"}')
Execution Time: 136ms
```

耗时 **336ms → 136ms，提升 2.5 倍**。

**【结论】**
> JSONB 的 `@>`、`?`、`?|` 等操作符必须用 GIN 索引，B-tree 无效。  
>
> ⚠️ **GIN 的致命陷阱**：每次 INSERT 都要更新倒排索引里的每个 key-value 条目，写入代价极高。  
> 高写入表（日志流、埋点事件）加 GIN 会让写入吞吐崩溃。  
> 决策原则：**先用 EXPLAIN 证明查询是瓶颈，再评估读写比，再决定加不加 GIN**。

---

### 练习 3-3：分区表裁剪 —— 分区键必须在 WHERE 里

**【问题 SQL】**
```sql
-- orders_part：按季度 RANGE 分区（共 7 个分区）

-- 查询 A：分区键 created_at 在 WHERE 里
EXPLAIN SELECT * FROM orders_part
WHERE created_at BETWEEN '2025-01-01' AND '2025-03-31';

-- 查询 B：分区键不在 WHERE 里
EXPLAIN SELECT * FROM orders_part
WHERE user_id = 42000;
```

**【结果】**

查询 A（分区键在 WHERE）：
```
Seq Scan on orders_part_2025_q1    ← 只扫 1 个分区
```

查询 B（分区键不在 WHERE）：
```
Parallel Append
  -> Parallel Seq Scan on orders_part_2026_q2
  -> Parallel Seq Scan on orders_part_2026_q1
  -> Parallel Seq Scan on orders_part_2025_q4
  -> Parallel Seq Scan on orders_part_2025_q3
  -> Parallel Seq Scan on orders_part_2025_q2
  -> Parallel Seq Scan on orders_part_2025_q1
  -> Parallel Seq Scan on orders_part_2024_q4  ← 扫全部 7 个分区
```

**【得到什么】**
- 查询 A：**分区裁剪（Partition Pruning）**生效，只扫 1 个分区
- 查询 B：7 个分区全扫，比不分区还慢（多了子表元数据开销）

**【原因】**
分区表按 `created_at` 分区。查询 A 的 WHERE 包含 `created_at` 范围，数据库直接定位到 `2025-q1` 分区。查询 B 的 WHERE 是 `user_id`，数据库不知道 `user_id=42000` 的数据在哪个季度，只能扫所有分区。

**【运维陷阱（本次实验实际遇到）】**
插入数据时报错：
```
ERROR: no partition of relation "orders_part" found for row
DETAIL: Partition key of the failing row contains (created_at) = (2026-04-29...)
```
原因：分区定义只到 `2025-07-01`，2026 年的数据无处安放。**分区表必须提前创建覆盖所有数据的分区**，否则插入直接报错——这是生产环境最常见的分区运维坑。

**【结论】**
> **分区表只对分区键出现在 WHERE 里的查询有效。**  
> 设计分区键前要问：业务最高频的查询条件是什么？  
>
> - 时序数据按时间分区 → 查询必须带时间范围条件  
> - 主要按 `user_id` 查询的系统按时间分区 → 分区对这类查询毫无帮助  
> - 小表（<百万行）分区 → 元数据开销反而更慢，不要分区

---

## 速查卡：遇到慢查询的诊断步骤

```
1. EXPLAIN (ANALYZE, BUFFERS) <慢 SQL>

2. 看扫描方式
   Seq Scan + 行数很多    → 检查 WHERE 列是否有索引
   Index Scan + rows 估算偏差大 → ANALYZE 表名
   Sort 节点             → ORDER BY 列是否有索引

3. 看 actual rows vs rows
   差距 > 10 倍          → ANALYZE 表名，刷新统计信息

4. 看 Heap Fetches / Heap Blocks
   数字很大             → 考虑覆盖索引（INCLUDE 或复合索引）

5. 看 loops
   loops 很大（Nested Loop 内层）→ 检查内层表 JOIN 列是否有索引

6. 都优化了还是慢？
   → 检查锁等待：SELECT * FROM pg_stat_activity WHERE state='active'
   → 检查是否是架构问题（缓存、连接池、读写分离）
```

