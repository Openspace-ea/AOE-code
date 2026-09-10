/**
 * useApi Hook - API 调用封装
 */

import { useState, useCallback } from 'react'
import { ApiClient, ConfigLoader } from '@aoe/core'

const configLoader = new ConfigLoader()
const config = configLoader.getConfig()

export function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getToken = () => localStorage.getItem('aoe-token')

  const apiClient = new ApiClient({
    baseUrl: config.api.baseUrl,
    getToken,
  })

  const request = useCallback(async <T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ) => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiClient.request<T>(method, path, body, params)
      if (!result.success) {
        setError(result.error?.message || '请求失败')
      }
      return result
    } catch (err: any) {
      setError(err.message)
      return { success: false, error: { code: 'ERROR', message: err.message } }
    } finally {
      setLoading(false)
    }
  }, [])

  const get = useCallback(<T>(path: string, params?: Record<string, string>) => {
    return request<T>('GET', path, undefined, params)
  }, [request])

  const post = useCallback(<T>(path: string, body?: unknown) => {
    return request<T>('POST', path, body)
  }, [request])

  const put = useCallback(<T>(path: string, body?: unknown) => {
    return request<T>('PUT', path, body)
  }, [request])

  const del = useCallback(<T>(path: string) => {
    return request<T>('DELETE', path)
  }, [request])

  return {
    loading,
    error,
    get,
    post,
    put,
    del,
  }
}
