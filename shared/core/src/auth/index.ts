/**
 * 认证模块 - CLI 和 Desktop 共享
 */

export interface AuthConfig {
  baseUrl: string
  loginPath: string
  registerPath: string
  logoutPath: string
  userinfoPath: string
  refreshPath: string
}

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

export class AuthClient {
  private config: AuthConfig

  constructor(config: AuthConfig) {
    this.config = config
  }

  /**
   * 用户登录
   */
  async login(email: string, password: string): Promise<AuthResult> {
    const response = await fetch(`${this.config.baseUrl}${this.config.loginPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || `登录失败 (${response.status})`)
    }

    return response.json()
  }

  /**
   * 用户注册
   */
  async register(email: string, username: string, password: string): Promise<AuthResult> {
    const response = await fetch(`${this.config.baseUrl}${this.config.registerPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || `注册失败 (${response.status})`)
    }

    return response.json()
  }

  /**
   * 用户登出
   */
  async logout(token: string): Promise<void> {
    await fetch(`${this.config.baseUrl}${this.config.logoutPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }

  /**
   * 获取用户信息
   */
  async getMe(token: string): Promise<User> {
    const response = await fetch(`${this.config.baseUrl}${this.config.userinfoPath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`获取用户信息失败 (${response.status})`)
    }

    const data = await response.json()
    return data.user || data
  }

  /**
   * 刷新 Token
   */
  async refresh(refreshToken: string): Promise<AuthResult> {
    const response = await fetch(`${this.config.baseUrl}${this.config.refreshPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!response.ok) {
      throw new Error(`Token 刷新失败 (${response.status})`)
    }

    return response.json()
  }
}
