#!/bin/bash

# AOE Code CLI 本地开发启动脚本

# 默认 API 地址（可修改为你的本地服务器地址）
DEFAULT_API_URL="http://localhost:8080"

# 默认登录页面地址（可修改为你的本地登录页面地址）
DEFAULT_LOGIN_PAGE_URL="http://localhost:3000"

# 使用参数或默认值
API_URL="${1:-$DEFAULT_API_URL}"
LOGIN_PAGE_URL="${2:-$DEFAULT_LOGIN_PAGE_URL}"

echo "🚀 启动 AOE Code CLI"
echo "   API 地址: $API_URL"
echo "   登录页面: $LOGIN_PAGE_URL"
echo ""

# 启动 CLI（开发模式自动开启调试日志）
AOE_API_URL="$API_URL" AOE_LOGIN_PAGE_URL="$LOGIN_PAGE_URL" AOE_DEBUG=1 bun run dev
