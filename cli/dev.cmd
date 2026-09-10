@echo off
REM AOE Code CLI 本地开发启动脚本 (Windows)

REM 默认 API 地址（可修改为你的本地服务器地址）
set DEFAULT_API_URL=http://localhost:8080

REM 默认登录页面地址（可修改为你的本地登录页面地址）
set DEFAULT_LOGIN_PAGE_URL=http://localhost:3000

REM 使用参数或默认值
if "%~1"=="" (
    set API_URL=%DEFAULT_API_URL%
) else (
    set API_URL=%~1
)

REM 使用第二个参数或默认登录页面地址
if "%~2"=="" (
    set LOGIN_PAGE_URL=%DEFAULT_LOGIN_PAGE_URL%
) else (
    set LOGIN_PAGE_URL=%~2
)

echo 🚀 启动 AOE Code CLI
echo    API 地址: %API_URL%
echo    登录页面: %LOGIN_PAGE_URL%
echo.

REM 启动 CLI（开发模式自动开启调试日志）
set AOE_API_URL=%API_URL%
set AOE_LOGIN_PAGE_URL=%LOGIN_PAGE_URL%
set AOE_DEBUG=1
bun run dev
