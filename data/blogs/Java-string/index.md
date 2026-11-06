# Java 基础：String、StringBuilder、StringBuffer

## 一、这三个类是什么？

`String`、`StringBuilder`、`StringBuffer` 都是 Java 中用于处理字符串的类。

它们最主要的区别是：**字符串是否可变，以及是否提供线程同步保护。**

| 类 | 是否可变 | 线程安全性 | 主要用途 |
|---|---|---|---|
| `String` | 不可变 | 不可变内容可以安全共享 | 普通字符串处理 |
| `StringBuilder` | 可变 | 不保证线程安全 | 高效拼接字符串 |
| `StringBuffer` | 可变 | 主要方法提供同步保护 | 多线程共享可变字符串 |

**一句话记忆：**

> String 不可变，StringBuilder 可变且通常更快，StringBuffer 可变且带同步。

---

## 二、为什么 Java 需要这三个类？

### 1. 最开始的问题：String 不可变

假设需要拼接字符串：

```java
String s = "Hello";

s = s + " World";
s = s + " Java";

System.out.println(s);
// Hello World Java
```

表面上看，字符串 `s` 被不断修改。

但实际上，**Java 的 String 对象一旦创建，其内容就不能改变。**

可以这样理解：

```text
String s = "Hello";

       ↓

s = s + " World";

原字符串："Hello"
新字符串："Hello World"

       ↓

s = s + " Java";

原字符串："Hello World"
新字符串："Hello World Java"
```

每次运行时拼接，通常会产生新的字符串对象。

注意：编译器可能优化字符串拼接，特别是编译期常量拼接，因此并非所有 `+` 操作都会产生新的运行时对象。

### 2. String 带来的问题

如果只拼接几次，通常没有明显问题。

但如果需要拼接 10000 次：

```java
String s = "";

for (int i = 0; i < 10000; i++) {
    s = s + i;
}
```

就可能产生大量临时字符串对象，并反复复制已有内容。

**问题：**

- 产生额外的内存分配。
- 增加垃圾回收压力。
- 大量重复拼接可能导致较差的执行效率。

于是 Java 提供了可变字符串类：`StringBuilder` 和 `StringBuffer`。

---

## 三、StringBuilder：解决高频字符串拼接问题

### 1. 核心思想

**不再反复生成新的 String，而是在同一个可变字符序列对象中修改内容。**

```java
StringBuilder sb = new StringBuilder("Hello");

sb.append(" World");
sb.append(" Java");

System.out.println(sb.toString());

// Hello World Java
```

执行过程：

```text
创建 StringBuilder 对象
          ↓
       "Hello"
          ↓
append(" World")
          ↓
     "Hello World"
          ↓
append(" Java")
          ↓
   "Hello World Java"
```

`StringBuilder` 可以重复利用内部缓冲区。

当容量不足时，仍然可能分配新的内部数组。

### 2. 常见方法

| 方法 | 作用 | 示例 |
|---|---|---|
| `append()` | 末尾追加内容 | `sb.append("abc")` |
| `insert()` | 指定位置插入 | `sb.insert(1, "X")` |
| `delete()` | 删除指定范围 | `sb.delete(1, 3)` |
| `replace()` | 替换指定范围 | `sb.replace(0, 2, "Hi")` |
| `reverse()` | 反转字符序列 | `sb.reverse()` |
| `length()` | 获取当前长度 | `sb.length()` |
| `capacity()` | 获取缓冲区容量 | `sb.capacity()` |
| `toString()` | 转换为 String | `sb.toString()` |

### 3. 实际代码

```java
StringBuilder sb = new StringBuilder("Hello");

// 追加
sb.append(" World");
// Hello World

// 插入
sb.insert(5, ",");
// Hello, World

// 删除
sb.delete(5, 6);
// Hello World

// 反转
sb.reverse();
// dlroW olleH

System.out.println(sb.toString());
```

### 4. 适用场景

- 循环拼接字符串。
- 生成动态 SQL。
- 构建日志内容。
- 处理大量文本。
- 算法题中的字符串操作。

**结论：单线程环境下需要频繁修改字符串时，通常优先使用 StringBuilder。**

---

## 四、StringBuffer：为什么还需要一个可变字符串类？

### 1. StringBuilder 的问题

`StringBuilder` 不保证线程安全。

假设两个线程同时修改同一个对象：

```text
线程 A ── append("Hello") ──┐
                            ├── 共享 StringBuilder
线程 B ── append("World") ──┘
```

如果多个线程同时修改同一对象，可能产生数据竞争。

### 2. StringBuffer 的解决方式

`StringBuffer` 的主要方法通过 `synchronized` 提供同步保护。

```java
StringBuffer sb = new StringBuffer("Hello");

sb.append(" World");
sb.append(" Java");

System.out.println(sb.toString());

// Hello World Java
```

用法几乎与 `StringBuilder` 相同。

核心区别：

```text
StringBuilder
    ↓
不提供内置同步保护
    ↓
通常开销较低

StringBuffer
    ↓
主要方法使用 synchronized
    ↓
提供单次操作的同步保护
    ↓
可能存在额外同步开销
```

需要注意：

`StringBuffer` 的单个同步方法具有线程安全保护，但多个方法组成的复合操作，不一定具有整体原子性。

例如：

```java
if (sb.length() > 0) {
    sb.deleteCharAt(0);
}
```

即使 `sb` 是 `StringBuffer`，两个操作之间仍可能被其他线程修改。

---

## 五、String、StringBuilder、StringBuffer 的本质区别

### 1. 是否可变

**String：不可变**

```java
String a = "Hello";
String b = a;

a = a + " World";

System.out.println(a); // Hello World
System.out.println(b); // Hello
```

原理：

```text
开始：

a ──┐
    ├──→ "Hello"
b ──┘

执行 a = a + " World" 后：

a ─────→ "Hello World"

b ─────→ "Hello"
```

`a` 被重新赋值，并不是原来的 `"Hello"` 被修改。

**StringBuilder：可变**

```java
StringBuilder a = new StringBuilder("Hello");
StringBuilder b = a;

a.append(" World");

System.out.println(a); // Hello World
System.out.println(b); // Hello World
```

原理：

```text
开始：

a ──┐
    ├──→ StringBuilder("Hello")
b ──┘

执行 append() 后：

a ──┐
    ├──→ StringBuilder("Hello World")
b ──┘
```

因为 `a` 和 `b` 指向同一个可变对象，所以两者都能观察到修改后的内容。

### 2. 性能比较

| 场景 | String | StringBuilder | StringBuffer |
|---|---|---|---|
| 普通字符串保存 | 推荐 | 不必要 | 不必要 |
| 少量字符串拼接 | 推荐 | 可以 | 可以 |
| 循环大量拼接 | 通常不推荐 | 推荐 | 可以 |
| 单线程高频修改 | 效率可能较低 | 通常最快 | 有同步开销 |
| 多线程共享修改 | 内容不可变 | 需要额外同步 | 主要操作同步 |

注意：现代 Java 编译器会优化部分字符串拼接，实际性能不能仅凭类名判断。

---

## 六、实际开发应该怎么选择？

### 场景一：保存用户名

```java
String username = "Alice";
```

**选择 String。**

原因：普通字符串不需要反复修改。

### 场景二：循环拼接 10000 个数字

```java
StringBuilder sb = new StringBuilder();

for (int i = 0; i < 10000; i++) {
    sb.append(i);
}

String result = sb.toString();
```

**选择 StringBuilder。**

原因：反复追加内容时，通常能够减少临时对象与复制开销。

### 场景三：多个线程共享一个可变字符串对象

```java
StringBuffer sb = new StringBuffer();

sb.append("Hello");
sb.append(" World");
```

**可以考虑 StringBuffer。**

原因：其主要修改方法具有同步保护。

但在实际项目中，也可以通过锁、线程局部对象等方式保证线程安全，并不一定要使用 `StringBuffer`。

---

## 七、面试常见问题

### Q1：String 为什么不可变？

因为 Java 将 `String` 设计为不可变类。

这样有几个好处：

1. 便于安全地共享字符串内容。
2. 可以实现字符串常量池。
3. 可以缓存字符串的哈希值。
4. 作为 HashMap 的 Key 时，其内容不会在插入后被修改。

### Q2：StringBuilder 为什么通常比 String 拼接快？

因为 `StringBuilder` 可以复用内部缓冲区，避免循环拼接时反复创建中间 String 对象。

### Q3：StringBuilder 和 StringBuffer 最大的区别是什么？

是否提供内置同步保护。

- `StringBuilder`：不保证线程安全。
- `StringBuffer`：主要方法使用同步机制。

### Q4：StringBuffer 一定比 StringBuilder 慢吗？

不一定。

`StringBuffer` 存在同步开销，但实际性能还会受到 JVM 优化、线程竞争程度及具体使用方式的影响。

### Q5：下面代码输出什么？

```java
String a = "Hello";
String b = a;

a = a + " World";

System.out.println(a);
System.out.println(b);
```

答案：

```text
Hello World
Hello
```

原因：`String` 不可变，`a` 被重新赋值后，`b` 仍指向原字符串。

### Q6：下面代码又输出什么？

```java
StringBuilder a = new StringBuilder("Hello");
StringBuilder b = a;

a.append(" World");

System.out.println(a);
System.out.println(b);
```

答案：

```text
Hello World
Hello World
```

原因：`a` 和 `b` 指向同一个可变对象。

---

## 八、快速复习

### 核心对比

| 对比维度 | String | StringBuilder | StringBuffer |
|---|---|---|---|
| 可变性 | 不可变 | 可变 | 可变 |
| 线程同步 | 不需要修改内容 | 不提供 | 主要方法提供 |
| 高频拼接 | 通常不合适 | 推荐 | 可以 |
| 典型用途 | 普通文本 | 高效构建字符串 | 共享可变文本并同步操作 |

### 记忆口诀

> **String：不可变。**
>
> **StringBuilder：可变，通常快。**
>
> **StringBuffer：可变，有同步。**

### 复习检查清单

- [ ] 理解 String 为什么不可变
- [ ] 理解 String 拼接为什么可能产生新对象
- [ ] 知道 StringBuilder 解决什么问题
- [ ] 掌握 `append()`、`insert()`、`delete()`、`reverse()`
- [ ] 理解 StringBuffer 的线程同步机制
- [ ] 知道三者在不同场景下如何选择
- [ ] 理解 String 和 StringBuilder 引用行为的区别

---

## 最终总结

这三个类的出现，可以理解为 Java 针对不同字符串处理需求提供的三种选择：

```text
需要存储普通字符串
         ↓
       String

需要频繁修改字符串
         ↓
    StringBuilder

需要多个线程共享修改，
并希望单次操作有同步保护
         ↓
    StringBuffer
```

**核心知识点：不可变性、可变缓冲区、线程同步、性能权衡。**