/**
 * 计费服务（API 文档 §四）
 */

import { apiFetch } from '../lib/api'
import type { Balance } from './types'

/** 点数余额 */
export function getBalance(): Promise<Balance> {
  return apiFetch('/v1/billing/balance')
}
