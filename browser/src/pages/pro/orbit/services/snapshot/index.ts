/**
 * 内置 TLE 快照（离线兜底数据源）
 *
 * 当 ssa.aseem.cn 目录不可达（网络受限/跨域未配置）且无 Cache Storage
 * 灾难缓存时，使用本快照保证轨道模式可用。快照数据时效性以 SNAPSHOT_DATE
 * 为准，界面需标注。
 *
 * 覆盖分组：stations / beidou / galileo；其余分组（gps、glonass、
 * iridium、starlink、oneweb）仅在目录接口可达时可用。
 */

import stationsRaw from './stations.tle?raw'
import beidouRaw from './beidou.tle?raw'
import galileoRaw from './galileo.tle?raw'

/** 快照采集日期（TLE 数据纪元约为采集当日） */
export const SNAPSHOT_DATE = '2026-08-05'

export const SNAPSHOT_TLE: Record<string, string> = {
  stations: stationsRaw,
  beidou: beidouRaw,
  galileo: galileoRaw,
}

export function hasSnapshot(group: string): boolean {
  return group in SNAPSHOT_TLE
}

export function getSnapshot(group: string): string | null {
  return SNAPSHOT_TLE[group] ?? null
}
