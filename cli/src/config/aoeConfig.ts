/**
 * AOE Code 配置加载器
 *
 * 从 aoe-config.json 加载配置，支持环境变量覆盖
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// 配置文件路径
const CONFIG_FILE_NAMES = ['aoe-config.json', 'aoe-config.local.json']

// 配置接口定义
export interface AoeApiConfig {
  baseUrl: string
  timeout: number
  retryCount: number
}

export interface AoeAuthConfig {
  provider: string
  baseUrl: string
  loginPath: string
  registerPath: string
  logoutPath: string
  userinfoPath: string
  refreshPath: string
}

export interface AoeMcpConfig {
  proxyUrl: string
  proxyPath: string
  registryUrl: string
}

export interface AoeKnowledgeConfig {
  apiUrl: string
  localPaths: string[]
}

export interface AoePluginsConfig {
  marketplaceUrl: string
  downloadUrl: string
}

export interface AoeTelemetryConfig {
  enabled: boolean
  url: string
  endpoint: string
}

export interface AoeProductConfig {
  name: string
  version: string
  website: string
  docs: string
  support: string
  github: string
}

export interface AoeContactConfig {
  email: string
  website: string
}

export interface AoeConfig {
  version: string
  description: string
  api: AoeApiConfig
  auth: AoeAuthConfig
  mcp: AoeMcpConfig
  knowledge: AoeKnowledgeConfig
  plugins: AoePluginsConfig
  telemetry: AoeTelemetryConfig
  product: AoeProductConfig
  contact: AoeContactConfig
  blockedDomains: string[]
}

// 默认配置
const DEFAULT_CONFIG: AoeConfig = {
  version: '1.0',
  description: 'AOE Code 默认配置',
  api: {
    baseUrl: 'https://api.aoecode.cn',
    timeout: 30000,
    retryCount: 3,
  },
  auth: {
    provider: 'aoe',
    baseUrl: 'https://api.aoecode.cn',
    loginPath: '/auth/login',
    registerPath: '/auth/register',
    logoutPath: '/auth/logout',
    userinfoPath: '/auth/me',
    refreshPath: '/auth/refresh',
  },
  mcp: {
    proxyUrl: 'https://mcp.aoecode.cn',
    proxyPath: '/v1/mcp/{server_id}',
    registryUrl: 'https://api.aoecode.cn/mcp-registry/v0/servers',
  },
  knowledge: {
    apiUrl: 'https://knowledge.aoecode.cn',
    localPaths: ['~/.aoe/knowledge', './knowledge', './dist/knowledge'],
  },
  plugins: {
    marketplaceUrl: 'https://api.aoecode.cn/plugins/marketplace',
    downloadUrl: 'https://api.aoecode.cn/plugins/download',
  },
  telemetry: {
    enabled: true,
    url: 'https://telemetry.aoecode.cn',
    endpoint: '/api/metrics',
  },
  product: {
    name: 'AOE Code',
    version: '0.0.5',
    website: 'https://aoecode.cn',
    docs: 'https://docs.aoecode.cn',
    support: 'https://support.aoecode.cn',
    github: 'https://github.com/aoecode/aoe-code',
  },
  contact: {
    email: 'support@aoecode.cn',
    website: 'https://aoecode.cn',
  },
  blockedDomains: ['anthropic.com', 'claude.ai', 'claude.com', 'spacemapp.cn'],
}

// 配置缓存
let configCache: AoeConfig | null = null

/**
 * 获取配置文件搜索路径
 */
function getConfigSearchPaths(): string[] {
  const paths: string[] = []

  // 1. 当前工作目录
  for (const name of CONFIG_FILE_NAMES) {
    paths.push(join(process.cwd(), name))
  }

  // 2. 用户配置目录
  const homeDir = homedir()
  for (const name of CONFIG_FILE_NAMES) {
    paths.push(join(homeDir, '.aoe', name))
  }

  // 3. 可执行文件目录
  try {
    if (process.execPath) {
      const execDir = join(process.execPath, '..')
      for (const name of CONFIG_FILE_NAMES) {
        paths.push(join(execDir, name))
      }
    }
  } catch {}

  return paths
}

/**
 * 从文件加载配置
 */
function loadConfigFromFile(filePath: string): Partial<AoeConfig> | null {
  try {
    if (!existsSync(filePath)) {
      return null
    }
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * 深度合并配置
 */
function mergeConfigs(base: AoeConfig, override: Partial<AoeConfig>): AoeConfig {
  const result = { ...base }

  for (const key of Object.keys(override) as Array<keyof AoeConfig>) {
    if (override[key] !== undefined) {
      if (typeof override[key] === 'object' && !Array.isArray(override[key]) && override[key] !== null) {
        result[key] = { ...result[key], ...override[key] } as any
      } else {
        result[key] = override[key] as any
      }
    }
  }

  return result
}

/**
 * 应用环境变量覆盖
 */
function applyEnvOverrides(config: AoeConfig): AoeConfig {
  const result = { ...config }

  // API 配置
  if (process.env.AOE_API_URL) {
    result.api.baseUrl = process.env.AOE_API_URL
  }

  // 认证配置
  if (process.env.SPACEMAP_AUTH_URL) {
    result.auth.spacemap.baseUrl = process.env.SPACEMAP_AUTH_URL
  }
  if (process.env.SPACEMAP_CLIENT_ID) {
    result.auth.spacemap.clientId = process.env.SPACEMAP_CLIENT_ID
  }
  if (process.env.SPACEMAP_CLIENT_SECRET) {
    result.auth.spacemap.clientSecret = process.env.SPACEMAP_CLIENT_SECRET
  }

  // MCP 配置
  if (process.env.AOE_MCP_PROXY_URL) {
    result.mcp.proxyUrl = process.env.AOE_MCP_PROXY_URL
  }
  if (process.env.AOE_MCP_REGISTRY_URL) {
    result.mcp.registryUrl = process.env.AOE_MCP_REGISTRY_URL
  }

  // 知识库配置
  if (process.env.AOE_KNOWLEDGE_URL) {
    result.knowledge.apiUrl = process.env.AOE_KNOWLEDGE_URL
  }

  // 插件配置
  if (process.env.AOE_PLUGINS_URL) {
    result.plugins.marketplaceUrl = process.env.AOE_PLUGINS_URL
  }

  // 遥测配置
  if (process.env.AOE_TELEMETRY_URL) {
    if (process.env.AOE_TELEMETRY_URL === 'disabled') {
      result.telemetry.enabled = false
    } else {
      result.telemetry.url = process.env.AOE_TELEMETRY_URL
    }
  }
  if (process.env.AOE_TELEMETRY_ENABLED) {
    result.telemetry.enabled = process.env.AOE_TELEMETRY_ENABLED !== 'false'
  }

  return result
}

/**
 * 加载配置（带缓存）
 */
export function loadAoeConfig(): AoeConfig {
  if (configCache) {
    return configCache
  }

  // 从默认配置开始
  let config = { ...DEFAULT_CONFIG }

  // 尝试从文件加载配置
  const searchPaths = getConfigSearchPaths()
  for (const filePath of searchPaths) {
    const fileConfig = loadConfigFromFile(filePath)
    if (fileConfig) {
      config = mergeConfigs(config, fileConfig)
      break
    }
  }

  // 应用环境变量覆盖
  config = applyEnvOverrides(config)

  // 缓存配置
  configCache = config

  return config
}

/**
 * 获取 API 配置
 */
export function getApiConfig(): AoeApiConfig {
  return loadAoeConfig().api
}

/**
 * 获取认证配置
 */
export function getAuthConfig(): AoeAuthConfig {
  return loadAoeConfig().auth
}

/**
 * 获取太空地图 OAuth 配置
 */
export function getSpacemapConfig(): AoeAuthSpacemapConfig {
  return loadAoeConfig().auth.spacemap
}

/**
 * 获取 MCP 配置
 */
export function getMcpConfig(): AoeMcpConfig {
  return loadAoeConfig().mcp
}

/**
 * 获取知识库配置
 */
export function getKnowledgeConfig(): AoeKnowledgeConfig {
  return loadAoeConfig().knowledge
}

/**
 * 获取插件配置
 */
export function getPluginsConfig(): AoePluginsConfig {
  return loadAoeConfig().plugins
}

/**
 * 获取遥测配置
 */
export function getTelemetryConfig(): AoeTelemetryConfig {
  return loadAoeConfig().telemetry
}

/**
 * 获取产品配置
 */
export function getProductConfig(): AoeProductConfig {
  return loadAoeConfig().product
}

/**
 * 获取联系配置
 */
export function getContactConfig(): AoeContactConfig {
  return loadAoeConfig().contact
}

/**
 * 获取屏蔽域名列表
 */
export function getBlockedDomains(): string[] {
  return loadAoeConfig().blockedDomains
}

/**
 * 清除配置缓存（用于测试）
 */
export function clearConfigCache(): void {
  configCache = null
}

/**
 * 重新加载配置
 */
export function reloadConfig(): AoeConfig {
  clearConfigCache()
  return loadAoeConfig()
}
