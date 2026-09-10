import { loadToken } from '../../../auth/client.js'
import { getInitialSettings } from '../../../utils/settings/settings.js'
import { getApiConfig } from '../../../config/aoeConfig.js'

export interface KnowledgeBaseInfo {
  name: string
  displayName: string
  description?: string
  public: boolean
  fileCount: number
}

export interface KnowledgeBaseContent {
  name: string
  expires: string
  encrypted: boolean
  data: string // base64 encrypted data
}

export interface KnowledgeListResponse {
  bases: KnowledgeBaseInfo[]
  userBases?: KnowledgeBaseInfo[]
}

function getApiUrl(): string {
  const settings = getInitialSettings()
  // 优先使用 settings 中的配置，否则使用全局配置
  return settings.knowledge?.apiUrl || getApiConfig().baseUrl
}

function getAuthHeaders(): Record<string, string> {
  const token = loadToken()
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

/**
 * Fetch the list of available knowledge bases from the server.
 * Guest users see only public bases; logged-in users also see their custom bases.
 */
export async function listBases(): Promise<KnowledgeListResponse> {
  const apiUrl = getApiUrl()
  const res = await fetch(`${apiUrl}/api/knowledge/bases`, {
    headers: {
      ...getAuthHeaders(),
    },
  })

  if (!res.ok) {
    throw new Error(`获取知识库列表失败 (${res.status})`)
  }

  return await res.json()
}

/**
 * Fetch encrypted knowledge base content from the server.
 */
export async function fetchBase(name: string): Promise<KnowledgeBaseContent> {
  const apiUrl = getApiUrl()
  const res = await fetch(`${apiUrl}/api/knowledge/bases/${encodeURIComponent(name)}`, {
    headers: {
      ...getAuthHeaders(),
    },
  })

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`知识库 "${name}" 不存在`)
    }
    if (res.status === 403) {
      throw new Error(`知识库 "${name}" 需要登录才能访问，请先执行 /login`)
    }
    throw new Error(`获取知识库 "${name}" 失败 (${res.status})`)
  }

  return await res.json()
}
