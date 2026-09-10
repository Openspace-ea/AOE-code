/**
 * GNC R3F 视图的坐标换算（GNC 业务映射，S3 迁移后保留）
 *
 * 仿真惯性系（初始位置 [R,0,0]，gnc-core 的 thrustVector 以 +Z 为"上"，
 * 发射场必须在 +Z 上）→ 发射场地理坐标 → three.js 场景坐标。
 * makeSiteTransform 按发射场经纬度生成固定旋转（Rodrigues），换场即重建；
 * 地理映射忽略飞行期地球自转（沿用已下线 GncCesiumView 的约定）。
 * 场景比例常量取自共享底座 render/coords.ts（1 单位 = 1000 km，地球半径
 * 6.371）；本文件是 GNC 特有约定，render/coords.ts 头注释即指向本文件，
 * 不并入共享底座。
 */

import * as THREE from 'three'
import { EARTH_R_SCENE } from '../../render/coords'

const EARTH_R_M = 6371000

/** 发射场变换：固定旋转矩阵 + 发射场场景坐标 */
export interface SiteTransform {
  /** 3×3 旋转矩阵（仿真系 → 发射场所在经纬方向） */
  rot: number[][]
  /** 发射场场景坐标（仿真系 [0,0,R] 的映射结果） */
  padScene: THREE.Vector3
}

/** 仿真系 [0,0,1] → 目标经纬方向的固定旋转矩阵（Rodrigues） */
function computeRot(latDeg: number, lonDeg: number): number[][] {
  const lat = (latDeg * Math.PI) / 180
  const lon = (lonDeg * Math.PI) / 180
  const b = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
  const a = [0, 0, 1]
  const v = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const s = Math.hypot(v[0], v[1], v[2])
  if (s < 1e-12) {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]
  }
  const k = (1 - c) / (s * s)
  const vx = [
    [0, -v[2], v[1]],
    [v[2], 0, -v[0]],
    [-v[1], v[0], 0],
  ]
  const vx2 = vx.map((row) => [
    row[0] * vx[0][0] + row[1] * vx[1][0] + row[2] * vx[2][0],
    row[0] * vx[0][1] + row[1] * vx[1][1] + row[2] * vx[2][1],
    row[0] * vx[0][2] + row[1] * vx[1][2] + row[2] * vx[2][2],
  ])
  return [
    [1 + k * vx2[0][0], k * vx2[0][1] - v[2], k * vx2[0][2] + v[1]],
    [k * vx2[1][0] + v[2], 1 + k * vx2[1][1], k * vx2[1][2] - v[0]],
    [k * vx2[2][0] - v[1], k * vx2[2][1] + v[0], 1 + k * vx2[2][2]],
  ]
}

/** 仿真位置 → three.js 场景坐标（Y 轴向上），经发射场固定旋转 */
export function simToSceneWith(rot: number[][], r: [number, number, number]): THREE.Vector3 {
  const x = rot[0][0] * r[0] + rot[0][1] * r[1] + rot[0][2] * r[2]
  const y = rot[1][0] * r[0] + rot[1][1] * r[1] + rot[1][2] * r[2]
  const z = rot[2][0] * r[0] + rot[2][1] * r[1] + rot[2][2] * r[2]
  const mag = Math.hypot(x, y, z)
  const lat = Math.asin(z / mag)
  const lon = Math.atan2(y, x)
  const radius = EARTH_R_SCENE + (mag - EARTH_R_M) / 1e6
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  )
}

/** 按发射场经纬度构建变换（发射场 = 仿真系 [0,0,R]，与 gnc-core +Z-up 约定一致） */
export function makeSiteTransform(latDeg: number, lonDeg: number): SiteTransform {
  const rot = computeRot(latDeg, lonDeg)
  return { rot, padScene: simToSceneWith(rot, [0, 0, EARTH_R_M]) }
}
