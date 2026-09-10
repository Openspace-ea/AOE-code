/**
 * Agent 运行时配置
 *
 * 本包不直接依赖任何端的认证/存储实现（localStorage、配置文件等），
 * 由宿主应用在启动时调用 initAgentRuntime() 注入。
 *
 * browser 端示例：
 *   import { initAgentRuntime } from '@aoe/agent'
 *   import { API_BASE, getToken, logout } from './lib/auth'
 *   initAgentRuntime({ apiBase: API_BASE, getToken, onUnauthorized: logout })
 */

export interface AgentRuntimeConfig {
  /** API 基础地址，如 '/api'（dev 代理）或 'https://api.aoecode.cn' */
  apiBase: string
  /** 获取当前访问 token */
  getToken: () => string | null
  /** 401 时回调（通常是登出并跳登录页） */
  onUnauthorized?: () => void
}

let runtime: AgentRuntimeConfig | null = null

/** 注入运行时配置（应用启动时调用一次） */
export function initAgentRuntime(config: AgentRuntimeConfig): void {
  runtime = config
}

/** 读取运行时配置；未初始化时抛错，避免静默发出错误请求 */
export function getAgentRuntime(): AgentRuntimeConfig {
  if (!runtime) {
    throw new Error('@aoe/agent 未初始化：请先调用 initAgentRuntime()')
  }
  return runtime
}
