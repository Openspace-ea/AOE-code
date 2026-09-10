/**
 * AOE Code 登出命令
 *
 * 使用太空地图（SpaceMap）OAuth 2.0 认证系统
 */

import type { Command } from '../../commands.js'
import { isOnlineModeEnabled } from '../../utils/buildConfig.js'

export default {
  type: 'prompt',
  name: 'logout',
  description: '退出 AOE Code 账号',
  isEnabled: () => isOnlineModeEnabled(),
  isHidden: () => !isOnlineModeEnabled(),
  async getPromptForCommand() {
    if (!isOnlineModeEnabled()) {
      return '当前为本地模式，无需登出。'
    }

    const { isLoggedIn, logout, clearToken } = await import('../../auth/client.js')
    const { saveGlobalConfig } = await import('../../utils/config.js')
    const { clearToolSchemaCache } = await import('../../utils/toolSchemaCache.js')
    const { resetUserCache } = await import('../../utils/user.js')

    if (!isLoggedIn()) {
      return '当前未登录。'
    }

    try {
      // 1. 调用登出逻辑
      await logout(undefined)

      // 2. 清除本地缓存
      clearToolSchemaCache()
      resetUserCache()

      // 3. 重置用户配置
      saveGlobalConfig(current => {
        const updated = { ...current }
        updated.oauthAccount = undefined
        return updated
      })

      // 4. 关闭程序
      setTimeout(() => {
        process.exit(0)
      }, 100)

      return '已成功登出 AOE Code 账户，程序即将关闭...'
    } catch (err: any) {
      return `登出失败: ${err.message}`
    }
  },
} satisfies Command
