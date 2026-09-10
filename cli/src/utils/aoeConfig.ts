/**
 * AOE Code 配置读取工具
 * 统一处理环境变量和 settings.json 配置的优先级
 */

import { getGlobalConfig } from './config.js'
import { isEnvTruthy } from './envUtils.js'

/**
 * 检查配置值，优先读取环境变量，其次读取 settings.json
 * @param envVar 环境变量名
 * @param settingsKey settings.json 中的字段名
 * @param defaultValue 默认值
 * @returns 配置值
 */
export function getAoeConfig(
  envVar: string | undefined,
  settingsKey: string,
  defaultValue: boolean | number | string | undefined
): boolean | number | string | undefined {
  // 优先检查环境变量
  if (envVar) {
    const envValue = process.env[envVar]
    if (envValue !== undefined) {
      if (typeof defaultValue === 'boolean') {
        return isEnvTruthy(envVar)
      }
      if (typeof defaultValue === 'number') {
        const num = parseInt(envValue, 10)
        return isNaN(num) ? defaultValue : num
      }
      return envValue
    }
  }

  // 其次检查 settings.json
  try {
    const config = getGlobalConfig()
    const settingsValue = (config as Record<string, unknown>)[settingsKey]
    if (settingsValue !== undefined) {
      return settingsValue as boolean | number | string
    }
  } catch {
    // 配置读取失败，使用默认值
  }

  return defaultValue
}

/**
 * 检查 AOE Code 简化模式
 */
export function isAoeSimpleMode(): boolean {
  return getAoeConfig(
    'CLAUDE_CODE_SIMPLE',
    'aoeCodeSimpleMode',
    false
  ) as boolean
}

/**
 * 检查 AOE Code 工具搜索是否启用
 */
export function isAoeToolSearchEnabled(): boolean {
  return getAoeConfig(
    'ENABLE_TOOL_SEARCH',
    'aoeCodeToolSearchEnabled',
    false
  ) as boolean
}

/**
 * 检查 AOE Code 后台任务是否禁用
 */
export function isAoeBackgroundTasksDisabled(): boolean {
  return getAoeConfig(
    'CLAUDE_CODE_DISABLE_BACKGROUND_TASKS',
    'aoeCodeDisableBackgroundTasks',
    false
  ) as boolean
}

/**
 * 检查 AOE Code 自动记忆是否禁用
 */
export function isAoeAutoMemoryDisabled(): boolean {
  return getAoeConfig(
    'CLAUDE_CODE_DISABLE_AUTO_MEMORY',
    'aoeCodeDisableAutoMemory',
    false
  ) as boolean
}

/**
 * 检查 AOE Code 即时刷新是否启用
 */
export function isAoeEagerFlushEnabled(): boolean {
  return getAoeConfig(
    'CLAUDE_CODE_EAGER_FLUSH',
    'aoeCodeEagerFlush',
    false
  ) as boolean
}

/**
 * 获取 AOE Code API 超时时间
 */
export function getAoeApiTimeoutMs(): number | undefined {
  return getAoeConfig(
    'API_TIMEOUT_MS',
    'aoeCodeApiTimeoutMs',
    undefined
  ) as number | undefined
}

/**
 * 检查 AOE Code 演示模式
 */
export function isAoeDemoMode(): boolean {
  return getAoeConfig(
    'IS_DEMO',
    'aoeCodeDemoMode',
    false
  ) as boolean
}
