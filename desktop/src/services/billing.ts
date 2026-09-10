/**
 * 计费服务
 */

import api from './api'

export interface Balance {
  aoe_points: number
  plan: string
}

export interface ConsumptionRecord {
  id: number
  category: string
  item_key: string
  points: number
  input_tokens: number
  output_tokens: number
  created_at: string
}

export interface PricingConfig {
  id: number
  category: string
  item_key: string
  input_price: number
  output_price: number
  per_call_price: number
  description?: string
}

export const billingService = {
  /**
   * 获取余额
   */
  async getBalance(): Promise<Balance> {
    const result = await api.getBalance()
    if (result.success) {
      return result.data as Balance
    }
    throw new Error(result.error)
  },

  /**
   * 获取消费记录
   */
  async getConsumptionRecords(): Promise<ConsumptionRecord[]> {
    const result = await api.getConsumptionRecords()
    if (result.success) {
      return (result.data as any).records || []
    }
    throw new Error(result.error)
  },

  /**
   * 获取定价配置
   */
  async getPricing(): Promise<PricingConfig[]> {
    const result = await api.request('/v1/billing/pricing')
    if (result.success) {
      return (result.data as any).pricing || []
    }
    throw new Error(result.error)
  },

  /**
   * 计算 Token 费用
   */
  calculateCost(inputPrice: number, outputPrice: number, inputTokens: number, outputTokens: number): number {
    return (inputTokens * inputPrice + outputTokens * outputPrice) / 1000
  }
}

export default billingService