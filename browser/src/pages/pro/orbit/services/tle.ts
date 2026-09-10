/**
 * TLE 解析工具（数据源无关）
 *
 * 数据源见 ssaCatalog.ts（自有站点全量目录）；本模块只保留 TLE 文本/纪元解析
 * 与分组拉取结果类型，快照兜底路径也复用这里的解析。
 */

import type { SatelliteTle } from './types'

export interface GroupFetchResult {
  satellites: SatelliteTle[]
  /** 数据获取时间（ms） */
  fetchedAt: number
  /** true 表示非实时数据（来自灾难缓存或内置快照） */
  stale: boolean
  /** true 表示来自内置快照（离线兜底） */
  snapshot?: boolean
}

/**
 * 解析 TLE 文本（标准三行格式：名称行 + 两行根数）
 */
export function parseTleText(text: string, group: string): SatelliteTle[] {
  const lines = text
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)

  const result: SatelliteTle[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('1 ') && i + 1 < lines.length && lines[i + 1].startsWith('2 ')) {
      const nameLine = i > 0 && !lines[i - 1].startsWith('2 ') ? lines[i - 1].trim() : ''
      result.push({
        noradId: line.substring(2, 7).trim(),
        name: nameLine || `NORAD ${line.substring(2, 7).trim()}`,
        intlDes: line.substring(9, 17).trim(),
        group,
        tleLine1: line,
        tleLine2: lines[i + 1],
      })
      i++
    }
  }
  return result
}

/**
 * 从 TLE 第 1 行解析数据纪元（第 19-32 列：YYDDD.DDDDDDDD）
 */
export function tleEpochDate(tleLine1: string): Date | null {
  const field = tleLine1.substring(18, 32).trim()
  const yearTwo = parseInt(field.substring(0, 2), 10)
  const dayOfYear = parseFloat(field.substring(2))
  if (Number.isNaN(yearTwo) || Number.isNaN(dayOfYear)) return null
  const year = yearTwo < 57 ? 2000 + yearTwo : 1900 + yearTwo
  const epoch = new Date(Date.UTC(year, 0, 1))
  epoch.setUTCDate(epoch.getUTCDate() + Math.floor(dayOfYear) - 1)
  epoch.setUTCMilliseconds(Math.round((dayOfYear % 1) * 86400 * 1000))
  return epoch
}
