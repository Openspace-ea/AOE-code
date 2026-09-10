/**
 * AOE Code 认证命令
 *
 * 使用 AOE Code 自己的后端认证系统
 * 配置从 aoe-config.json 加载
 */

import type { Command } from '../types/command.js'
import { getGlobalConfig } from '../utils/config.js'
import { isOnlineModeEnabled } from '../utils/buildConfig.js'
import { homedir } from 'os'
import { hostname } from 'os'
import { getProductConfig, getApiConfig, getAuthConfig } from '../config/aoeConfig.js'

export const loginCommand: Command = {
  type: 'prompt',
  name: 'login',
  description: '登录 AOE Code 账号',
  isEnabled: () => isOnlineModeEnabled(),
  isHidden: () => !isOnlineModeEnabled(),
  async getPromptForCommand() {
    if (!isOnlineModeEnabled()) {
      return '当前为本地模式，无需登录。如需登录，请使用 online 模式编译。'
    }

    // 检查是否已登录
    const { isLoggedIn, getMe, loginViaBrowser } = await import('./client.js')

    if (isLoggedIn()) {
      try {
        const user = await getMe()
        return `已登录为 ${user.username || user.email}（${user.email}）`
      } catch {
        // Token 已过期，继续登录流程
      }
    }

    // 浏览器登录
    try {
      const { user } = await loginViaBrowser()
      return `✅ 登录成功！欢迎回来，${user.username || user.email}`
    } catch (err: any) {
      return `❌ 登录失败：${err.message}`
    }
  },
}

export const registerCommand: Command = {
  type: 'prompt',
  name: 'register',
  description: '注册 AOE Code 账号',
  isEnabled: () => isOnlineModeEnabled(),
  isHidden: () => !isOnlineModeEnabled(),
  async getPromptForCommand() {
    if (!isOnlineModeEnabled()) {
      return '当前为本地模式，无需注册。如需注册，请使用 online 模式编译。'
    }

    const apiConfig = getApiConfig()
    const authConfig = getAuthConfig()

    return `请使用以下方式注册：

**方式一：命令行注册**
\`\`\`
aoe --register
\`\`\`

**方式二：API 注册**
\`\`\`bash
curl -X POST ${apiConfig.baseUrl}${authConfig.registerPath} \\
  -H "Content-Type: application/json" \\
  -d '{"email":"your@email.com","username":"yourname","password":"yourpassword"}'
\`\`\`

**注册后：**
1. 自动登录
2. 获赠 100 AOE 点数
3. 可以使用所有功能

**配置信息：**
- API 地址：${apiConfig.baseUrl}
- 注册端点：${authConfig.registerPath}`
  },
}

export const meCommand: Command = {
  type: 'prompt',
  name: 'me',
  description: '显示当前用户信息',
  isEnabled: () => true,
  async getPromptForCommand() {
    const config = getGlobalConfig()
    const { isLoggedIn, getMe } = await import('./client.js')
    const apiConfig = getApiConfig()
    const authConfig = getAuthConfig()
    const productConfig = getProductConfig()

    const parts: string[] = []

    // 基本信息
    parts.push(`## ${productConfig.name} 环境信息\n`)
    parts.push(`- 主机名: ${hostname()}`)
    parts.push(`- 用户目录: ${homedir()}`)
    parts.push(`- 配置目录: ~/.aoe/`)
    parts.push(`- 启动次数: ${config.numStartups || 0}`)
    parts.push(`- 运行模式: ${isOnlineModeEnabled() ? '线上' : '本地'}`)

    // 登录状态
    if (isOnlineModeEnabled()) {
      parts.push('\n## 账号信息\n')
      if (isLoggedIn()) {
        try {
          const user = await getMe()
          parts.push(`- 用户名: ${user.username || '未设置'}`)
          parts.push(`- 邮箱: ${user.email}`)
          parts.push(`- 用户 ID: ${user.id}`)
          if (user.name) parts.push(`- 姓名: ${user.name}`)
          if (user.role) parts.push(`- 角色: ${user.role}`)
          if (user.aoe_points !== undefined) parts.push(`- AOE 点数: ${user.aoe_points}`)
        } catch (err: any) {
          parts.push(`- 登录状态: 获取失败 (${err.message})`)
        }
      } else {
        parts.push('- 登录状态: 未登录')
        parts.push('- 使用 /login 登录')
      }
    }

    // API 配置
    parts.push('\n## API 配置\n')
    parts.push(`- API 地址: ${apiConfig.baseUrl}`)
    parts.push(`- 登录端点: ${authConfig.loginPath}`)
    parts.push(`- 注册端点: ${authConfig.registerPath}`)

    return parts.join('\n')
  },
}
