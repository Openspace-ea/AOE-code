/**
 * 配置模块 - CLI 和 Desktop 共享
 *
 * 使用前必须通过 ConfigLoader 注入实际的 API 地址，
 * 或在宿主应用中设置环境变量。
 */

export interface AoeConfig {
  api: {
    baseUrl: string
    timeout: number
  }
  auth: {
    baseUrl: string
    loginPath: string
    registerPath: string
    logoutPath: string
    userinfoPath: string
    refreshPath: string
  }
  knowledge: {
    apiUrl: string
  }
  telemetry: {
    enabled: boolean
    url: string
  }
}

/** 默认配置 — API 地址为空，必须由宿主应用注入 */
const DEFAULT_CONFIG: AoeConfig = {
  api: {
    baseUrl: '', // 必填：如 'https://api.example.com'
    timeout: 30000,
  },
  auth: {
    baseUrl: '', // 必填：同 api.baseUrl
    loginPath: '/api/auth/login',
    registerPath: '/api/auth/register',
    logoutPath: '/api/auth/logout',
    userinfoPath: '/api/auth/me',
    refreshPath: '/api/auth/refresh',
  },
  knowledge: {
    apiUrl: '', // 必填：如 'https://knowledge.example.com'
  },
  telemetry: {
    enabled: false, // 默认关闭遥测
    url: '',
  },
}

export class ConfigLoader {
  private config: AoeConfig

  constructor(config: Partial<AoeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  getConfig(): AoeConfig {
    return { ...this.config }
  }

  getApiConfig() {
    return this.config.api
  }

  getAuthConfig() {
    return this.config.auth
  }

  getKnowledgeConfig() {
    return this.config.knowledge
  }

  getTelemetryConfig() {
    return this.config.telemetry
  }
}
