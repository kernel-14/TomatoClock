# GitHub 上传指南 📤

本指南将教你如何将番茄钟项目上传到 GitHub。

## 📋 准备工作

### 1. 安装 Git

如果还没有安装 Git：

1. 访问 [Git 官网](https://git-scm.com/download/win)
2. 下载并安装 Git for Windows
3. 安装完成后，打开 Git Bash 验证：
   ```bash
   git --version
   ```

### 2. 配置 Git

首次使用需要配置用户信息：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱@example.com"
```

### 3. 创建 GitHub 账号

如果还没有 GitHub 账号：
1. 访问 [GitHub](https://github.com)
2. 点击 "Sign up" 注册账号

## 🚀 上传步骤

### 步骤 1：在 GitHub 创建仓库

1. 登录 GitHub
2. 点击右上角的 "+" → "New repository"
3. 填写仓库信息：
   - **Repository name**: `pomodoro-timer`
   - **Description**: `一个基于 Electron 的番茄钟桌面应用`
   - **Public/Private**: 选择 Public（公开）或 Private（私有）
   - **不要勾选** "Initialize this repository with a README"
4. 点击 "Create repository"

### 步骤 2：初始化本地仓库

在项目目录打开 PowerShell 或 Git Bash：

```bash
# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: Pomodoro Timer v1.0.0"
```

### 步骤 3：连接到 GitHub

将 `your-username` 替换为你的 GitHub 用户名：

```bash
# 添加远程仓库
git remote add origin https://github.com/your-username/pomodoro-timer.git

# 推送到 GitHub
git push -u origin main
```

如果提示分支名称错误，可能需要：

```bash
# 重命名分支为 main
git branch -M main

# 再次推送
git push -u origin main
```

### 步骤 4：上传第一版 EXE 文件

#### 方法 1：通过 GitHub Releases（推荐）

1. 在 GitHub 仓库页面，点击 "Releases"
2. 点击 "Create a new release"
3. 填写信息：
   - **Tag version**: `v1.0.0`
   - **Release title**: `Pomodoro Timer v1.0.0`
   - **Description**: 
     ```markdown
     ## 🎉 首个正式版本
     
     ### 功能特性
     - ✅ 番茄钟计时器
     - ✅ 任务追踪
     - ✅ 统计数据
     - ✅ 自定义设置
     
     ### 下载
     - **安装版**: Pomodoro Timer-1.0.0-x64.exe
     - **便携版**: Pomodoro Timer-1.0.0-portable.exe（推荐）
     
     ### 使用说明
     详见 [README.md](https://github.com/your-username/pomodoro-timer)
     ```
4. 点击 "Attach binaries" 上传文件：
   - `release/Pomodoro Timer-1.0.0-x64.exe`
   - `release/Pomodoro Timer-1.0.0-portable.exe`
5. 点击 "Publish release"

#### 方法 2：使用 Git LFS（大文件）

如果 EXE 文件很大（>100MB），需要使用 Git LFS：

```bash
# 安装 Git LFS
git lfs install

# 追踪 EXE 文件
git lfs track "*.exe"

# 添加 .gitattributes
git add .gitattributes

# 添加 EXE 文件
git add release/*.exe

# 提交
git commit -m "Add v1.0.0 executables"

# 推送
git push
```

## 📝 后续更新

### 更新代码

```bash
# 查看修改
git status

# 添加修改的文件
git add .

# 提交
git commit -m "描述你的修改"

# 推送到 GitHub
git push
```

### 发布新版本

```bash
# 创建新标签
git tag v1.0.1

# 推送标签
git push origin v1.0.1

# 然后在 GitHub 创建新的 Release
```

## 🔧 常见问题

### 问题 1：推送时要求输入用户名密码

**解决方法**：使用 Personal Access Token

1. 在 GitHub 点击头像 → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 点击 "Generate new token (classic)"
3. 勾选 `repo` 权限
4. 生成后复制 token
5. 推送时使用 token 作为密码

### 问题 2：文件太大无法上传

**解决方法**：

1. 确保 `release/` 目录在 `.gitignore` 中
2. 只通过 GitHub Releases 上传 EXE 文件
3. 或使用 Git LFS

### 问题 3：推送被拒绝

```bash
# 先拉取远程更改
git pull origin main --rebase

# 再推送
git push
```

### 问题 4：忘记添加 .gitignore

```bash
# 移除已追踪的文件
git rm -r --cached node_modules
git rm -r --cached dist
git rm -r --cached dist-electron

# 提交
git commit -m "Remove ignored files"
git push
```

## 📂 推荐的文件结构

上传到 GitHub 的文件：

```
✅ 应该上传：
├── src/                 # 源代码
├── build/               # 构建资源（图标等）
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── LICENSE

❌ 不应该上传：
├── node_modules/        # 依赖包
├── dist/                # 构建输出
├── dist-electron/       # 构建输出
├── release/             # 打包文件
└── logs/                # 日志文件
```

## 🎯 完整示例

```bash
# 1. 初始化
git init
git add .
git commit -m "Initial commit: Pomodoro Timer v1.0.0"

# 2. 连接 GitHub（替换为你的用户名）
git remote add origin https://github.com/your-username/pomodoro-timer.git
git branch -M main
git push -u origin main

# 3. 创建标签
git tag v1.0.0
git push origin v1.0.0

# 4. 在 GitHub 网页上创建 Release 并上传 EXE 文件
```

## 📚 参考资源

- [Git 官方文档](https://git-scm.com/doc)
- [GitHub 文档](https://docs.github.com)
- [Git LFS 文档](https://git-lfs.github.com/)

---

**祝你上传顺利！** 🎉
