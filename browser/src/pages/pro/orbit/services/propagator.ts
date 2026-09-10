/**
 * 轨道传播封装（satellite.js：SGP4/SDP4）
 *
 * 把 TLE 编译为可复用的 SatRecord，提供任意时刻的位置/速度计算、
 * 轨道根数推导与整圈轨道采样。传播失败（如已再入衰减）返回 null，
 * 调用方负责跳过该目标。
 */

import * as satellite from 'satellite.js'
import { EARTH_R_SCENE, gmstRad } from '../../render/coords'
import type { GeoPosition, OrbitElements, SatelliteTle } from './types'

/** 地球引力常数 km³/s² 与赤道半径 km（根数推导用） */
const EARTH_MU = 398600.4418
const EARTH_R = 6371

export interface SatRecord {
  tle: SatelliteTle
  satrec: satellite.SatRec
}

/** 把 TLE 编译为传播记录；格式非法返回 null */
export function createSatRecord(tle: SatelliteTle): SatRecord | null {
  try {
    const satrec = satellite.twoline2satrec(tle.tleLine1, tle.tleLine2)
    // satellite.js 解析失败时返回带 error 字段的记录而非抛错
    if (!satrec || (satrec as unknown as { error?: number }).error) return null
    return { tle, satrec }
  } catch {
    return null
  }
}

/** 计算某时刻的星下点经纬度、高度与速度；传播失败（已衰减等）返回 null */
export function propagateAt(rec: SatRecord, date: Date): GeoPosition | null {
  const pv = satellite.propagate(rec.satrec, date)
  // propagate() 失败时 position/velocity 为 false；类型为 boolean|EciVec3，断言后使用
  if (!pv || typeof pv === 'boolean' || !pv.position || !pv.velocity) return null

  const pos = pv.position as { x: number; y: number; z: number }
  const vel = pv.velocity as { x: number; y: number; z: number }
  const gmst = satellite.gstime(date)
  const geo = satellite.eciToGeodetic(pos, gmst)
  const { x, y, z } = vel
  return {
    latDeg: satellite.degreesLat(geo.latitude),
    lonDeg: satellite.degreesLong(geo.longitude),
    altKm: geo.height,
    velocityKmS: Math.sqrt(x * x + y * y + z * z),
  }
}

/** 由 TLE 推导轨道根数（周期、倾角、远/近地点等） */
export function orbitElements(rec: SatRecord): OrbitElements {
  // satrec.no：平运动 rad/min；ecco：偏心率；inclo：倾角 rad
  const meanMotionRadPerMin = rec.satrec.no
  const periodMin = (2 * Math.PI) / meanMotionRadPerMin
  const nRadPerSec = meanMotionRadPerMin / 60
  // 由开普勒第三定律推半长轴
  const semiMajorKm = Math.cbrt(EARTH_MU / (nRadPerSec * nRadPerSec))
  const e = rec.satrec.ecco
  return {
    periodMin,
    inclinationDeg: (rec.satrec.inclo * 180) / Math.PI,
    eccentricity: e,
    apogeeKm: semiMajorKm * (1 + e) - EARTH_R,
    perigeeKm: semiMajorKm * (1 - e) - EARTH_R,
    meanMotionRevPerDay: (meanMotionRadPerMin * 1440) / (2 * Math.PI),
    raanDeg: (rec.satrec.nodeo * 180) / Math.PI,
    argPerigeeDeg: (rec.satrec.argpo * 180) / Math.PI,
    meanAnomalyDeg: (rec.satrec.mo * 180) / Math.PI,
    bstar: rec.satrec.bstar,
  }
}

/**
 * 采样轨道（用于选中/悬停目标的轨道线绘制）
 * @param count 采样点数
 * @param revolutions 圈数（1.2 = 一圈再加 20% 重叠段，便于观察轨道闭合趋势）
 */
export function sampleOrbit(
  rec: SatRecord,
  baseTime: Date,
  count = 120,
  revolutions = 1,
): GeoPosition[] {
  const { periodMin } = orbitElements(rec)
  const stepMs = (periodMin * revolutions * 60 * 1000) / count
  const points: GeoPosition[] = []
  for (let i = 0; i <= count; i++) {
    const pos = propagateAt(rec, new Date(baseTime.getTime() + i * stepMs))
    if (pos) points.push(pos)
  }
  return points
}

/**
 * 采样 3D 惯性轨道环（场景世界坐标，可直接绘制）。
 *
 * 逐点走与卫星点位完全相同的映射管线：SGP4 → eciToGeodetic → geoToScene
 * → rotY(gmst(t))——轨道环因而精确穿过卫星点位的世界轨迹，圈间闭合
 * （地固系直接画会把地球自转烘进线里，每圈偏移 ~22.5°，像轨道漂移）。
 * 注意：不可用 ECI 裸坐标替代——eciToGeodetic 的椭球换算与本底座的球面
 * 经纬映射有约 20km 级系统差，环会偏离点位。
 */
export function sampleOrbitInertial(
  rec: SatRecord,
  baseTime: Date,
  count = 120,
  revolutions = 1,
): [number, number, number][] {
  const { periodMin } = orbitElements(rec)
  const stepMs = (periodMin * revolutions * 60 * 1000) / count
  const points: [number, number, number][] = []
  for (let i = 0; i <= count; i++) {
    const t = baseTime.getTime() + i * stepMs
    const pos = propagateAt(rec, new Date(t))
    if (!pos) continue
    // 与 render/coords.ts geoToScene / gmstRad 同约定
    const lat = (pos.latDeg * Math.PI) / 180
    const lon = (pos.lonDeg * Math.PI) / 180
    const r = EARTH_R_SCENE + pos.altKm / 1000
    const lx = r * Math.cos(lat) * Math.cos(lon)
    const ly = r * Math.sin(lat)
    const lz = -r * Math.cos(lat) * Math.sin(lon)
    const a = gmstRad(t)
    points.push([lx * Math.cos(a) + lz * Math.sin(a), ly, -lx * Math.sin(a) + lz * Math.cos(a)])
  }
  return points
}
