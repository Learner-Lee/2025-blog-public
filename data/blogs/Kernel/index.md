# Mac 上拉取 Kaggle Kernel 完整步骤

以下是适配 Mac 环境、可直接复制执行的完整 Markdown 指南，全程照着做就能成功拉取目标 Kernel：

------

## 1. 安装 Kaggle CLI（未安装时执行）

打开 Mac **终端（Terminal）**，执行以下命令安装 Kaggle 命令行工具：

```
pip install kaggle --upgrade
```

如果提示权限不足，改用 `--user` 参数安装到用户目录：

```
pip install kaggle --upgrade --user
```

------

## 2. 配置 Kaggle API 认证（必须步骤）

这一步是 CLI 访问 Kaggle 的前提，需要配置你的 API 密钥：

1. 登录 Kaggle 官网 → 点击右上角头像 → 进入 **Settings**

2. 找到 **API** 板块 → 点击 **Create New Token**，浏览器会自动下载 `kaggle.json` 文件

3. 在终端执行以下命令，将密钥文件移动到正确位置并设置权限：

   ```
   # 创建 Kaggle 配置目录
   mkdir -p ~/.kaggle
   
   # 将下载的 kaggle.json 移动到配置目录（默认下载路径为 Downloads）
   mv ~/Downloads/kaggle.json ~/.kaggle/
   
   # 设置文件权限（关键！避免认证失败）
   chmod 600 ~/.kaggle/kaggle.json
   ```

   

------

## 3. 拉取目标 Kaggle Kernel

执行以下命令，直接拉取你需要的笔记：

```
kaggle kernels pull julian3833/2-quick-study-lgbm-xgb-and-catboost-lb-1-66
```

执行成功后，会在当前终端的工作目录下生成一个 `.ipynb` 文件，直接用 Jupyter Notebook、VS Code 或其他编辑器打开即可查看。

------

## 常见问题与解决方案

### 问题 1：`command not found: kaggle`

安装后终端找不到命令，是因为 Python 脚本目录未加入环境变量，可通过以下方式解决：

- 方法 1：重启终端，重新加载环境变量

- 方法 2：直接用 Python 调用 CLI 工具

  ```
  python -m kaggle kernels pull julian3833/2-quick-study-lgbm-xgb-and-catboost-lb-1-66
  ```

  

### 问题 2：`401 Unauthorized` 认证失败

- 检查 `kaggle.json` 是否正确放在 `~/.kaggle/` 目录下
- 重新执行 `chmod 600 ~/.kaggle/kaggle.json` 设置权限
- 若仍失败，可在 Kaggle 重新生成 API Token，重复步骤 2

------

## 补充说明

- 拉取的文件会保存在**当前终端所在的文件夹**中，可通过 `pwd` 命令查看当前路径

- 若想指定保存目录，可在命令后添加 -p 参数：

  ```bash
  kaggle kernels pull julian3833/2-quick-study-lgbm-xgb-and-catboost-lb-1-66 -p ~/Documents/Kaggle/
  ```