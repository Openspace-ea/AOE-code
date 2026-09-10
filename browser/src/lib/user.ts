/**
 * 当前登录用户 Context
 *
 * 用户在 App 登录门禁处校验后注入，布局与页面经 useUser() 读取。
 */

import { createContext, useContext } from 'react'
import type { CurrentUser } from './auth'

const UserContext = createContext<CurrentUser | null>(null)

export const UserProvider = UserContext.Provider

export function useUser(): CurrentUser {
  const user = useContext(UserContext)
  if (!user) {
    throw new Error('useUser 必须在 UserProvider 内使用')
  }
  return user
}
