/**
 * AOE Code 认证客户端
 *
 * 使用 AOE Code 自己的后端认证系统
 * 配置从 aoe-config.json 加载
 */

import { readFileSync, writeFileSync, unlinkSync, mkdirSync, chmodSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { platform } from 'process'
import http from 'node:http'
import net from 'node:net'
import { exec } from 'node:child_process'
import { getApiConfig, getAuthConfig } from '../config/aoeConfig.js'
import { debug, debugObject } from '../utils/debugLog.js'

const AUTH_DIR = join(homedir(), '.aoe')
const TOKEN_FILE = join(AUTH_DIR, 'auth-token')
const REFRESH_TOKEN_FILE = join(AUTH_DIR, 'auth-refresh-token')

export interface User {
  id: string
  email: string
  username: string
  name?: string
  avatar?: string
  role?: string
  aoe_points?: number
}

export interface AuthResult {
  token: string
  refreshToken?: string
  user: User
  expiresIn?: number
}

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope?: string
}

/**
 * 保存 Token 到本地文件
 */
export function saveToken(token: string): void {
  try {
    mkdirSync(AUTH_DIR, { recursive: true })
  } catch {}
  writeFileSync(TOKEN_FILE, token, 'utf-8')

  if (platform !== 'win32') {
    try {
      chmodSync(TOKEN_FILE, 0o600)
    } catch {}
  }
}

/**
 * 保存 Refresh Token 到本地文件
 */
export function saveRefreshToken(refreshToken: string): void {
  try {
    mkdirSync(AUTH_DIR, { recursive: true })
  } catch {}
  writeFileSync(REFRESH_TOKEN_FILE, refreshToken, 'utf-8')

  if (platform !== 'win32') {
    try {
      chmodSync(REFRESH_TOKEN_FILE, 0o600)
    } catch {}
  }
}

/**
 * 从本地文件加载 Token
 */
export function loadToken(): string | null {
  try {
    return readFileSync(TOKEN_FILE, 'utf-8').trim() || null
  } catch {
    return null
  }
}

/**
 * 从本地文件加载 Refresh Token
 */
export function loadRefreshToken(): string | null {
  try {
    return readFileSync(REFRESH_TOKEN_FILE, 'utf-8').trim() || null
  } catch {
    return null
  }
}

/**
 * 清除本地 Token
 */
export function clearToken(): void {
  try {
    unlinkSync(TOKEN_FILE)
  } catch {}
  try {
    unlinkSync(REFRESH_TOKEN_FILE)
  } catch {}
}

/**
 * 用户登录
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  const authConfig = getAuthConfig()
  const apiConfig = getApiConfig()
  const loginUrl = `${apiConfig.baseUrl}${authConfig.loginPath}`

  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `登录失败 (${response.status})`)
  }

  const data = await response.json()

  // 保存 Token
  saveToken(data.token)
  if (data.refresh_token) {
    saveRefreshToken(data.refresh_token)
  }

  return {
    token: data.token,
    refreshToken: data.refresh_token,
    user: data.user,
    expiresIn: data.expires_in,
  }
}

/**
 * 用户注册
 */
export async function register(email: string, username: string, password: string): Promise<AuthResult> {
  const authConfig = getAuthConfig()
  const apiConfig = getApiConfig()
  const registerUrl = `${apiConfig.baseUrl}${authConfig.registerPath}`

  const response = await fetch(registerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, username, password }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `注册失败 (${response.status})`)
  }

  const data = await response.json()

  // 保存 Token
  saveToken(data.token)
  if (data.refresh_token) {
    saveRefreshToken(data.refresh_token)
  }

  return {
    token: data.token,
    refreshToken: data.refresh_token,
    user: data.user,
    expiresIn: data.expires_in,
  }
}

/**
 * 使用 Refresh Token 刷新 Access Token
 */
export async function refreshAccessToken(): Promise<AuthResult> {
  const refreshToken = loadRefreshToken()
  if (!refreshToken) {
    throw new Error('No refresh token available')
  }

  const authConfig = getAuthConfig()
  const apiConfig = getApiConfig()
  const refreshUrl = `${apiConfig.baseUrl}${authConfig.refreshPath}`

  const response = await fetch(refreshUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `Token 刷新失败 (${response.status})`)
  }

  const data = await response.json()

  // 保存新 Token
  saveToken(data.access_token)
  if (data.refresh_token) {
    saveRefreshToken(data.refresh_token)
  }

  return {
    token: data.access_token,
    refreshToken: data.refresh_token,
    user: data.user,
    expiresIn: data.expires_in,
  }
}

/**
 * 获取当前用户信息
 */
export async function getMe(token?: string): Promise<User> {
  const accessToken = token || loadToken()
  if (!accessToken) {
    throw new Error('未登录，请先执行 /login')
  }

  const authConfig = getAuthConfig()
  const apiConfig = getApiConfig()
  const userinfoUrl = `${apiConfig.baseUrl}${authConfig.userinfoPath}`

  const response = await fetch(userinfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      clearToken()
      throw new Error('登录已过期，请重新执行 /login')
    }
    throw new Error(`获取用户信息失败 (${response.status})`)
  }

  const data = await response.json()
  return data.user || data
}

/**
 * 用户登出
 */
export async function logout(): Promise<void> {
  const token = loadToken()
  if (token) {
    try {
      const authConfig = getAuthConfig()
      const apiConfig = getApiConfig()
      const logoutUrl = `${apiConfig.baseUrl}${authConfig.logoutPath}`

      await fetch(logoutUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    } catch {
      // Ignore network errors on logout
    }
  }
  clearToken()
}

/**
 * 检查是否已登录
 */
export function isLoggedIn(): boolean {
  return loadToken() !== null
}

/**
 * 获取一个可用端口
 */
export function getAvailablePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port
      server.close(() => resolve(port))
    })
  })
}

/**
 * 创建本地回调服务器
 */
export function createCallbackServer(port: number) {
  let tokenResolve: (token: string) => void
  const tokenPromise = new Promise<string>((resolve) => {
    tokenResolve = resolve
  })

  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, `http://127.0.0.1:${port}`)
    debug('auth:callback', `收到请求: ${req.method} ${req.url}`)
    debug('auth:callback', `URL pathname: ${url.pathname}`)
    debugObject('auth:callback', { params: Object.fromEntries(url.searchParams) })

    if (url.pathname === '/auth/callback') {
      const token = url.searchParams.get('token')
      debug('auth:callback', `Token: ${token ? '已收到' : '未收到'}`)

      if (token) {
        // 返回成功页面
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>登录成功</title></head>
          <body style="font-family:system-ui;text-align:center;padding:80px 20px;background:#0a0a1a;color:#e0e0e0">
            <h1 style="font-size:48px;margin-bottom:16px">✅</h1>
            <h2>登录成功</h2>
            <p style="color:#888;margin-top:8px">可以关闭此页面，返回终端继续使用。</p>
          </body>
          </html>
        `)
        server.close()
        tokenResolve!(token)
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<h1>❌ 缺少 token 参数</h1>')
      }
    } else {
      res.writeHead(404)
      res.end('Not Found')
    }
  })

  server.listen(port, '127.0.0.1')
  return { server, tokenPromise }
}

/**
 * 跨平台打开浏览器
 */
export function openBrowser(url: string) {
  const cmd = process.platform === 'win32' ? 'start ""'
    : process.platform === 'darwin' ? 'open'
    : 'xdg-open'
  exec(`${cmd} "${url}"`)
}

/**
 * 延迟
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 通过浏览器登录（统一登录流程）
 *
 * 1. 启动本地 HTTP 服务器
 * 2. 打开浏览器到登录页
 * 3. 等待回调接收 token
 * 4. 验证并保存
 */
export async function loginViaBrowser(): Promise<{ token: string; user: User }> {
  // 1. 获取可用端口
  const port = await getAvailablePort()

  // 2. 启动本地服务器
  const { server, tokenPromise } = createCallbackServer(port)

  // 3. 打开浏览器
  const callbackUrl = encodeURIComponent(`http://127.0.0.1:${port}/auth/callback`)
  // 使用环境变量配置登录页面地址，默认为生产环境
  const loginPageUrl = process.env.AOE_LOGIN_PAGE_URL || 'https://www.aoecode.cn'
  debug('auth:login', `AOE_LOGIN_PAGE_URL: ${process.env.AOE_LOGIN_PAGE_URL}`)
  debug('auth:login', `loginPageUrl: ${loginPageUrl}`)
  const loginUrl = `${loginPageUrl}/login?callback=${callbackUrl}`

  debug('auth:login', '正在打开浏览器登录...')
  openBrowser(loginUrl)

  // 4. 等待回调（5 分钟超时）
  const token = await Promise.race([
    tokenPromise,
    sleep(5 * 60 * 1000).then(() => {
      throw new Error('登录超时（5 分钟），请重试')
    }),
  ])

  // 5. 验证 token
  const user = await getMe(token)

  // 6. 保存 token
  saveToken(token)

  return { token, user }
}
