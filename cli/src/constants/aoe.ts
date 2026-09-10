/**
 * AOE Code 自有端点配置
 *
 * 从 aoe-config.json 加载配置，支持环境变量覆盖
 * 所有对外连接都通过 AOE 自己的服务器，不再连接 Anthropic/Claude
 */

import {
  loadAoeConfig,
  getApiConfig,
  getAuthConfig,
  getMcpConfig,
  getKnowledgeConfig,
  getPluginsConfig,
  getTelemetryConfig,
  getProductConfig,
  getContactConfig,
  getBlockedDomains,
} from '../config/aoeConfig.js'

// 加载配置
const config = loadAoeConfig()

// AOE API 端点（向后兼容）
export const AOE_API_BASE_URL = config.api.baseUrl

// AOE 认证端点（向后兼容）
export const AOE_AUTH_URL = config.auth.baseUrl

// AOE MCP 代理（向后兼容）
export const AOE_MCP_PROXY_URL = config.mcp.proxyUrl

// AOE 知识库 API（向后兼容）
export const AOE_KNOWLEDGE_URL = config.knowledge.apiUrl

// AOE 遥测端点（向后兼容）
export const AOE_TELEMETRY_URL = config.telemetry.url
export const AOE_TELEMETRY_ENABLED = config.telemetry.enabled

// AOE 认证配置（向后兼容）
export const AOE_AUTH_CONFIG = {
  // 认证端点
  LOGIN_URL: `${config.api.baseUrl}${config.auth.loginPath}`,
  REGISTER_URL: `${config.api.baseUrl}${config.auth.registerPath}`,
  LOGOUT_URL: `${config.api.baseUrl}${config.auth.logoutPath}`,
  USERINFO_URL: `${config.api.baseUrl}${config.auth.userinfoPath}`,
  REFRESH_URL: `${config.api.baseUrl}${config.auth.refreshPath}`,

  // MCP 代理
  MCP_PROXY_URL: config.mcp.proxyUrl,
  MCP_PROXY_PATH: config.mcp.proxyPath,
} as const

// AOE 产品信息（向后兼容）
export const AOE_PRODUCT_INFO = config.product

// AOE 联系方式（向后兼容）
export const AOE_CONTACT = config.contact

// 屏蔽域名列表（向后兼容）
export const BLOCKED_DOMAINS = config.blockedDomains

// 导出配置获取函数（推荐使用）
export {
  loadAoeConfig,
  getApiConfig,
  getAuthConfig,
  getMcpConfig,
  getKnowledgeConfig,
  getPluginsConfig,
  getTelemetryConfig,
  getProductConfig,
  getContactConfig,
  getBlockedDomains,
}
