/**
 * 测控仿真场景类型定义
 *
 * 与后端 ast__visibility_analysis / ast__orbit_calculate 工具参数对齐。
 */

// ============ 基础类型 ============

/** 后端 OrbitTime 格式（UTC） */
export interface OrbitTime {
  year: number
  month: number
  day: number
  hour: number
  min: number
  sec: number
}

// ============ 场景对象 ============

/** 地面站 */
export interface GroundStation {
  id: string
  name: string
  /** 经度（东经正，西经负） */
  lon: number
  /** 纬度（北纬正，南纬负） */
  lat: number
  /** 海拔（km） */
  alt: number
}

/** 卫星轨道配置 */
export interface SatelliteConfig {
  id: string
  name: string
  orbitType: 'TLE' | 'KEPLER'
  /** TLE 第一行（orbitType=TLE 时必填） */
  line1?: string
  /** TLE 第二行（orbitType=TLE 时必填） */
  line2?: string
  /** 开普勒六根数（orbitType=KEPLER 时必填） */
  oe?: OrbitElements
}

/** 开普勒六根数 */
export interface OrbitElements {
  /** 半长轴（m） */
  a: number
  /** 偏心率 */
  e: number
  /** 轨道倾角（deg） */
  i: number
  /** 升交点赤经（deg） */
  xw: number
  /** 近拱点角距（deg） */
  dw: number
  /** 平近点角（deg） */
  M: number
}

/** 仰角约束 */
export interface ElevationConstraint {
  /** 最小仰角（deg），默认 10 */
  minElevation: number
  /** 方位角最小值（deg），默认 0 */
  azimuthMin: number
  /** 方位角最大值（deg），默认 360 */
  azimuthMax: number
}

// ============ 可见性计算结果 ============

/** AER 参数（方位角/仰角/斜距） */
export interface AERPoint {
  azimuthDegrees: number
  elevationDegrees: number
  rangeMeters: number
}

/** 可见窗口（单次过境） */
export interface VisibilityWindow {
  startTime: OrbitTime
  endTime: OrbitTime
  durationSeconds: number
  entry: AERPoint
  exit: AERPoint
  middle: AERPoint
  minimumRangeMeters: number
}

/** 可见性分析结果 */
export interface VisibilityResult {
  windows: VisibilityWindow[]
  /** 计算的时间范围 */
  timeRange: { start: OrbitTime; end: OrbitTime }
  /** 关联的地面站名 */
  stationName: string
  /** 关联的卫星名 */
  satelliteName: string
  /** 计算时间戳 */
  computedAt: number
}

// ============ 场景配置 ============

/** 测控仿真场景 */
export interface StationScene {
  id: string
  name: string
  stations: GroundStation[]
  satellites: SatelliteConfig[]
  constraint: ElevationConstraint
  /** 最近一次计算结果 */
  lastResult?: VisibilityResult
  createdAt: number
  updatedAt: number
}

// ============ 预设地面站 ============

export interface PresetStation {
  name: string
  lon: number
  lat: number
  alt: number
  /** 说明（如城市） */
  city?: string
}

/** 常见测控站/发射场坐标 */
export const PRESET_STATIONS: PresetStation[] = [
  { name: '北京测控站', lon: 116.4, lat: 39.9, alt: 0.05, city: '北京' },
  { name: '喀什测控站', lon: 76.0, lat: 39.5, alt: 1.3, city: '喀什' },
  { name: '三亚测控站', lon: 109.5, lat: 18.3, alt: 0.01, city: '三亚' },
  { name: '佳木斯测控站', lon: 130.3, lat: 46.8, alt: 0.1, city: '佳木斯' },
  { name: '乌鲁木齐测控站', lon: 87.6, lat: 43.8, alt: 0.9, city: '乌鲁木齐' },
  { name: '青岛测控站', lon: 120.4, lat: 36.1, alt: 0.02, city: '青岛' },
]

/** 默认约束 */
export const DEFAULT_CONSTRAINT: ElevationConstraint = {
  minElevation: 10,
  azimuthMin: 0,
  azimuthMax: 360,
}
