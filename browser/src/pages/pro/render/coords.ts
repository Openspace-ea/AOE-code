/**
 * 专业场景共享渲染底座：坐标 / 单位 / 时间换算（单点定义，上提自 orbit/r3f/sceneCoords.ts）
 *
 * 场景比例：1 单位 = 1000 km（与 GNC 场景一致），地球半径 6.371。
 * three.js 为 Y-up 右手系，地理经纬高（地固系）→ 场景坐标约定：
 *
 *   lat, lon（弧度），r = (6371 + altKm) / 1000
 *   x = r·cos(lat)·cos(lon)
 *   y = r·sin(lat)
 *   z = -r·cos(lat)·sin(lon)
 *
 * 即本初子午线朝 +X，东经向 -Z 增长，北极朝 +Y。
 * 地球、卫星点位、轨道线都挂在旋转组（绕 Y 自转）之下，以上坐标
 * 即旋转组本地坐标；世界（惯性）坐标 = rotY(GMST) · 本地坐标。
 *
 * 【S3 参考】GNC 发射场约定与上不同：gnc-core 仿真系发射场位于 [0,0,R]
 * （thrustVector 以 +Z 为"上"），GNC 视图经固定旋转把它映射到卡纳维拉尔角
 * 方向（详见 gnc/r3f/sceneCoords.ts 头部注释）。迁移
 * GNC 时注意两套坐标约定的差异。
 */

import * as THREE from 'three'

/** 场景比例：1 单位 = 1000 km，地球半径 6.371 */
export const EARTH_R_SCENE = 6.371
/** 相机最近距离（距地心，场景单位）：半径 + 约 300km——再近就穿入球体，不允许 */
export const MIN_DISTANCE = EARTH_R_SCENE + 0.3

/**
 * 球体纹理对齐校准常量（mesh.rotation.y，弧度）。
 *
 * three.js SphereGeometry 的 UV：u=0 位于 (-1,0,0) 经线、u 增大转向 +Z；
 * 等距圆柱贴图（Blue Marble 标准布局）u=0 为西经 180°、左到右经度递增。
 * 代入上面的经纬约定（东经向 -Z）逐点验证：
 *   u=0    → 方向 (-1,0,0) → 场景经度 ±180° = 贴图左缘 ✓
 *   u=0.25 → 方向 (0,0,+1) → 场景经度 -90°  = 贴图西经 90° ✓
 *   u=0.5  → 方向 (+1,0,0) → 场景经度 0°    = 本初子午线 ✓
 * 二者天然对齐（本初子午线与赤道交点恰落在贴图 (0°,0°) 像素），故校准量为 0。
 * 后续换贴图若出现固定经度偏转，只需改这一个常量（星球预设的 textureOffsetY 引用它）。
 */
export const EARTH_TEXTURE_OFFSET_Y = 0

/** 地理经纬高 → 旋转组本地场景坐标 */
export function geoToScene(
  latDeg: number,
  lonDeg: number,
  altKm: number,
  out: THREE.Vector3 = new THREE.Vector3(),
): THREE.Vector3 {
  const lat = (latDeg * Math.PI) / 180
  const lon = (lonDeg * Math.PI) / 180
  const r = EARTH_R_SCENE + altKm / 1000
  return out.set(
    r * Math.cos(lat) * Math.cos(lon),
    r * Math.sin(lat),
    -r * Math.cos(lat) * Math.sin(lon),
  )
}

/** 2D 平面地图尺寸：把地球表面「展开」——宽 = 赤道周长，高 = 赤道半周长（宽高比 2:1） */
export const MAP_W = 2 * Math.PI * EARTH_R_SCENE
export const MAP_H = Math.PI * EARTH_R_SCENE

/** 经纬 → 2D 平面坐标（等距圆柱投影，z 由调用方指定） */
export function geoToMap(
  latDeg: number,
  lonDeg: number,
  out: THREE.Vector3 = new THREE.Vector3(),
  z = 0,
): THREE.Vector3 {
  return out.set((lonDeg / 180) * (MAP_W / 2), (latDeg / 90) * (MAP_H / 2), z)
}

/** 格林尼治平恒星时（弧度）：旋转组 rotation.y = gmstRad(simTimeMs)，可视化精度足够 */
export function gmstRad(timeMs: number): number {
  const jd = timeMs / 86400000 + 2440587.5
  const d = jd - 2451545.0
  const deg = (280.46061837 + 360.98564736629 * d) % 360
  return (((deg < 0 ? deg + 360 : deg) * Math.PI) / 180)
}
