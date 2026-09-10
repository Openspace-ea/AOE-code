/**
 * 轨道线渲染（选中 / 悬停共用）
 *
 * 3D = 惯性系轨道环（orbitRing，场景世界坐标，propagator.sampleOrbitInertial
 * 逐点走与卫星点位相同的映射管线，环精确穿过点位轨迹、圈间闭合无漂移），
 * 渲染时须挂在旋转组之外（世界系）。
 * 2D = 星下点轨迹（orbit，等距圆柱投影，按 180° 经线断裂分段）。
 * 颜色由调用方按星座分组传入。
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import type { GeoPosition } from '../services/types'
import type { ViewMode } from './Satellites'
import { geoToMap } from '../../render/coords'

interface OrbitLineProps {
  /** 星下点轨迹采样点（2D 用）；null 或不足 2 点不渲染 */
  orbit: GeoPosition[] | null
  /** 惯性系 ECI 采样点（3D 轨道环用，单位 km）；缺省时 3D 不渲染 */
  orbitRing?: [number, number, number][] | null
  mode: ViewMode
  /** 分组色 */
  color: string
  lineWidth?: number
  opacity?: number
}

export function OrbitLine({
  orbit,
  orbitRing,
  mode,
  color,
  lineWidth = 2,
  opacity = 0.9,
}: OrbitLineProps) {
  const segments = useMemo(() => {
    if (mode === '3d') {
      if (!orbitRing || orbitRing.length < 2) return []
      // 惯性轨道环已是场景世界坐标（propagator.sampleOrbitInertial），直接用
      return [orbitRing.map(([x, y, z]) => new THREE.Vector3(x, y, z))]
    }
    if (!orbit || orbit.length < 2) return []
    const segments: THREE.Vector3[][] = []
    let current: THREE.Vector3[] = []
    let prevLon: number | null = null
    for (const p of orbit) {
      if (prevLon !== null && Math.abs(p.lonDeg - prevLon) > 180 && current.length > 1) {
        segments.push(current)
        current = []
      }
      current.push(geoToMap(p.latDeg, p.lonDeg, new THREE.Vector3(), 0.5))
      prevLon = p.lonDeg
    }
    if (current.length > 1) segments.push(current)
    return segments
  }, [orbit, orbitRing, mode])

  if (segments.length === 0) return null
  return (
    <>
      {segments.map((points, i) => (
        <Line
          key={i}
          points={points}
          color={color}
          lineWidth={lineWidth}
          transparent
          opacity={opacity}
        />
      ))}
    </>
  )
}
