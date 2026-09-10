/**
 * 星座分组定义
 *
 * key 为本地分组标识，对应 ssaCatalog.ts 的 GROUP_RULES 筛选规则
 * （数据源：ssa.aseem.cn 全量 TLE 目录，前端按名称规则 + PAYLOAD 过滤筛选）；
 * 分组口径对齐参考产品（ssa1.aseem.cn）：空间站 + 主流导航/通信星座。
 * 目标类型（PAYLOAD/ROCKET BODY/DEBRIS）由目录数据自带（SatelliteTle.objectType）。
 */

export interface OrbitGroup {
  /** 本地分组标识（ssaCatalog.ts GROUP_RULES 的键） */
  key: string
  /** 中文显示名 */
  label: string
  /** 展示色（点位与轨道线） */
  color: string
  /** 该星座的典型轨道高度 km（用于自适应最远缩放：能看到完整星座为度） */
  orbitAltKm: number
}

export const ORBIT_GROUPS: OrbitGroup[] = [
  { key: 'stations', label: '空间站', color: '#3ae0d8', orbitAltKm: 400 },
  { key: 'starlink', label: 'StarLink', color: '#4da6ff', orbitAltKm: 550 },
  // 北斗含 GEO/IGSO 高轨成员（35786km），按最高成员算
  { key: 'beidou', label: '北斗', color: '#ff6b6b', orbitAltKm: 35786 },
  { key: 'gps', label: 'GPS', color: '#7c5cff', orbitAltKm: 20200 },
  { key: 'glonass', label: 'GLONASS', color: '#ffa94d', orbitAltKm: 19100 },
  { key: 'galileo', label: 'GALILEO', color: '#22c55e', orbitAltKm: 23222 },
  { key: 'iridium', label: 'Iridium', color: '#f5d90a', orbitAltKm: 780 },
  { key: 'oneweb', label: 'OneWeb', color: '#e06fb8', orbitAltKm: 1200 },
  { key: 'rocket_body', label: '火箭残骸', color: '#ff922b', orbitAltKm: 1000 },
  { key: 'debris', label: '碎片', color: '#868e96', orbitAltKm: 800 },
]

export function getGroup(key: string): OrbitGroup | undefined {
  return ORBIT_GROUPS.find((g) => g.key === key)
}
