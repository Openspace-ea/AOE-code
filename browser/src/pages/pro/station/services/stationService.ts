/**
 * 测控仿真服务（本地可见性分析 + 卫星搜索）
 *
 * 可见性分析使用 satellite.js 在前端本地计算，不依赖后端 AST 接口。
 * 卫星搜索复用 ssaCatalog 轨道目录数据源。
 */

import * as satellite from 'satellite.js'
import type {
  GroundStation,
  SatelliteConfig,
  ElevationConstraint,
  OrbitTime,
  VisibilityResult,
  VisibilityWindow,
} from './stationTypes'

// ============ 本地可见性分析（satellite.js） ============

/** OrbitTime → Date (UTC) */
function orbitTimeToDate(t: OrbitTime): Date {
  return new Date(Date.UTC(t.year, t.month - 1, t.day, t.hour, t.min, Math.floor(t.sec)))
}

/** Date → OrbitTime (UTC) */
function dateToOrbitTime(d: Date): OrbitTime {
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    min: d.getUTCMinutes(),
    sec: d.getUTCSeconds() + d.getUTCMilliseconds() / 1000,
  }
}

/** 地面站经纬高 → ECI 地心坐标（km） */
function stationEci(latDeg: number, lonDeg: number, altKm: number, date: Date): { x: number; y: number; z: number } {
  const gmst = satellite.gstime(date)
  const latRad = (latDeg * Math.PI) / 180
  const lonRad = (lonDeg * Math.PI) / 180
  const a = 6378.137 // 地球赤道半径 km
  const f = 1 / 298.257223563
  const e2 = 2 * f - f * f
  const sinLat = Math.sin(latRad)
  const cosLat = Math.cos(latRad)
  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat)
  const x = (N + altKm) * cosLat * Math.cos(lonRad)
  const y = (N + altKm) * cosLat * Math.sin(lonRad)
  const z = (N * (1 - e2) + altKm) * sinLat
  // ECEF → ECI（绕 Z 轴旋转 GMST）
  const cosG = Math.cos(gmst)
  const sinG = Math.sin(gmst)
  return { x: x * cosG - y * sinG, y: x * sinG + y * cosG, z }
}

/** ECI 相对位置 → AER（方位角°、仰角°、距离m） */
function eciToAer(
  satEci: { x: number; y: number; z: number },
  stationEciPos: { x: number; y: number; z: number },
): { azimuth: number; elevation: number; range: number } {
  const dx = satEci.x - stationEciPos.x
  const dy = satEci.y - stationEciPos.y
  const dz = satEci.z - stationEciPos.z
  const range = Math.sqrt(dx * dx + dy * dy + dz * dz) * 1000 // km → m

  // 转换到站心坐标系（SEZ: South-East-Zenith）
  const lat = Math.atan2(stationEciPos.z, Math.sqrt(stationEciPos.x ** 2 + stationEciPos.y ** 2))
  const lon = Math.atan2(stationEciPos.y, stationEciPos.x)
  const sinLat = Math.sin(lat)
  const cosLat = Math.cos(lat)
  const sinLon = Math.sin(lon)
  const cosLon = Math.cos(lon)

  // ECI → SEZ
  const s = -dx * cosLat * cosLon - dy * cosLat * sinLon + dz * sinLat
  const e = -dx * sinLon + dy * cosLon
  const z = dx * sinLat * cosLon + dy * sinLat * sinLon + dz * cosLat

  const horiz = Math.sqrt(s * s + e * e)
  const elevation = (Math.atan2(z, horiz) * 180) / Math.PI
  let azimuth = (Math.atan2(e, s) * 180) / Math.PI
  if (azimuth < 0) azimuth += 360

  return { azimuth, elevation, range }
}

/** 运行星地可见性分析（本地计算） */
export async function runVisibility(
  satelliteConfig: SatelliteConfig,
  station: GroundStation,
  constraint: ElevationConstraint,
  startTime: OrbitTime,
  endTime: OrbitTime,
): Promise<VisibilityResult> {
  // 解析 TLE
  if (satelliteConfig.orbitType !== 'TLE' || !satelliteConfig.line1 || !satelliteConfig.line2) {
    throw new Error('本地可见性分析仅支持 TLE 轨道，请先从轨道目录选择卫星')
  }
  const satrec = satellite.twoline2satrec(satelliteConfig.line1, satelliteConfig.line2)
  if (!satrec || (satrec as unknown as { error?: number }).error) {
    throw new Error('TLE 数据无效，请重新选择卫星')
  }

  const stepSeconds = 60
  const startDate = orbitTimeToDate(startTime)
  const endDate = orbitTimeToDate(endTime)
  const totalSeconds = (endDate.getTime() - startDate.getTime()) / 1000
  const steps = Math.ceil(totalSeconds / stepSeconds)

  // 逐时间步计算可见性
  interface StepResult { time: Date; visible: boolean; az: number; el: number; range: number }
  const stepResults: StepResult[] = []

  for (let i = 0; i <= steps; i++) {
    const time = new Date(startDate.getTime() + i * stepSeconds * 1000)
    const pv = satellite.propagate(satrec, time)
    if (!pv || typeof pv === 'boolean' || !pv.position) {
      stepResults.push({ time, visible: false, az: 0, el: -90, range: 0 })
      continue
    }
    const posEci = pv.position as { x: number; y: number; z: number }
    const stationPos = stationEci(station.lat, station.lon, station.alt, time)
    const aer = eciToAer(posEci, stationPos)
    const visible = aer.elevation >= constraint.minElevation
      && aer.azimuth >= constraint.azimuthMin
      && aer.azimuth <= constraint.azimuthMax
    stepResults.push({ time, visible, az: aer.azimuth, el: aer.elevation, range: aer.range })
  }

  // 合并连续可见步为窗口
  const windows: VisibilityWindow[] = []
  let inWindow = false
  let entryStep: StepResult | null = null
  let midStep: StepResult | null = null
  let maxEl = -90

  for (const step of stepResults) {
    if (step.visible && !inWindow) {
      // 进入窗口
      inWindow = true
      entryStep = step
      midStep = step
      maxEl = step.el
    } else if (step.visible && inWindow) {
      // 窗口内：更新最高仰角
      if (step.el > maxEl) {
        maxEl = step.el
        midStep = step
      }
    } else if (!step.visible && inWindow) {
      // 离开窗口
      inWindow = false
      if (entryStep && midStep) {
        const prevStep = stepResults[stepResults.indexOf(step) - 1] ?? entryStep
        const duration = (prevStep.time.getTime() - entryStep.time.getTime()) / 1000
        windows.push({
          startTime: dateToOrbitTime(entryStep.time),
          endTime: dateToOrbitTime(prevStep.time),
          durationSeconds: duration,
          entry: { azimuthDegrees: entryStep.az, elevationDegrees: entryStep.el, rangeMeters: entryStep.range },
          exit: { azimuthDegrees: prevStep.az, elevationDegrees: prevStep.el, rangeMeters: prevStep.range },
          middle: { azimuthDegrees: midStep.az, elevationDegrees: midStep.el, rangeMeters: midStep.range },
          minimumRangeMeters: midStep.range,
        })
      }
      entryStep = null
      midStep = null
      maxEl = -90
    }
  }

  // 处理结束时仍在窗口内的情况
  if (inWindow && entryStep && midStep) {
    const lastStep = stepResults[stepResults.length - 1]
    const duration = (lastStep.time.getTime() - entryStep.time.getTime()) / 1000
    windows.push({
      startTime: dateToOrbitTime(entryStep.time),
      endTime: dateToOrbitTime(lastStep.time),
      durationSeconds: duration,
      entry: { azimuthDegrees: entryStep.az, elevationDegrees: entryStep.el, rangeMeters: entryStep.range },
      exit: { azimuthDegrees: lastStep.az, elevationDegrees: lastStep.el, rangeMeters: lastStep.range },
      middle: { azimuthDegrees: midStep.az, elevationDegrees: midStep.el, rangeMeters: midStep.range },
      minimumRangeMeters: midStep.range,
    })
  }

  console.log(`[Visibility] 本地计算完成: ${windows.length} 个过站窗口`)

  return {
    windows,
    timeRange: { start: startTime, end: endTime },
    stationName: station.name,
    satelliteName: satelliteConfig.name,
    computedAt: Date.now(),
  }
}

/** 获取当前 UTC 时间的 OrbitTime */
export function nowOrbitTime(): OrbitTime {
  const d = new Date()
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    min: d.getUTCMinutes(),
    sec: d.getUTCSeconds(),
  }
}

/** OrbitTime 偏移 N 小时 */
export function offsetHours(t: OrbitTime, hours: number): OrbitTime {
  const d = new Date(Date.UTC(t.year, t.month - 1, t.day, t.hour, t.min, Math.floor(t.sec)))
  d.setUTCHours(d.getUTCHours() + hours)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    min: d.getUTCMinutes(),
    sec: d.getUTCSeconds(),
  }
}

/** 格式化 OrbitTime 为可读 UTC 字符串 */
export function formatOrbitTime(t: OrbitTime): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${t.year}-${pad(t.month)}-${pad(t.day)} ${pad(t.hour)}:${pad(t.min)}:${pad(Math.floor(t.sec))}`
}

/** 格式化秒数为 Xh Xm Xs */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/** 格式化米为 km */
export function formatRange(meters: number): string {
  return (meters / 1000).toFixed(1) + ' km'
}

// ============ 卫星搜索 ============

export interface SearchedSatellite {
  name: string
  line1: string
  line2: string
}

// ============ 从轨道目录快速选择卫星（复用 ssaCatalog 数据源） ============

/** 常用星座分组（与轨道模式一致） */
export const QUICK_GROUPS = [
  { key: 'stations', label: '空间站' },
  { key: 'beidou', label: '北斗' },
  { key: 'gps', label: 'GPS' },
  { key: 'glonass', label: 'GLONASS' },
  { key: 'galileo', label: 'Galileo' },
  { key: 'starlink', label: 'StarLink' },
  { key: 'iridium', label: 'Iridium' },
  { key: 'oneweb', label: 'OneWeb' },
] as const

export type QuickGroupKey = typeof QUICK_GROUPS[number]['key']

/**
 * 从 ssaCatalog 全量目录按分组获取卫星列表
 * 复用轨道模式的 ssaCatalog 模块缓存 + 回退链
 */
export async function fetchCatalogGroup(group: string): Promise<SearchedSatellite[]> {
  const { fetchGroup } = await import('../../orbit/services/ssaCatalog')
  const result = await fetchGroup(group)
  return result.satellites.map((s) => ({
    name: s.name,
    line1: s.tleLine1,
    line2: s.tleLine2,
  }))
}

/**
 * 从 ssaCatalog 全量目录按关键词搜索卫星
 * 复用 ssaCatalog 的模块缓存，前端模糊匹配
 */
export async function searchCatalogSatellites(keyword: string, maxResults = 20): Promise<SearchedSatellite[]> {
  const { searchCatalog } = await import('../../orbit/services/ssaCatalog')
  const results = await searchCatalog(keyword, maxResults)
  return results.map((r) => ({ name: r.name, line1: r.line1, line2: r.line2 }))
}
