/**
 * GNC 在轨段轨道力学（纯函数，LaunchPage 仿真状态机用）
 *
 * 发射段燃尽后切到二体 RK4 传播（@gnc/core keplerianPropagateTwoBody），
 * 本模块提供根数推导、圆化与霍曼变轨的脉冲计算。
 * 简化约定（可视化仿真，非任务分析）：变轨为瞬时脉冲、不计燃料与质量变化、
 * 不计 J2/大气衰减；倾角改变在圆化点一次性完成（法向重建）。
 */

import { MU_EARTH } from '@gnc/core'

type Vec3 = [number, number, number]
/** 3×3 正交旋转矩阵（sceneCoords.makeSiteTransform 的 rot）：仿真系 → 地理系 */
type Rot3 = number[][]

/** 地球半径 m（与 @gnc/core 一致） */
export const EARTH_R_M = 6371000

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const norm = (v: Vec3) => Math.hypot(v[0], v[1], v[2])
const unit = (v: Vec3): Vec3 => {
  const n = norm(v) || 1
  return [v[0] / n, v[1] / n, v[2] / n]
}
const scale = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

/** 旋转向量（仿真系 → 地理系）；rot 缺省时原样返回 */
const applyRot = (m: Rot3 | undefined, v: Vec3): Vec3 =>
  m
    ? [
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
      ]
    : v

/** 逆旋转（地理系 → 仿真系）：正交矩阵转置 */
const applyRotT = (m: Rot3, v: Vec3): Vec3 => [
  m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
  m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
  m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2],
]

export interface OrbitParams {
  semiMajorKm: number
  eccentricity: number
  apogeeKm: number
  perigeeKm: number
  periodMin: number
  inclinationDeg: number
}

/** 由状态向量推导轨道根数（传 rot 则在地理系计算——仿真系发射场在 +Z 极点，
 *  直接计算会得到 ~90° 的假倾角；遥测显示与轨道面操作都应在地理系进行） */
export function elementsFromState(r: Vec3, v: Vec3, rot?: Rot3): OrbitParams {
  const rg = applyRot(rot, r)
  const vg = applyRot(rot, v)
  const rm = norm(rg)
  const vm = norm(vg)
  const a = 1 / (2 / rm - (vm * vm) / MU_EARTH)
  const h = cross(rg, vg)
  const hm = norm(h)
  // 偏心率矢量 e = (v×h)/μ − r̂
  const vh = cross(vg, h)
  const eVec = sub(scale(vh, 1 / MU_EARTH), unit(rg))
  const e = norm(eVec)
  return {
    semiMajorKm: a / 1000,
    eccentricity: e,
    apogeeKm: (a * (1 + e) - EARTH_R_M) / 1000,
    perigeeKm: (a * (1 - e) - EARTH_R_M) / 1000,
    periodMin: (2 * Math.PI * Math.sqrt(Math.abs(a) ** 3 / MU_EARTH)) / 60,
    inclinationDeg: (Math.acos(Math.max(-1, Math.min(1, h[2] / hm))) * 180) / Math.PI,
  }
}

/** 径向速度（r·v；符号变化标识远/近地点通过） */
export function radialRate(r: Vec3, v: Vec3): number {
  return dot(r, v)
}

/**
 * 圆化/入面：在当前位置给出目标圆轨道速度向量（仿真系）。
 * 不传倾角则保持当前轨道面（沿当地速度切向）；传倾角则在地理系重建轨道面后
 * 旋回仿真系（构造见函数内注释，目标面必须经过当前位置矢量）。
 * rot 为仿真系→地理系旋转（makeSiteTransform），做倾角操作时必传。
 */
export function circularVelocity(r: Vec3, v: Vec3, inclinationDeg?: number, rot?: Rot3): Vec3 {
  const rm = norm(r)
  const vCirc = Math.sqrt(MU_EARTH / rm)
  const rHat = unit(r)
  if (inclinationDeg === undefined || !rot) {
    return scale(unit(sub(v, scale(rHat, dot(rHat, v)))), vCirc)
  }
  // 地理系下重建轨道面：「法向锥 ∩ 位置法平面」约束构造（目标面必须经过当前
  // 位置矢量）：n = a·m1 + b·m2，a = cos i / w 受当前赤纬可行性约束
  //（|赤纬| ≤ i），超出时取最接近目标面的可行解；两候选取与当前切向更顺行的
  const rHatG = unit(applyRot(rot, r))
  const vg = applyRot(rot, v)
  const tangentialG = unit(sub(vg, scale(rHatG, dot(rHatG, vg))))
  const zAxis: Vec3 = [0, 0, 1]
  const i = (inclinationDeg * Math.PI) / 180
  const m1raw = sub(zAxis, scale(rHatG, dot(rHatG, zAxis)))
  const w = norm(m1raw)
  if (w < 1e-9) {
    // 正好在极点上方：保持当前面
    return scale(unit(sub(v, scale(rHat, dot(rHat, v)))), vCirc)
  }
  const m1 = scale(m1raw, 1 / w)
  const m2 = unit(cross(rHatG, m1))
  const a = Math.max(-1, Math.min(1, Math.cos(i) / w))
  const b = Math.sqrt(Math.max(0, 1 - a * a))
  const nA: Vec3 = [a * m1[0] + b * m2[0], a * m1[1] + b * m2[1], a * m1[2] + b * m2[2]]
  const nB: Vec3 = [a * m1[0] - b * m2[0], a * m1[1] - b * m2[1], a * m1[2] - b * m2[2]]
  const vA = unit(cross(unit(nA), rHatG))
  const vB = unit(cross(unit(nB), rHatG))
  const vNewG = scale(dot(vA, tangentialG) >= dot(vB, tangentialG) ? vA : vB, vCirc)
  return applyRotT(rot, vNewG)
}

/**
 * 霍曼转移第一段脉冲后的速度（在当前位置施加，沿当前速度方向缩放）。
 * 适用前提：当前轨道近似圆（在轨巡航态满足）。
 */
export function hohmannDepartureVelocity(r: Vec3, v: Vec3, targetRadiusM: number): Vec3 {
  const r1 = norm(r)
  const aT = (r1 + targetRadiusM) / 2
  const vTransfer = Math.sqrt(MU_EARTH * (2 / r1 - 1 / aT))
  return scale(unit(v), vTransfer)
}
