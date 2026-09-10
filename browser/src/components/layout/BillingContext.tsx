/**
 * 点数余额 Context
 *
 * AppLayout 挂载时拉取一次余额；对话页发送消息后调用 refresh() 刷新。
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { getBalance } from '../../services/billing'
import type { Balance } from '../../services/types'

interface BillingState {
  balance: Balance | null
  refresh: () => void
}

const BillingContext = createContext<BillingState | null>(null)

export function BillingProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<Balance | null>(null)

  const refresh = useCallback(() => {
    // 余额拉取失败（如网络抖动）静默处理，保留旧值
    getBalance()
      .then(setBalance)
      .catch(() => {})
  }, [])

  useEffect(refresh, [refresh])

  return <BillingContext.Provider value={{ balance, refresh }}>{children}</BillingContext.Provider>
}

export function useBilling(): BillingState {
  const state = useContext(BillingContext)
  if (!state) {
    throw new Error('useBilling 必须在 BillingProvider 内使用')
  }
  return state
}
