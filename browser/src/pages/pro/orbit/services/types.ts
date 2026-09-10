/**
 * 轨道模式数据层类型定义
 */

/** 一颗航天器的 TLE 数据（来自数据源，当前为 ssa.aseem.cn 全量目录） */
export interface SatelliteTle {
  /** NORAD 编号（如 "25544"） */
  noradId: string
  /** 名称（如 "ISS (ZARYA)"） */
  name: string
  /** 国际标识符（如 "1998-067A"） */
  intlDes: string
  /** 所属分组标识（OrbitGroup.key） */
  group: string
  tleLine1: string
  tleLine2: string
  /** 目标类型（PAYLOAD / ROCKET BODY / DEBRIS，SSA 目录提供；快照数据无此字段） */
  objectType?: string
}

/** 某时刻的地理位置（传播结果） */
export interface GeoPosition {
  latDeg: number
  lonDeg: number
  /** 海拔高度 km */
  altKm: number
  /** 速度 km/s */
  velocityKmS: number
}

/** 轨道根数（由 TLE 推导，详情面板展示用） */
export interface OrbitElements {
  /** 周期 min */
  periodMin: number
  /** 倾角 deg */
  inclinationDeg: number
  eccentricity: number
  /** 远地点 km */
  apogeeKm: number
  /** 近地点 km */
  perigeeKm: number
  /** 平运动 rev/day */
  meanMotionRevPerDay: number
  /** 升交点赤经 deg */
  raanDeg: number
  /** 近地点幅角 deg */
  argPerigeeDeg: number
  /** 平近点角 deg */
  meanAnomalyDeg: number
  /** BSTAR 大气阻尼系数（TLE 一阶导数项） */
  bstar: number
}
