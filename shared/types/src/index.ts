/**
 * AOE Code 共享类型定义
 */

// 用户类型
export interface User {
  id: string
  email: string
  username: string
  name?: string
  avatar?: string
  role?: string
  aoe_points?: number
}

// 卫星类型
export interface Satellite {
  id: string
  name: string
  orbit_type: 'LEO' | 'MEO' | 'GEO' | 'HEO'
  country?: string
  status: 'active' | 'inactive' | 'decayed'
  period?: number
  inclination?: number
}

// 知识库类型
export interface KnowledgeBase {
  id: string
  name: string
  description?: string
  kb_type: 'data' | 'domain' | 'company' | 'overview'
  file_count: number
  total_size: number
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: {
    code: string
    message: string
  }
}
