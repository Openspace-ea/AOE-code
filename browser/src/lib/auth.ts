/**
 * 浏览器端登录对接
 *
 * 流程（详见 client/docs/Browser端登录对接-官网登录页回传Token.md）：
 * 未登录 → 整页跳官网登录页（redirect=当前 origin）
 * → 登录成功后官网重定向回 <origin>#token=xxx
 * → 解析 hash 存 localStorage、立即清除 hash → 调 /auth/me 校验 token
 *
 * 安全红线：token 只走 URL hash（不进 query/服务器日志），只存 localStorage，
 * 不写 cookie，解析后立刻从地址栏清除。
 */

const TOKEN_KEY = 'aoe_token' // 与官网保持一致

/** 登录页地址：开发环境默认本机官网 dev 端口，可用 VITE_LOGIN_URL 覆盖 */
const LOGIN_URL =
  import.meta.env.VITE_LOGIN_URL ||
  (import.meta.env.DEV ? 'http://localhost:3000/login' : 'https://www.aoecode.cn/login')

/**
 * API 前缀：默认同源 /api（dev 由 Vite 代理转发并剥离前缀，生产由反向代理处理），
 * 也可用 VITE_API_BASE_URL 直连后端（值为后端实际前缀，不含 /api）
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

/** 当前登录用户（GET /auth/me 响应） */
export interface CurrentUser {
  id?: string
  email?: string
  phone?: string
  nickname?: string
  avatar_url?: string
  plan?: string
}

/** 携带 HTTP 状态码的 API 错误，用于区分 401 与其他失败 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * 从 URL hash 提取 token（刚从登录页跳回来时）。
 * 每次页面加载必须最先执行：存入 localStorage 后立即 replaceState 清除 hash，
 * 保证 token 不留在地址栏与历史记录里，刷新也不会重复处理。
 */
export function extractTokenFromHash(): void {
  const hash = window.location.hash
  if (!hash.includes('token=')) return
  const token = new URLSearchParams(hash.substring(1)).get('token')
  if (!token) return // hash 里 token 为空/缺失：忽略，按未登录处理
  localStorage.setItem(TOKEN_KEY, token)
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

/** 未登录：整页跳官网登录页，登录成功后回到当前站点根路径 */
export function redirectToLogin(): void {
  const redirect = encodeURIComponent(window.location.origin)
  window.location.href = `${LOGIN_URL}?redirect=${redirect}`
}

/** 退出登录：无状态 JWT，只需清除本地 token，无需调用后端接口 */
export function logout(): void {
  clearToken()
  redirectToLogin()
}

/** 校验 token 有效性并获取用户信息；token 失效抛 401 ApiError */
export async function fetchCurrentUser(token: string): Promise<CurrentUser> {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (response.status === 401) {
    throw new ApiError(401, '登录已过期，请重新登录')
  }
  if (!response.ok) {
    throw new ApiError(response.status, `获取用户信息失败 (${response.status})`)
  }
  const data = await response.json()
  return data.user || data
}
