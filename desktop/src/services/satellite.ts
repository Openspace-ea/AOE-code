/**
 * 卫星数据服务
 */

import api from './api'

export interface Satellite {
  id: string
  name: string
  international_designator?: string
  orbit_type?: string
  country?: string
  launch_date?: string
  status?: string
  period?: number
  inclination?: number
  apogee?: number
  perigee?: number
  rcs?: number
  extra_data?: Record<string, any>
}

export interface OrbitData {
  id: number
  satellite_id: string
  timestamp: string
  epoch?: string
  mean_motion?: number
  eccentricity?: number
  inclination?: number
  ra_of_asc_node?: number
  arg_of_pericenter?: number
  mean_anomaly?: number
}

export interface SatelliteQuery {
  page?: number
  limit?: number
  search?: string
  orbit_type?: string
  country?: string
  status?: string
  sort?: string
  order?: 'asc' | 'desc'
}

export const satelliteService = {
  /**
   * 获取卫星列表
   */
  async list(query?: SatelliteQuery): Promise<{ satellites: Satellite[], total: number }> {
    const params: Record<string, string> = {}
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) params[key] = String(value)
      })
    }
    const result = await api.getSatellites(params)
    if (result.success) {
      return result.data as any
    }
    throw new Error(result.error)
  },

  /**
   * 获取卫星详情
   */
  async get(id: string): Promise<Satellite> {
    const result = await api.getSatellite(id)
    if (result.success) {
      return (result.data as any).satellite
    }
    throw new Error(result.error)
  },

  /**
   * 获取卫星轨道数据
   */
  async getOrbits(id: string, params?: { start_date?: string, end_date?: string, limit?: number }): Promise<OrbitData[]> {
    const queryParams: Record<string, string> = {}
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams[key] = String(value)
      })
    }
    const result = await api.getSatelliteOrbits(id, queryParams)
    if (result.success) {
      return (result.data as any).orbits || []
    }
    throw new Error(result.error)
  },

  /**
   * 按轨道类型统计
   */
  async getStats(): Promise<Record<string, number>> {
    // 获取各类型数量
    const types = ['LEO', 'MEO', 'GEO', 'HEO']
    const stats: Record<string, number> = {}

    for (const type of types) {
      const result = await this.list({ orbit_type: type, limit: 1 })
      stats[type] = result.total
    }

    return stats
  }
}

export default satelliteService