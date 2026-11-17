# 解决 typora 提示 This beta version of Typora is expired, please download and install a newer version（Mac版）

## 首先，查看 Mac 版 Typora 的配置

打开终端，运行只读命令：

```bash
defaults read abnerworks.Typora
```

本次提供的输出中没有 `iDate`，也没有明确标明试用到期时间的字段。与日期有关的内容包括：

```text
SULastCheckTime = "2026-05-15 08:48:06 +0000";
verInitTime = "2026-04-20 07:22:40 +0000";   <--  我们要改的目标
```

字段说明：

| 字段 | 本次判断 |
| --- | --- |
| `SULastCheckTime` | Sparkle 更新组件最后检查更新的时间，不应当作试用开始时间。 |
| `verInitTime` | 从名称看可能与版本初始化有关，但本次未验证其实际用途，也未确认它参与到期判断。 |

本文省略了原配置中的最近访问目录、UUID 等与操作无关的信息。

## 然后，把 `verInitTime` 从 2026 年改成 2099 年？

目标是把：

```text
2026-04-20 07:22:40 +0000
```

改成：

```text
2099-04-20 07:22:40 +0000
```

先按 **⌘Q 完全退出 Typora**，再依次执行以下命令。如果备份命令报错，应先解决备份问题再修改。备份路径如果已经存在同名文件，请换一个文件名，避免覆盖旧备份。

### 第一步：备份当前配置

```bash
defaults export abnerworks.Typora "$HOME/Desktop/Typora-before-date-change.plist"
```

备份将保存在桌面，文件名为 `Typora-before-date-change.plist`。

### 第二步：修改日期字符串

```bash
defaults write abnerworks.Typora verInitTime -string "2099-04-20 07:22:40 +0000"
```

这里保留了原来的月、日、时间和 `+0000` 时区标记，只修改年份；按本次配置所显示的字符串形式写入。

### 第三步：检查结果

```bash
defaults read abnerworks.Typora verInitTime
```

预期输出：

```text
2099-04-20 07:22:40 +0000
```

然后重新打开 Typora，观察实际行为。若要确认应用是否重写了字段，可在退出 Typora 后再次执行读取命令。

## 如何恢复原来的日期？

先完全退出 Typora，再运行：

```bash
defaults write abnerworks.Typora verInitTime -string "2026-04-20 07:22:40 +0000"
```

检查恢复结果：

```bash
defaults read abnerworks.Typora verInitTime
```

## 修改后一定能解决过期问题吗？

不能保证，这只是一个探索类型的学习与测试。上述命令只用于修改偏好设置中的一个字符串字段。读取到 2099 年，只能说明字段修改成功，不能证明软件的到期判断已经改变。
