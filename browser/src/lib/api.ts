/**
 * API 请求封装
 *
 * 统一处理：Bearer 注入、{detail} 错误格式、401 清 token 跳登录。
 * 所有 services 模块经此发请求，不直接调用 fetch。
 */

import { API_BASE, ApiError, getToken, logout } from './auth'

export interface ApiFetchOptions extends RequestInit {
  /** 查询参数（拼接到 path 之后） */
  params?: Record<string, string | number>
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { params, ...init } = options

  let url = `${API_BASE}${path}`
  if (params) {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      search.append(key, String(value))
    }
    url += `?${search.toString()}`
  }

  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, { ...init, headers })

  // token 失效：清除本地 token 并跳登录页（页面即将跳转，后续错误不再重要）
  if (response.status === 401) {
    logout()
    throw new ApiError(401, '登录已过期')
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({} as { detail?: string }))
    throw new ApiError(response.status, data.detail || `请求失败 (${response.status})`)
  }

  return response.json()
}
