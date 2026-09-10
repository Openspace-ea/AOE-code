/**
 * 知识库服务
 */

import api from './api'

export interface KnowledgeBase {
  id: string
  name: string
  display_name?: string
  description?: string
  kb_type: string
  is_public: boolean
  file_count: number
  total_size: number
  status: string
}

export interface KnowledgeFile {
  name: string
  size: number
  type: string
}

export interface SearchResult {
  kb_name: string
  file_path: string
  excerpt: string
  score: number
}

export const knowledgeService = {
  /**
   * 获取知识库列表
   */
  async list(): Promise<KnowledgeBase[]> {
    const result = await api.getKnowledgeBases()
    if (result.success) {
      return (result.data as any).bases || []
    }
    throw new Error(result.error)
  },

  /**
   * 获取知识库详情
   */
  async get(name: string): Promise<{ base: KnowledgeBase, files: KnowledgeFile[] }> {
    const result = await api.getKnowledgeBase(name)
    if (result.success) {
      return result.data as any
    }
    throw new Error(result.error)
  },

  /**
   * 搜索知识库
   */
  async search(query: string, base?: string): Promise<SearchResult[]> {
    const result = await api.searchKnowledge(query, base)
    if (result.success) {
      return (result.data as any).results || []
    }
    throw new Error(result.error)
  }
}

export default knowledgeService