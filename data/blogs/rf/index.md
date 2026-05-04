# 集成学习 & Random Forest



## 集成算法

集成算法会考虑多个评估器的建模结果，汇总之后得到一个综合的结果，以此来获取**比单个模型更好的回归或分类表现**。

- 多个模型集成成为的模型叫做**集成评估器**(ensemble estimator)
- 组成集成评估器的每个模型都叫做**基评估器**(base estimator)。
- 有三类集成算法:**装袋法**(Bagging)，**提升法**(Boosting)和**stacking**.

![image-20260311140955005](/blogs/rf/d2051badedfd4602.png)

**装袋法**：

- 核心思想 -》**构建多个相互独立的评估器**
- 对其预测进行平均或多数表决原则来决定集成评估器的结果。
- 装袋法的代表模型就是**随机森林**。



**提升法**：

- 基评估器是相关的，是按顺序一一构建的。
- 其核心思想是结合**弱评估器**的力量一次次**对难以评估的样本**进行预测，从而构成一个**强评估器**。
- 提升法的代表模型有Adaboost和梯度提升树。





## sklearn中的集成算法

| 类                                    | 类的功能                                |
| :------------------------------------ | :-------------------------------------- |
| `ensemble.AdaBoostClassifier`         | AdaBoost分类                            |
| `ensemble.AdaBoostRegressor`          | Adaboost回归                            |
| `ensemble.BaggingClassifier`          | 装袋分类器                              |
| `ensemble.BaggingRegressor`           | 装袋回归器                              |
| `ensemble.ExtraTreesClassifier`       | Extra-trees分类（超树，极端随机树）     |
| `ensemble.ExtraTreesRegressor`        | Extra-trees回归                         |
| `ensemble.GradientBoostingClassifier` | 梯度提升分类                            |
| `ensemble.GradientBoostingRegressor`  | 梯度提升回归                            |
| `ensemble.IsolationForest`            | 隔离森林                                |
| `ensemble.RandomForestClassifier`     | **随机森林分类**                        |
| `ensemble.RandomForestRegressor`      | **随机森林回归**                        |
| `ensemble.RandomTreesEmbedding`       | 完全随机树的集成                        |
| `ensemble.VotingClassifier`           | 用于不合适估算器的软投票/多数规则分类器 |





## 2 RandomForestClassifier

class `sklearn.ensemble.RandomForestClassifier` (n_estimators='10', criterion='gini', max_depth=None,
min_samples_split=2, min_samples_leaf=1, min_weight_fraction_leaf=0.0, max_features='auto',
max_leaf_nodes=None, min_impurity_decrease=0.0, min_impurity_split=None, bootstrap=True, oob_score=False, n_jobs=None, random_state=None, verbose=0, warm_start=False, class_weight=None)

随机森林是非常具有代表性的Bagging集成算法，它的所有基评估器都是决策树。

- 分类树组成的森林就叫做随机森林分类器
- 回归树所集成的森林就叫做随机森林回归器。



| 参数名                | 含义简述                                                 | 可以填什么 (类型/常见值)                                     |
| :-------------------- | :------------------------------------------------------- | :----------------------------------------------------------- |
| **n_estimators**      | 森林中树的数量。越多通常效果越好，但计算越慢。           | **整数** (如 `10`, `100`, `500`)。默认通常是 100。           |
| **criterion**         | 衡量分裂质量的函数。                                     | **字符串**: `'gini'` (基尼系数，默认), `'entropy'` (信息增益), `'log_loss'` (新版)。 |
| **max_depth**         | 每棵树的最大深度。限制深度可防止过拟合。                 | **整数** (如 `3`, `10`, `20`) 或 **`None`** (不限制，直到节点纯或样本少)。 |
| **min_samples_split** | 分裂内部节点所需的最小样本数。                           | **整数** (如 `2`, `10`) 或 **浮点数** (表示比例，如 `0.1` 即 10%)。默认 2。 |
| **min_samples_leaf**  | 叶子节点所需的最小样本数。比上一个参数更能平滑模型。     | **整数** (如 `1`, `5`) 或 **浮点数** (比例)。默认 1。        |
| **max_features**      | 寻找最佳分裂时考虑的特征数量。这是随机森林“随机”的关键。 | **整数** (具体个数), **浮点数** (比例), **`'auto'`** (即 总特征数总特征数 ), **`'sqrt'`**, **`'log2'`**, 或 **`None`** (所有特征)。 |
| **bootstrap**         | 是否使用自助采样 (bootstrap samples) 来构建树。          | **布尔值**: `True` (默认), `False`。若为 False，则使用整个数据集构建每棵树。 |
| **oob_score**         | 是否使用袋外 (out-of-bag) 样本来估计泛化误差。           | **布尔值**: `False` (默认), `True` (需设置 `bootstrap=True`)。 |
| **class_weight**      | 处理类别不平衡问题。                                     | **`None`** (默认), **`'balanced'`** (自动根据频率调整权重), 或 **字典** (手动指定 `{0: 1, 1: 10}`)。 |
| **random_state**      | 控制随机性的种子。保证结果可复现。                       | **整数** (如 `0`, `42`) 或 **`None`** (每次运行结果不同)。   |
| **n_jobs**            | 并行运行的作业数。                                       | **整数**: `-1` (使用所有 CPU 核心), `1` (单核), 或其他正整数。 |
| **warm_start**        | 是否复用之前调用的解来增加更多的树。                     | **布尔值**: `False` (默认), `True`。                         |



## 2.1 重要参数

#### **2.1.1 控制基评估器的参数**

| 参数                  | 含义                                                         |
| :-------------------- | :----------------------------------------------------------- |
| criterion             | **不纯度的衡量指标**，有基尼系数和信息熵两种选择             |
| max_depth             | **树的最大深度**，超过最大深度的树枝都会被剪掉               |
| min_samples_leaf      | 一个节点在分枝后的每个子节点都必须**包含至少min_samples_leaf个训练样本**，否则分枝就不会发生 |
| min_samples_split     | 一个节点必须要包含**至少min_samples_split个训练样本**，这个节点才允许被分枝，否则分枝就不会发生 |
| max_features          | max_features限制分枝时考虑的特征个数，超过限制个数的特征都会被舍弃，默认值为总特征个数开平方取整 |
| min_impurity_decrease | 限制信息增益的大小，**信息增益小于设定数值**的分枝不会发生   |



### 2.1.2 n_estimators

森林中树木的数量，也就是基础评估器的数量。

- n_estimators越大，模型的效果往往越好
- n_estimators越大，模型的时间也会越来越长
- n_estimators （0 - 200）



#### 导包 + 数据

```python
%matplotlib inline

from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import load_wine

wine = load_wine()
wine
wine.data.shape
wine.target
```

![image-20260311172754158](/blogs/rf/998d756101a4b0b1.png)



#### 拆分数据集

```python
from sklearn.model_selection import train_test_split

X_train, X_test, Y_train, Y_test = train_test_split(wine.data, wine.target, test_size=0.2, random_state=42)
```



#### 决策树 & 随机森林

```
clf = DecisionTreeClassifier(random_state=0)
rfc = RandomForestClassifier(random_state=0)

clf = clf.fit(X_train, Y_train)
rfc = rfc.fit(X_train, Y_train)

score_c = clf.score(X_test, Y_test)
score_r = rfc.score(X_test, Y_test)

print("决策树的准确率：", score_c)
print("随机森林的准确率：", score_r)
```

决策树的准确率： 0.9444444444444444 

随机森林的准确率： 1.0



#### 交叉验证

```
# 交叉验证：cross_val_score
from sklearn.model_selection import cross_val_score
import matplotlib.pyplot as plt

rfc = RandomForestClassifier(n_estimators=100)
rfc_s = cross_val_score(rfc, wine.data, wine.target, cv=10)

clf = DecisionTreeClassifier()
clf_s = cross_val_score(clf, wine.data, wine.target, cv=10)

plt.plot(range(1, 11), rfc_s, label="Random Forest")
plt.plot(range(1, 11), clf_s, label="Decision Tree")
plt.legend()
plt.xlabel("Fold")
plt.ylabel("Score")
plt.title("Cross-Validation Scores")
plt.legend()
plt.show()
```

![image-20260311172951603](/blogs/rf/5d9c999bd45e0329.png)





#### 10次重复交叉验证绘制成折线图

```python
rfc_l = []
clf_l = []

for i in range(10):
    rfc = RandomForestClassifier(n_estimators=25)
    rfc_s = cross_val_score(rfc, wine.data, wine.target, cv=10).mean()
    rfc_l.append(rfc_s)

    clf = DecisionTreeClassifier()
    clf_s = cross_val_score(clf, wine.data, wine.target, cv=10).mean()
    clf_l.append(clf_s)

plt.plot(range(1, 11), rfc_l, label="Random Forest")
plt.plot(range(1, 11), clf_l, label="Decision Tree")
plt.legend()
plt.xlabel("Fold")
plt.ylabel("Score")
plt.title("Cross-Validation Scores")
plt.show()
```

![image-20260311173200797](/blogs/rf/d42fe711d075bb7d.png)



#### n_estimators的学习曲线

```python
# 6. n_estimators的学习曲线
#### 【TIME WARNING: 2mins 30 seconds】 ####

superpa = []  # 用于存储每次交叉验证的平均得分

for i in range(200):
    # 创建随机森林分类器，n_estimators从1到200递增
    rfc = RandomForestClassifier(n_estimators=i+1, n_jobs=-1)
    # 使用10折交叉验证评估模型性能，取平均得分
    rfc_s = cross_val_score(rfc, wine.data, wine.target, cv=10).mean()
    # 将得分加入列表
    superpa.append(rfc_s)

# 输出最高得分及其对应的n_estimators值（索引+1）
print(max(superpa), superpa.index(max(superpa))+1)

# 绘制学习曲线
plt.figure(figsize=[20, 5])
plt.plot(range(1, 201), superpa)  # x轴：n_estimators从1到200；y轴：对应平均得分
plt.show()
```

0.9888888888888889 14

![image-20260311173237802](/blogs/rf/cd308e6710b0a549.png)











### 2.1.3 random_state

随机森林的本质是一种装袋集成算法（bagging），装袋集成算法是对基评估器的预测结果进行平均或多数原则来决定集成评估器的结果。

$$
e_{\text{random\_forest}}
=
\sum_{i=13}^{25}
\binom{25}{i}
\varepsilon^{\,i}
(1-\varepsilon)^{25-i}
= 0.000369
$$

```python
import numpy as np
from scipy.special import comb

epsilon = 0.2

error = np.array([
    comb(25, i) * (epsilon ** i) * ((1 - epsilon) ** (25 - i))
    for i in range(13, 26)
]).sum()

print(error)
```

0.00036904803455582827

可见，判断错误的几率非常小，这让随机森林在红酒数据集上的表现远远好于单棵决策树。





**那现在就有一个问题了**：袋装法服从多数表决原则或对基分类器结果求平均，这即是说，我们默认森林中的每棵树应该是不同的，并且会返回不同的结果。但是我们设定了随机数种子，**按道理说生成的树长的都是一样的**，我们使用了一样的类 DecisionTreeClassifier，一样的参数，一样的训练集和测试集，为什么随机森林里的众多树会有不同的判断结果？

决策树的random-state是控制一棵树，而随机森林的random-state是控制一片固定的森林而不是单一的树

![image-20260324174926548](/blogs/rf/cb5f8e165a7af9dc.png)

#### 代码

```python
rfc = RandomForestClassifier(n_estimators=25,random_state=20)
rfc.fit(X_train, Y_train)
```

查看书的参数

```python
# 随机森林的重要属性之一：estimators_，查看森林中树的状况
rfc.estimators_
```

[DecisionTreeClassifier(max_features='sqrt', random_state=378518883), DecisionTreeClassifier(max_features='sqrt', random_state=1663920602), DecisionTreeClassifier(max_features='sqrt', random_state=1708167439), 

.....

DecisionTreeClassifier(max_features='sqrt', random_state=938905318), DecisionTreeClassifier(max_features='sqrt', random_state=1010465510), DecisionTreeClassifier(max_features='sqrt', random_state=1215491262)]

```python
rfc.estimators_[0].random_state
```

378518883

```
for i in range(len(rfc.estimators_)):
    print(rfc.estimators_[i].random_state)
```

378518883 1663920602 1708167439 ...... 938905318 1010465510 1215491262





### 2.1.4 bootstrap & oob_score

> 当随机森林里的决策树差别越大，结果越好；这单纯使用 random_status 是无法达到的

要让基分类器尽量都不一样，一种很容易理解的方法是使用**不同的训练集**来进行训练，而袋装法正是通过有放回的随机抽样技术来形成不同的训练数据 (参数: bootstrap)。

**bootstrap 参数默认 True**。通常，这个参数不会被我们设置为 False。

![image-20260324180759371](/blogs/rf/ef2290935fa39a8e.png)



由于 bootstrap 采用**有放回抽样**，部分样本会被重复采样，而部分样本可能从未被选中。
 一个样本**至少被抽中一次**的概率为：

$$
1 - \left(1 - \frac{1}{n}\right)^n
$$

当 n 足够大时，该概率收敛于：

$$
1 - \frac{1}{e} \approx 0.632
$$

因此，每个自助集平均只包含约 **63.2%** 的原始数据，其余约 **36.8%** 的样本未参与训练，被称为**袋外数据（Out-Of-Bag，OOB）**。
 OOB 数据可直接用于评估随机森林模型性能，在树的数量（`n_estimators`）足够多时，可作为测试集的有效替代。**如果希望使用袋外数据来测试，oob_score的参数调整为True**

训练完毕之后，我们可以用随机森林的另一个重要属性：oob_score_ 来查看我们的在袋外数据上测试的结果：

#### 代码

```python
# 无需划分训练集和测试集

rfc = RandomForestClassifier(n_estimators=25, oob_score=True)
rfc = rfc.fit(wine.data, wine.target)

# 重要属性 oob_score_
rfc.oob_score_
```

## 2.2 随机森林的重要属性和接口（缩减版）

在学习完随机森林的主要参数后，可以通过其**重要属性**和**接口方法**来查看模型状态、进行预测与评估。

### 重要属性

- **`estimators_`**：森林中所有已训练好的决策树
- **`oob_score_`**：基于袋外数据（OOB）的模型评估结果
- **`feature_importances_`**：各特征在模型中的重要性

### 常用接口

- **`fit`**：训练模型
- **`predict`**：输出预测类别
- **`score`**：返回模型准确率
- **`apply`**：返回样本在各棵树中的叶节点编号
- **`predict_proba`**：返回样本属于各类别的预测概率

### 预测机制要点

- sklearn 中的随机森林通过**对各棵树的 `predict_proba` 结果取平均**，
- 再根据平均概率决定最终预测类别。

```python
rfc = RandomForestClassifier(n_estimators=25)
rfc = rfc.fit(Xtrain, Ytrain)
rfc.score(Xtest, Ytest)

rfc.feature_importances_
rfc.apply(Xtest)
rfc.predict(Xtest)
rfc.predict_proba(Xtest)
```







## 机器学习中调参的基本思想

### 模型调参第一步：找目标

对于随机森林来说，我们想要提升的是模型在**未知数据**上的准确率（由score或oob_score_来衡量）。

找准了这个目标，我们就需要思考：**模型在未知数据上的准确率受什么因素影响？**

在机器学习中，用来衡量模型在未知数据上的准确率的指标，叫做**泛化误差（Genelization error）**。

![](/blogs/rf/27ce922205806856.png)

- 对**树模型**来说，树越茂盛，深度越深，枝叶越多，模型就越复杂。
- 所以**树模型**是天生位于图的右上角的模型
- **随机森林**是以树模型为基础，所以随机森林也是天生复杂度高的模型。
- **随机森林**的参数，都是向着一个目标去：**减少模型的复杂度**，把模型往图像的左边移动，防止过拟合。



#### 总结

1. 模型太复杂或者太简单，都会让泛化误差高，我们追求的是位于中间的平衡点
2. 模型太复杂就会过拟合，模型太简单就会欠拟合
3. 对树模型和树的集成模型来说，树的深度越深，枝叶越多，模型越复杂
4. 树模型和树的集成模型的目标，都是减少模型复杂度，把模型往图像的左边移动



#### 可以调的参数

| 参数                  | 对模型在未知数据上的评估性能的影响                           | 影响程度   |
| :-------------------- | :----------------------------------------------------------- | :--------- |
| **n_estimators**      | 提升至平稳，`n_estimators`↑，不影响单个模型的复杂度          | ⭐⭐⭐⭐       |
| **max_depth**         | 有增有减，默认最大深度，即最高复杂度，向复杂度降低的方向调参 `max_depth`↓，模型更简单，且向图像的左边移动 | ⭐⭐⭐        |
| **min_samples_leaf**  | 有增有减，默认最小限制1，即最高复杂度，向复杂度降低的方向调参 `min_samples_leaf`↑，模型更简单，且向图像的左边移动 | ⭐⭐⭐        |
| **min_samples_split** | 有增有减，默认是最小限制2，即最高复杂度，向复杂度降低的方向调参 `min_samples_split`↑，模型更简单，且向图像的左边移动 | ⭐⭐         |
| **max_features**      | 有增有减，默认auto，是特征总数的开平方，位于中间复杂度，既可以向复杂度升高的方向，也可以向复杂度降低的方向调参 <br />`max_features`↓，模型更简单，图像左移 <br />`max_features`↑，模型更复杂，图像右移 <br />`max_features`是唯一的，既能够让模型更简单，也能够让模型更复杂的参数，所以在调整这个参数的时候，需要考虑我们调参的方向 | ⭐          |
| **criterion**         | 有增有减，一般使用gini                                       | 看具体情况 |





## 偏差 VS 方差（选学）
