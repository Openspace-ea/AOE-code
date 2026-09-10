import { AOE_PRODUCT_INFO } from './aoe.js'

// AOE Code: 使用 AOE 自己的产品 URL
export const PRODUCT_URL = AOE_PRODUCT_INFO.WEBSITE

// AOE Code: 使用 AOE 自己的远程会话 URL
export const CLAUDE_AI_BASE_URL = AOE_PRODUCT_INFO.WEBSITE
export const CLAUDE_AI_STAGING_BASE_URL = AOE_PRODUCT_INFO.WEBSITE
export const CLAUDE_AI_LOCAL_BASE_URL = 'http://localhost:4000'

/**
 * Determine if we're in a staging environment for remote sessions.
 * AOE Code: 始终返回 false，不使用 staging
 */
export function isRemoteSessionStaging(
  sessionId?: string,
  ingressUrl?: string,
): boolean {
  // AOE Code: 禁用 staging 环境
  return false
}

/**
 * Determine if we're in a local-dev environment for remote sessions.
 * Checks session ID format (e.g. `session_local_...`) and ingress URL.
 */
export function isRemoteSessionLocal(
  sessionId?: string,
  ingressUrl?: string,
): boolean {
  return (
    sessionId?.includes('_local_') === true ||
    ingressUrl?.includes('localhost') === true
  )
}

/**
 * Get the base URL for AOE based on environment.
 */
export function getClaudeAiBaseUrl(
  sessionId?: string,
  ingressUrl?: string,
): string {
  if (isRemoteSessionLocal(sessionId, ingressUrl)) {
    return CLAUDE_AI_LOCAL_BASE_URL
  }
  // AOE Code: 始终使用 AOE 的 URL
  return CLAUDE_AI_BASE_URL
}

/**
 * Get the full session URL for a remote session.
 * AOE Code: 使用 AOE 自己的会话 URL
 */
export function getRemoteSessionUrl(
  sessionId: string,
  ingressUrl?: string,
): string {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { toCompatSessionId } =
    require('../bridge/sessionIdCompat.js') as typeof import('../bridge/sessionIdCompat.js')
  /* eslint-enable @typescript-eslint/no-require-imports */
  const compatId = toCompatSessionId(sessionId)
  const baseUrl = getClaudeAiBaseUrl(compatId, ingressUrl)
  return `${baseUrl}/code/${compatId}`
}
