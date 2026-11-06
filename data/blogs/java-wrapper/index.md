# Java 基础：包装类（Wrapper Class）

## 一、什么是包装类？

**包装类（Wrapper Class）就是 Java 为基本数据类型提供的对应对象类型。**

例如：

```java
int a = 10;       // 基本数据类型
Integer b = 10;   // 包装类
```

可以简单理解为：

> 包装类就是把基本数据类型转换成对象类型，使其能够参与需要对象的操作。

Java 中存在两大类数据类型：

```text
Java 数据类型
    │
    ├── 基本数据类型（Primitive Type）
    │      │
    │      ├── int
    │      ├── double
    │      ├── boolean
    │      └── ...
    │
    └── 引用数据类型（Reference Type）
           │
           ├── String
           ├── Integer
           ├── Double
           ├── Boolean
           └── ...
```

需要注意：

- `int` 是基本类型。
- `Integer` 是引用类型。
- `Integer` 是 `int` 对应的包装类。
- `String` 是引用类型，但不是包装类。

---

## 二、为什么 Java 需要包装类？

### 1. 问题背景

假设需要使用 `ArrayList` 存储多个整数：

```java
ArrayList<int> numbers = new ArrayList<>();
```

这段代码会编译失败。

原因：

**Java 泛型的类型参数必须是引用类型，不能直接使用基本数据类型。**

因此，需要使用 `int` 对应的包装类 `Integer`：

```java
ArrayList<Integer> numbers = new ArrayList<>();

numbers.add(10);
numbers.add(20);
numbers.add(30);
```

这里：

```text
int
 │
 │ 包装
 ↓
Integer
 │
 │ 可以用于泛型
 ↓
ArrayList<Integer>
```

### 2. 包装类解决的核心问题

基本数据类型：

```java
int a = 10;
```

适合直接表示数值，但不能作为 Java 泛型的类型参数。

包装类：

```java
Integer a = 10;
```

可以作为对象参与集合、泛型等操作。

**核心思想：让基本类型的值能够以对象的形式使用。**

---

## 三、Java 的八种基本类型与包装类

Java 一共有八种基本数据类型，每种都有对应的包装类。

| 基本数据类型 | 包装类 | 示例 |
|---|---|---|
| `byte` | `Byte` | `Byte a = 10;` |
| `short` | `Short` | `Short a = 10;` |
| `int` | `Integer` | `Integer a = 10;` |
| `long` | `Long` | `Long a = 10L;` |
| `float` | `Float` | `Float a = 1.5f;` |
| `double` | `Double` | `Double a = 1.5;` |
| `char` | `Character` | `Character a = 'A';` |
| `boolean` | `Boolean` | `Boolean a = true;` |

### 记忆重点

大多数包装类都是基本类型名称首字母大写。

但有两个特殊情况：

```text
int  → Integer
char → Character
```

---

## 四、装箱（Boxing）是什么？

**装箱就是将基本数据类型的值转换为对应的包装类对象。**

### 1. 手动装箱

```java
int a = 10;

Integer b = Integer.valueOf(a);
```

过程：

```text
基本类型
 int a = 10
      │
      │ 装箱
      ↓
包装类
 Integer b
```

### 2. 自动装箱（Autoboxing）

Java 支持自动装箱：

```java
int a = 10;

Integer b = a;
```

编译器会自动完成对应转换。

概念上相当于：

```java
Integer b = Integer.valueOf(a);
```

**记忆：装箱 = 基本类型 → 包装类。**

---

## 五、拆箱（Unboxing）是什么？

**拆箱就是从包装类对象中获取对应的基本数据类型的值。**

### 1. 手动拆箱

```java
Integer a = 10;

int b = a.intValue();
```

过程：

```text
包装类
Integer a
     │
     │ 拆箱
     ↓
基本类型
 int b = 10
```

### 2. 自动拆箱（Auto-unboxing）

```java
Integer a = 10;

int b = a;
```

编译器会自动完成转换。

概念上相当于：

```java
int b = a.intValue();
```

**记忆：拆箱 = 包装类 → 基本类型。**

### 3. 装箱与拆箱总结

```text
               装箱
       ┌────────────────→┐
       │                 │
      int              Integer
       │                 │
       └←────────────────┘
               拆箱
```

| 操作 | 方向 | 示例 |
|---|---|---|
| 装箱 | `int → Integer` | `Integer a = 10;` |
| 拆箱 | `Integer → int` | `int b = a;` |

---

## 六、包装类有哪些实际作用？

### 1. 可以用于集合和泛型

例如：

```java
List<Integer> numbers = new ArrayList<>();

numbers.add(10);
numbers.add(20);
```

或者使用 `Map`：

```java
Map<String, Integer> scores = new HashMap<>();

scores.put("Alice", 90);
scores.put("Bob", 85);
```

这里的 `Integer` 是包装类。

### 2. 可以表示 null

基本类型不能为 `null`：

```java
int a = null; // 编译错误
```

包装类可以为 `null`：

```java
Integer a = null;
```

这在数据库开发中非常常见。

例如：

```text
学生成绩
    │
    ├── 90    → 已录入成绩
    ├── 0     → 成绩确实为 0
    └── null  → 尚未录入成绩
```

通过 `Integer`，就可以区分 `0` 和 `null`。

### 3. 提供实用方法

包装类不仅能保存值，还提供许多静态方法和常量。

**字符串转整数：**

```java
String s = "123";

int a = Integer.parseInt(s);

System.out.println(a); // 123
```

**整数转字符串：**

```java
int a = 123;

String s = Integer.toString(a);

System.out.println(s); // "123"
```

**获取整数最大值：**

```java
int max = Integer.MAX_VALUE;

System.out.println(max);
// 2147483647
```

**获取整数最小值：**

```java
int min = Integer.MIN_VALUE;

System.out.println(min);
// -2147483648
```

---

## 七、基本类型和包装类有什么区别？

| 对比 | 基本类型 int | 包装类 Integer |
|---|---|---|
| 类型 | 基本数据类型 | 引用数据类型 |
| 是否为对象 | 否 | 是 |
| 是否允许 null | 否 | 是 |
| 能否作为泛型参数 | 否 | 是 |
| 是否提供对象方法 | 否 | 是 |
| 性能与内存 | 通常更轻量 | 可能有额外对象开销 |
| 示例 | `int a = 10;` | `Integer a = 10;` |

### 如何选择？

**优先使用基本类型的场景：**

- 数学计算
- 循环计数
- 大量数值运算
- 不需要表示 `null`

```java
int sum = 0;

for (int i = 0; i < 100; i++) {
    sum += i;
}
```

**优先使用包装类的场景：**

- 集合和泛型
- 需要表示 `null`
- 需要引用类型的 API
- 某些数据库字段映射

```java
List<Integer> numbers = new ArrayList<>();
```

---

## 八、包装类容易踩的两个坑

### 1. null 自动拆箱导致异常

观察下面的代码：

```java
Integer a = null;

int b = a;
```

运行时会抛出：

```text
NullPointerException
```

原因是自动拆箱相当于：

```java
int b = a.intValue();
```

而 `a` 是 `null`，无法调用实例方法。

**解决方法：**

```java
Integer a = null;

int b = (a == null) ? 0 : a;
```

### 2. == 和 equals() 的区别

观察：

```java
Integer a = 1000;
Integer b = 1000;

System.out.println(a == b);
System.out.println(a.equals(b));
```

输出：

```text
false
true
```

原因：

- `==`：当两边都是包装类引用时，比较是否为同一个对象。
- `equals()`：比较所表示的值是否相等。

### Integer 缓存机制

Java 对部分整数包装对象进行了缓存。

例如：

```java
Integer a = 100;
Integer b = 100;

System.out.println(a == b);
// true
```

而：

```java
Integer a = 1000;
Integer b = 1000;

System.out.println(a == b);
// 通常为 false
```

常见的 `Integer` 缓存范围为：

```text
-128 ~ 127
```

这个范围内通过自动装箱得到的 `Integer` 对象通常会复用缓存对象。

对于范围外的值，不应该依赖对象是否相同。

因此：

> 比较包装类数值是否相等，通常使用 equals()，而不是 ==。

另外，如果其中一个操作数是基本类型，`==` 可能触发自动拆箱，这时比较规则也会不同。

---

## 九、包装类与 Map、HashMap 的关系

你之前学习过：

```java
Map<String, Integer> scores = new HashMap<>();
```

现在可以将这些知识点连接起来。

```text
Map<String, Integer>
 │      │       │
 │      │       └── Integer：int 的包装类
 │      │
 │      └── String：字符串引用类型
 │
 └── Map：Key-Value 映射接口
```

右边：

```java
new HashMap<>()
```

表示创建一个使用哈希表实现的 Map 对象。

完整过程：

```text
创建 HashMap
      ↓
保存 Key-Value
      ↓
Key = "Alice"
Value = Integer(90)
      ↓
利用 Hash 进行快速定位
      ↓
通过 Key 查找 Value
```

例如：

```java
Map<String, Integer> scores = new HashMap<>();

scores.put("Alice", 90);

Integer score = scores.get("Alice");

System.out.println(score);
// 90
```

其中：

```java
scores.put("Alice", 90);
```

数字 `90` 是 `int` 字面量，会自动装箱为 `Integer`。

---

## 十、面试常见问题

### Q1：什么是包装类？

包装类就是 Java 为基本数据类型提供的对应对象类型。

例如：

```java
int → Integer
double → Double
boolean → Boolean
```

### Q2：为什么需要包装类？

因为 Java 中部分功能需要引用类型，例如集合、泛型，以及需要表示 `null` 的场景。

### Q3：什么是自动装箱？

Java 自动将基本类型转换为对应包装类对象。

```java
Integer a = 10;
```

### Q4：什么是自动拆箱？

Java 自动从包装类对象中获取基本类型的值。

```java
Integer a = 10;

int b = a;
```

### Q5：Integer 和 int 有什么区别？

- `int` 是基本类型。
- `Integer` 是引用类型。
- `Integer` 可以为 `null`。
- `Integer` 可以作为泛型类型参数。
- `int` 通常更适合直接进行数值计算。

### Q6：Integer 可以用 == 比较吗？

可以使用，但必须理解比较语义。

两个 `Integer` 引用使用 `==` 时比较对象身份，而不是单纯比较数值。

比较数值通常使用：

```java
a.equals(b);
```

如果 `a` 可能为 `null`，可以使用：

```java
Objects.equals(a, b);
```

---

## 十一、快速复习

### 核心概念

```text
基本数据类型
      │
      │ Boxing（装箱）
      ↓
    包装类
      │
      │ Unboxing（拆箱）
      ↓
基本数据类型
```

### 最重要的三个知识点

| 概念 | 一句话记忆 |
|---|---|
| 包装类 | 基本类型对应的对象类型 |
| 装箱 | 基本类型 → 包装类 |
| 拆箱 | 包装类 → 基本类型 |

### 复习检查清单

- [ ] 理解包装类是什么
- [ ] 记住八种基本类型对应的包装类
- [ ] 理解为什么集合需要包装类
- [ ] 掌握自动装箱和自动拆箱
- [ ] 理解 `Integer` 为什么可以为 `null`
- [ ] 理解自动拆箱可能产生 `NullPointerException`
- [ ] 理解包装类的 `==` 与 `equals()` 区别
- [ ] 了解 Integer 缓存机制
- [ ] 能够正确使用 `Map<String, Integer>`

---

## 最终总结

**包装类的核心作用，是让基本数据类型的值可以作为对象使用。**

```text
基本类型：int
     │
     │ 装箱
     ↓
包装类：Integer
     │
     ├── 可以用于集合
     ├── 可以用于泛型
     ├── 可以表示 null
     └── 提供实用方法
```

**最终记忆：**

> 基本类型是值，包装类是对象；装箱变对象，拆箱取出值。

核心关键词：**Primitive Type、Wrapper Class、Autoboxing、Unboxing、Integer、null。**