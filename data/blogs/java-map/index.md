# Java 基础：Map、HashMap 与 Hash 的关系

## 一、什么是 Map？

**Map（映射）是一种用于存储 Key-Value（键值对）关系的数据结构。**

可以简单理解为：

> 给我一个 Key（键），就可以找到它对应的 Value（值）。

例如，存储学生成绩：

| Key（键） | Value（值） |
|---|---|
| Alice | 90 |
| Bob | 85 |
| Charlie | 95 |

映射关系：

```text
Alice   → 90
Bob     → 85
Charlie → 95
```

用数学形式表示：

\[
f(\text{Key})=\text{Value}
\]

**核心思想：通过 Key 获取对应的 Value。**

需要注意，在 Java 的 `Map` 中：

- Key 不能重复。
- Value 可以重复。
- 一个 Key 最多对应一个 Value。
- 如果使用相同的 Key 再次添加数据，通常会覆盖原来的 Value。

---

## 二、为什么需要 Map？

### 1. 传统方式：通过遍历查找数据

假设有大量学生信息：

```text
Alice   90
Bob     85
Charlie 95
David   88
```

现在需要查找 Bob 的成绩。

一种传统实现是遍历数组：

```java
String[] names = {"Alice", "Bob", "Charlie"};
int[] scores = {90, 85, 95};

for (int i = 0; i < names.length; i++) {
    if (names[i].equals("Bob")) {
        System.out.println(scores[i]);
        break;
    }
}
```

这种方法的时间复杂度为：

\[
O(n)
\]

数据越多，查找可能越慢。

### 2. Map 的解决思路

Map 将 Key 和 Value 建立对应关系。

```java
Map<String, Integer> student = new HashMap<>();

student.put("Alice", 90);
student.put("Bob", 85);
student.put("Charlie", 95);

System.out.println(student.get("Bob"));

// 85
```

使用者只需要提供 Key，不需要自己编写遍历过程。

**注意：Map 是接口，查找效率由具体实现决定，并不是所有 Map 都能实现平均 O(1) 查找。**

---

## 三、Map 和 Hash 是什么关系？

这是最重要的知识点。

**Map 定义数据应该如何组织和访问，而 Hash 是一种可以帮助快速查找数据的技术。**

可以简单理解为：

```text
Map
 │
 │ 定义 Key → Value 关系
 │
 ├── HashMap
 │      │
 │      └── 使用哈希表实现
 │
 ├── TreeMap
 │      │
 │      └── 使用红黑树实现
 │
 └── LinkedHashMap
        │
        └── 使用哈希表并维护迭代顺序
```

### 核心区别

| 概念 | 本质 | 作用 |
|---|---|---|
| Map | 接口 / 键值映射抽象 | 定义 Key-Value 操作 |
| Hash | 哈希算法思想 | 将 Key 映射为哈希值 |
| HashMap | Map 的实现类 | 利用哈希表管理键值对 |
| TreeMap | Map 的实现类 | 利用有序树管理键值对 |

**一句话记忆：**

> Map 解决“要存储什么关系”，HashMap 解决“如何高效实现这种关系”。

---

## 四、HashMap 的工作原理

### 1. HashMap = Hash + Map

```text
HashMap
   │
   ├── Map：管理 Key → Value
   │
   └── Hash：帮助快速定位 Key
```

例如：

```java
Map<String, Integer> student = new HashMap<>();

student.put("Bob", 85);
```

概念上的存储过程：

```text
Key = "Bob"
      ↓
计算 Hash("Bob")
      ↓
根据哈希值计算桶的位置
      ↓
存储 Key-Value
      ↓
("Bob", 85)
```

查找：

```java
student.get("Bob");
```

内部过程可以简化为：

```text
输入 Key = "Bob"
        ↓
计算 Key 的 hashCode()
        ↓
计算哈希桶位置
        ↓
找到对应的桶
        ↓
比较 Key
        ↓
返回 Value = 85
```

注意：Java 的 `HashMap` 不仅使用哈希值，还会通过 `equals()` 判断 Key 是否真正相等。

### 2. 为什么 HashMap 查找快？

因为它不需要每次都遍历所有 Key。

在哈希分布合理、冲突较少的情况下，可以快速定位目标数据。

平均时间复杂度：

\[
O(1)
\]

但如果发生大量哈希冲突，查找成本可能增加。

---

## 五、什么是哈希冲突？

**哈希冲突（Hash Collision）指不同的 Key 得到了相同的哈希值或映射到了相同的桶位置。**

假设设计一个简单的哈希函数：

```java
int hash(int key) {
    return key % 5;
}
```

计算结果：

```text
7  % 5 = 2
12 % 5 = 2
17 % 5 = 2
```

三个不同的 Key 都被映射到了位置 2。

```text
Key 7  ──┐
         │
Key 12 ──┼──→ 桶 2
         │
Key 17 ──┘
```

这就是哈希冲突。

### 如何解决？

常见方法有两种。

**1. 链地址法（Separate Chaining）**

同一个桶可以容纳多个节点：

```text
桶 0 → null
桶 1 → null
桶 2 → [7] → [12] → [17]
桶 3 → null
桶 4 → null
```

Java 的 `HashMap` 采用了类似的桶内节点结构。在 Java 8 及之后的常见实现中，当满足一定条件时，桶内链表还可能转换为红黑树。

**2. 开放寻址法（Open Addressing）**

如果目标位置已经被占用，就按照一定规则寻找其他位置。

```text
7  → 位置 2

12 → 位置 2 已占用
   → 位置 3

17 → 位置 2 已占用
   → 位置 3 已占用
   → 位置 4
```

这里展示的是线性探测法。

注意：Java 标准库中的 `HashMap` 并不使用这种开放寻址实现。

---

## 六、Java 中常见的 Map 类型

### 1. HashMap

基于哈希表实现。

```java
Map<String, Integer> map = new HashMap<>();

map.put("Alice", 90);
map.put("Bob", 85);
```

特点：

- 查找、插入、删除平均 O(1)。
- 不保证迭代顺序。
- 允许一个 `null` Key。
- 允许多个 `null` Value。
- 本身不保证线程安全。

**适合：普通的键值存储和快速查找。**

### 2. TreeMap

基于红黑树实现。

```java
Map<Integer, String> map = new TreeMap<>();

map.put(3, "Charlie");
map.put(1, "Alice");
map.put(2, "Bob");
```

遍历结果按 Key 升序排列：

```text
1 = Alice
2 = Bob
3 = Charlie
```

特点：

- 按 Key 排序。
- 查找、插入、删除通常为 O(log n)。
- 支持范围查询。
- 可以使用自定义比较器。

**适合：需要排序或者范围查询的数据。**

### 3. LinkedHashMap

基于哈希表，并维护元素的迭代顺序。

```java
Map<String, Integer> map = new LinkedHashMap<>();

map.put("Charlie", 95);
map.put("Alice", 90);
map.put("Bob", 85);
```

默认情况下按插入顺序遍历：

```text
Charlie = 95
Alice = 90
Bob = 85
```

特点：

- 默认保持插入顺序。
- 可以配置为按访问顺序排列。
- 查找通常为平均 O(1)。
- 常用于实现 LRU 缓存。

**适合：既想快速查找，又希望保留特定迭代顺序。**

### 三种实现对比

| 对比 | HashMap | TreeMap | LinkedHashMap |
|---|---|---|---|
| 底层结构 | 哈希表 | 红黑树 | 哈希表 + 双向链表 |
| 查找复杂度 | 平均 O(1) | O(log n) | 平均 O(1) |
| 是否排序 | 不保证 | 按 Key 排序 | 默认按插入顺序 |
| 是否允许 null Key | 允许一个 | 自然排序下通常不允许 | 允许一个 |
| 是否线程安全 | 否 | 否 | 否 |

---

## 七、Map 的常见操作

```java
import java.util.HashMap;
import java.util.Map;

public class Main {
    public static void main(String[] args) {

        Map<String, Integer> map = new HashMap<>();

        // 添加
        map.put("Alice", 90);
        map.put("Bob", 85);

        // 查找
        System.out.println(map.get("Bob")); // 85

        // 判断 Key 是否存在
        System.out.println(map.containsKey("Alice")); // true

        // 更新
        map.put("Bob", 95);

        // 删除
        map.remove("Alice");

        // 获取元素数量
        System.out.println(map.size()); // 1

        // 清空
        map.clear();
    }
}
```

### 常见方法总结

| 方法 | 作用 |
|---|---|
| `put(key, value)` | 添加或更新键值对 |
| `get(key)` | 根据 Key 获取 Value |
| `remove(key)` | 删除键值对 |
| `containsKey(key)` | 判断是否存在 Key |
| `containsValue(value)` | 判断是否存在 Value |
| `size()` | 获取键值对数量 |
| `isEmpty()` | 判断是否为空 |
| `clear()` | 清空 Map |
| `keySet()` | 获取所有 Key 的集合视图 |
| `values()` | 获取所有 Value 的集合视图 |
| `entrySet()` | 获取所有键值对的集合视图 |
| `getOrDefault(key, defaultValue)` | Key 不存在时返回默认值 |

### 如何遍历 Map？

推荐使用 `entrySet()`：

```java
for (Map.Entry<String, Integer> entry : map.entrySet()) {

    String key = entry.getKey();
    Integer value = entry.getValue();

    System.out.println(key + ": " + value);
}
```

也可以使用：

```java
map.forEach((key, value) -> {
    System.out.println(key + ": " + value);
});
```

---

## 八、Map 和 Python dict 的关系

如果你学过 Python，可以直接这样理解：

**Java 的 HashMap 与 Python 的 dict 在使用概念上非常相似。**

Python：

```python
student = {
    "Alice": 90,
    "Bob": 85
}

print(student["Bob"])
# 85
```

Java：

```java
Map<String, Integer> student = new HashMap<>();

student.put("Alice", 90);
student.put("Bob", 85);

System.out.println(student.get("Bob"));
// 85
```

需要注意，两者的具体实现和顺序保证不同。

例如，现代 Python 的 `dict` 保持插入顺序，而 Java 的 `HashMap` 不保证顺序。

---

## 九、容易混淆的 map：函数式编程中的 map()

除了 Map 数据结构，还有一种常见的 `map` 操作。

例如 Python：

```python
numbers = [1, 2, 3]

result = list(map(lambda x: x * 2, numbers))

print(result)
# [2, 4, 6]
```

这里的 `map()` 是将一个函数应用到一组元素上。

Java Stream 中也有类似操作：

```java
List<Integer> numbers = List.of(1, 2, 3);

List<Integer> result = numbers.stream()
        .map(x -> x * 2)
        .toList();

System.out.println(result);
// [2, 4, 6]
```

二者区别：

| 概念 | 含义 |
|---|---|
| Map 数据结构 | 存储 Key-Value |
| `map()` 函数 | 对集合中的元素执行映射转换 |

虽然都叫 Map，但使用场景不同。

---

## 十、面试常见问题

### Q1：Map 和 HashMap 有什么区别？

`Map` 是接口，`HashMap` 是实现类。

```java
Map<String, Integer> map = new HashMap<>();
```

推荐使用接口类型声明变量，便于以后更换实现。

### Q2：HashMap 为什么查找通常是 O(1)？

因为通过 Key 的哈希值，可以快速计算桶位置，减少查找范围。

### Q3：HashMap 的 Key 能重复吗？

不能。

相同 Key 再次调用 `put()`，会替换对应的 Value。

```java
map.put("Alice", 90);
map.put("Alice", 95);

// Alice 对应的值变成 95
```

### Q4：HashMap 中为什么经常使用 String 作为 Key？

因为 `String` 不可变，并且正确实现了 `hashCode()` 和 `equals()`。

这样可以避免 Key 内容被修改后导致查找异常。

### Q5：HashMap 和 TreeMap 应该选择哪个？

- 需要平均 O(1) 快速查找：`HashMap`。
- 需要按 Key 排序或范围查询：`TreeMap`。
- 需要维护插入或访问顺序：`LinkedHashMap`。

### Q6：HashMap 是线程安全的吗？

不是。

多个线程需要同时修改同一个 Map 时，可以考虑 `ConcurrentHashMap` 或适当的同步机制。

---

## 十一、快速复习

### 1. 三个核心概念

```text
Map
 │
 └── 定义 Key → Value 的关系

Hash
 │
 └── 根据 Key 计算哈希值

HashMap
 │
 └── 利用哈希表实现 Map
```

### 2. 复杂度记忆

\[
\text{HashMap 平均查找：}O(1)
\]

\[
\text{TreeMap 查找：}O(\log n)
\]

\[
\text{普通顺序查找：}O(n)
\]

### 3. 复习检查清单

- [ ] 理解 Map 是什么
- [ ] 理解 Key-Value 映射关系
- [ ] 理解 Map 与 Hash 的区别
- [ ] 理解 HashMap 的基本工作原理
- [ ] 知道哈希冲突为什么会出现
- [ ] 掌握 `put()`、`get()`、`remove()`
- [ ] 掌握 Map 的遍历方式
- [ ] 区分 HashMap、TreeMap、LinkedHashMap
- [ ] 理解 Map 数据结构与 `map()` 函数的区别

---

## 最终总结

**Map 负责建立 Key 和 Value 之间的关系，而 HashMap 使用哈希表来实现这种关系。**

```text
               Map
                │
        Key → Value
                │
       选择具体实现方式
                │
        ┌───────┴────────┐
        │                │
     HashMap          TreeMap
        │                │
      哈希表            红黑树
        │                │
   平均 O(1)         O(log n)
        │                │
     快速查找          有序查找
```

**最终记忆：**

> **Map 是接口，Hash 是映射计算技术，HashMap 是利用哈希表实现 Map 的类。**

核心关键词：**Key-Value、Hash、HashMap、哈希冲突、O(1)。**