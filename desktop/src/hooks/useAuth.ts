/**
 * 认证 Hook
 */

import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

interface User {
  id: string
  email: string
  username: string
  role: string
}

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
    error: null
  })

  // 初始化：检查本地存储的 token
  useEffect(() => {
    const token = api.getToken()
    if (token) {
      api.getMe()
        .then(result => {
          if (result.success) {
            setState({
              user: result.data as User,
              token,
              loading: false,
              error: null
            })
          } else {
            api.clearToken()
            setState({ user: null, token: null, loading: false, error: null })
          }
        })
        .catch(() => {
          api.clearToken()
          setState({ user: null, token: null, loading: false, error: null })
        })
    } else {
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [])

  // 登录
  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, error: null }))

    const result = await api.login(email, password)
    if (result.success) {
      api.setToken(result.data!.token)
      const meResult = await api.getMe()
      if (meResult.success) {
        setState({
          user: meResult.data as User,
          token: result.data!.token,
          loading: false,
          error: null
        })
        return true
      }
    }

    setState(prev => ({
      ...prev,
      loading: false,
      error: result.error || '登录失败'
    }))
    return false
  }, [])

  // 注册
  const register = useCallback(async (email: string, username: string, password: string) => {
    setState(prev => ({ ...prev, error: null }))

    const result = await api.register(email, username, password)
    if (result.success) {
      api.setToken(result.data!.token)
      const meResult = await api.getMe()
      if (meResult.success) {
        setState({
          user: meResult.data as User,
          token: result.data!.token,
          loading: false,
          error: null
        })
        return true
      }
    }

    setState(prev => ({
      ...prev,
      loading: false,
      error: result.error || '注册失败'
    }))
    return false
  }, [])

  // 登出
  const logout = useCallback(() => {
    api.clearToken()
    setState({ user: null, token: null, loading: false, error: null })
  }, [])

  return {
    ...state,
    login,
    register,
    logout,
    isAuthenticated: !!state.user
  }
}

export default useAuth