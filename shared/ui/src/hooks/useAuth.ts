/**
 * useAuth Hook - 认证状态管理
 */

import { useState, useEffect, useCallback } from 'react'
import { AuthClient, ConfigLoader } from '@aoe/core'
import type { User } from '@aoe/core'

const configLoader = new ConfigLoader()
const config = configLoader.getConfig()
const authClient = new AuthClient(config.auth)

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 初始化：检查本地存储的 token
  useEffect(() => {
    const savedToken = localStorage.getItem('aoe-token')
    if (savedToken) {
      setToken(savedToken)
      authClient.getMe(savedToken)
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('aoe-token')
          setToken(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  // 登录
  const login = useCallback(async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await authClient.login(email, password)
      localStorage.setItem('aoe-token', result.token)
      setToken(result.token)
      setUser(result.user)
      return result
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // 注册
  const register = useCallback(async (email: string, username: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await authClient.register(email, username, password)
      localStorage.setItem('aoe-token', result.token)
      setToken(result.token)
      setUser(result.user)
      return result
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // 登出
  const logout = useCallback(async () => {
    setLoading(true)
    try {
      if (token) {
        await authClient.logout(token)
      }
    } catch {
      // 忽略登出错误
    }
    localStorage.removeItem('aoe-token')
    setToken(null)
    setUser(null)
    setLoading(false)
  }, [token])

  // 刷新 Token
  const refreshToken = useCallback(async () => {
    try {
      const result = await authClient.refresh('')
      localStorage.setItem('aoe-token', result.token)
      setToken(result.token)
      setUser(result.user)
      return result
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [])

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!token,
    login,
    register,
    logout,
    refreshToken,
  }
}
