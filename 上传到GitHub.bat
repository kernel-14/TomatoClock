@echo off
chcp 65001 >nul
echo ========================================
echo   番茄钟项目 - GitHub 上传助手
echo ========================================
echo.

echo 请按照以下步骤操作：
echo.
echo 1. 确保已安装 Git
echo 2. 确保已在 GitHub 创建仓库
echo 3. 准备好你的 GitHub 用户名
echo.

set /p username="请输入你的 GitHub 用户名: "
echo.

echo ========================================
echo   开始上传...
echo ========================================
echo.

echo [1/5] 初始化 Git 仓库...
git init
if errorlevel 1 (
    echo ❌ Git 初始化失败！请确保已安装 Git
    pause
    exit /b 1
)
echo ✓ Git 仓库初始化成功
echo.

echo [2/5] 添加所有文件...
git add .
if errorlevel 1 (
    echo ❌ 添加文件失败！
    pause
    exit /b 1
)
echo ✓ 文件添加成功
echo.

echo [3/5] 提交到本地仓库...
git commit -m "Initial commit: Pomodoro Timer v1.0.0"
if errorlevel 1 (
    echo ❌ 提交失败！
    pause
    exit /b 1
)
echo ✓ 提交成功
echo.

echo [4/5] 连接到 GitHub...
git remote add origin https://github.com/%username%/pomodoro-timer.git
git branch -M main
echo ✓ 远程仓库连接成功
echo.

echo [5/5] 推送到 GitHub...
echo.
echo 注意：如果提示输入密码，请使用 Personal Access Token
echo 获取方式：GitHub → Settings → Developer settings → Personal access tokens
echo.
git push -u origin main
if errorlevel 1 (
    echo.
    echo ❌ 推送失败！可能的原因：
    echo    1. 仓库不存在
    echo    2. 用户名错误
    echo    3. 需要 Personal Access Token
    echo.
    echo 请查看 GITHUB_UPLOAD_GUIDE.md 获取详细帮助
    pause
    exit /b 1
)
echo.
echo ✓ 推送成功
echo.

echo [6/5] 创建版本标签...
git tag v1.0.0
git push origin v1.0.0
echo ✓ 标签创建成功
echo.

echo ========================================
echo   🎉 上传完成！
echo ========================================
echo.
echo 下一步：
echo 1. 访问 https://github.com/%username%/pomodoro-timer
echo 2. 点击 "Releases" → "Create a new release"
echo 3. 选择标签 v1.0.0
echo 4. 上传 release 文件夹中的 .exe 文件
echo.
echo 详细说明请查看 GITHUB_UPLOAD_GUIDE.md
echo.
pause
