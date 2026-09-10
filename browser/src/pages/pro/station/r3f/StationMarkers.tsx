/**
 * 测控仿真 3D 标记组件
 *
 * - 地面站：蓝色小球 + 名称标签（可点击选中）
 * - 卫星：青色小球 + SGP4 实时位置（可点击选中，选中后显示轨道线）
 * - 相机聚焦：飞到目标正上方俯视
 * - 轨道线：选中卫星时用 sampleOrbit 采样 + drei Line 渲染
 */

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { geoToScene, EARTH_R_SCENE } from '../../render/coords'
import { createSatRecord, propagateAt, sampleOrbit, orbitElements } from '../../orbit/services/propagator'
import type { SatelliteConfig, GroundStation } from '../services/stationTypes'
import type { SatelliteTle } from '../../orbit/services/types'

const _radial = new THREE.Vector3()
const _toCam = new THREE.Vector3()

// ============ 地面站标记 ============

function StationMarker({
  station,
  selected,
  onSelect,
}: {
  station: GroundStation
  selected?: boolean
  onSelect?: () => void
}) {
  const pos = useMemo(() => geoToScene(station.lat, station.lon, 0), [station.lat, station.lon])
  const labelRef = useRef<HTMLDivElement>(null)
  const camera = useThree((s) => s.camera)

  useFrame(() => {
    if (!labelRef.current) return
    _radial.copy(pos).normalize()
    _toCam.copy(camera.position).sub(pos).normalize()
    labelRef.current.style.opacity = _radial.dot(_toCam) > 0.1 ? '1' : '0'
  })

  const color = selected ? '#ffa94d' : '#ff8c42'  // 地面站：橙色
  return (
    <group position={pos}>
      <mesh onClick={(e) => { e.stopPropagation(); onSelect?.() }}>
        <sphereGeometry args={[selected ? 0.04 : 0.03, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* 选中时加光晕 */}
      {selected && (
        <mesh>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} />
        </mesh>
      )}
      <Html zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div
          ref={labelRef}
          style={{
            fontSize: '12px',
            color,
            whiteSpace: 'nowrap',
            textShadow: '0 0 6px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)',
            fontWeight: selected ? '600' : '400',
            transform: 'translate(-50%, -100%) translateY(-8px)',
            pointerEvents: 'none',
          }}
        >
          {station.name}
        </div>
      </Html>
    </group>
  )
}

// ============ 卫星标记（SGP4 实时传播） ============

function SatelliteMarker({
  config,
  selected,
  onSelect,
}: {
  config: SatelliteConfig
  selected?: boolean
  onSelect?: () => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const camera = useThree((s) => s.camera)

  const satRecord = useMemo(() => {
    if (config.orbitType !== 'TLE' || !config.line1 || !config.line2) return null
    try {
      const tle: SatelliteTle = {
        noradId: config.line1.substring(2, 7).trim(),
        name: config.name,
        intlDes: '',
        group: '',
        tleLine1: config.line1,
        tleLine2: config.line2,
        objectType: 'PAYLOAD',
      }
      return createSatRecord(tle)
    } catch {
      return null
    }
  }, [config])

  const initialPos = useMemo(() => {
    if (satRecord) {
      const geo = propagateAt(satRecord, new Date())
      if (geo) return geoToScene(geo.latDeg, geo.lonDeg, geo.altKm)
    }
    return new THREE.Vector3(EARTH_R_SCENE + 0.5, 0, 0)
  }, [satRecord])

  useFrame(() => {
    if (!groupRef.current) return
    if (satRecord) {
      const geo = propagateAt(satRecord, new Date())
      if (geo) {
        const target = geoToScene(geo.latDeg, geo.lonDeg, geo.altKm)
        groupRef.current.position.lerp(target, 0.3)
      }
    }
    if (labelRef.current) {
      const p = groupRef.current.position
      _radial.copy(p).normalize()
      _toCam.copy(camera.position).sub(p).normalize()
      labelRef.current.style.opacity = _radial.dot(_toCam) > 0.1 ? '1' : '0'
    }
  })

  const color = selected ? '#ffa94d' : '#00e5ff'  // 卫星：亮青色
  return (
    <group ref={groupRef} position={initialPos}>
      <mesh onClick={(e) => { e.stopPropagation(); onSelect?.() }}>
        <sphereGeometry args={[selected ? 0.035 : 0.025, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* 选中时加光晕 */}
      {selected && (
        <mesh>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} />
        </mesh>
      )}
      <Html zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div
          ref={labelRef}
          style={{
            fontSize: '11px',
            color,
            whiteSpace: 'nowrap',
            textShadow: '0 0 6px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)',
            fontWeight: selected ? '600' : '400',
            transform: 'translate(-50%, -100%) translateY(-8px)',
            pointerEvents: 'none',
          }}
        >
          {config.name}
        </div>
      </Html>
    </group>
  )
}

// ============ 选中卫星轨道线 ============

function OrbitLine({ config }: { config: SatelliteConfig }) {
  const points = useMemo(() => {
    if (config.orbitType !== 'TLE' || !config.line1 || !config.line2) return null
    try {
      const tle: SatelliteTle = {
        noradId: config.line1.substring(2, 7).trim(),
        name: config.name,
        intlDes: '',
        group: '',
        tleLine1: config.line1,
        tleLine2: config.line2,
        objectType: 'PAYLOAD',
      }
      const rec = createSatRecord(tle)
      if (!rec) return null
      return sampleOrbit(rec, new Date(), 180, 1.05).map(
        (p) => geoToScene(p.latDeg, p.lonDeg, p.altKm).toArray() as [number, number, number],
      )
    } catch {
      return null
    }
  }, [config])

  if (!points || points.length < 2) return null
  return <Line points={points} color="#3ae0d8" lineWidth={1.5} opacity={0.6} transparent />
}

// ============ 相机聚焦 ============

function CameraFocus({
  target,
  onFocused,
}: {
  target: { lat: number; lon: number; alt: number } | null
  onFocused?: () => void
}) {
  const { camera } = useThree()
  const targetPosRef = useRef<THREE.Vector3 | null>(null)
  const startPosRef = useRef(new THREE.Vector3())
  const progressRef = useRef(0)

  useEffect(() => {
    if (target) {
      targetPosRef.current = geoToScene(target.lat, target.lon, target.alt)
      startPosRef.current.copy(camera.position)
      progressRef.current = 0
    }
  }, [target])

  useFrame(() => {
    if (!targetPosRef.current) return
    progressRef.current = Math.min(1, progressRef.current + 0.02)

    // 相机飞到目标正上方俯视
    const objPos = targetPosRef.current
    const camPos = objPos.clone().normalize().multiplyScalar(EARTH_R_SCENE * 2.8)

    const t = progressRef.current
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    camera.position.lerpVectors(startPosRef.current, camPos, ease)
    camera.lookAt(objPos)

    if (progressRef.current >= 1) {
      targetPosRef.current = null
      onFocused?.()
    }
  })

  return null
}

// ============ 导出 ============

/** 供 StationPage 构建详情面板的数据 */
export interface SelectedObjectInfo {
  type: 'station' | 'satellite'
  name: string
  /** 地面站坐标 */
  station?: GroundStation
  /** 卫星配置 */
  satellite?: SatelliteConfig
  /** 卫星轨道根数（TLE 推导） */
  orbitInfo?: {
    periodMin: number
    inclinationDeg: number
    eccentricity: number
    apogeeKm: number
    perigeeKm: number
    meanMotionRevPerDay: number
    raanDeg: number
    argPerigeeDeg: number
    meanAnomalyDeg: number
  }
  /** 实时位置 */
  livePosition?: { latDeg: number; lonDeg: number; altKm: number; velocityKmS: number }
}

interface StationMarkersProps {
  stations: GroundStation[]
  selectedStationId?: string
  satellites: SatelliteConfig[]
  selectedSatelliteId?: string
  focusTarget?: { lat: number; lon: number; alt: number } | null
  onFocused?: () => void
  onSelectStation?: (id: string) => void
  onSelectSatellite?: (id: string) => void
}

export default function StationMarkers({
  stations,
  selectedStationId,
  satellites,
  selectedSatelliteId,
  focusTarget,
  onFocused,
  onSelectStation,
  onSelectSatellite,
}: StationMarkersProps) {
  // 选中的卫星配置
  const selectedSat = satellites.find((s) => s.id === selectedSatelliteId)

  return (
    <group>
      {stations.map((s) => (
        <StationMarker
          key={s.id}
          station={s}
          selected={s.id === selectedStationId}
          onSelect={() => onSelectStation?.(s.id)}
        />
      ))}
      {satellites.map((s) => (
        <SatelliteMarker
          key={s.id}
          config={s}
          selected={s.id === selectedSatelliteId}
          onSelect={() => onSelectSatellite?.(s.id)}
        />
      ))}
      {selectedSat && <OrbitLine config={selectedSat} />}
      {focusTarget && <CameraFocus target={focusTarget} onFocused={onFocused} />}
    </group>
  )
}

// ============ 辅助：从 TLE 构建 SatelliteTle ============

export function configToTle(config: SatelliteConfig): SatelliteTle | null {
  if (config.orbitType !== 'TLE' || !config.line1 || !config.line2) return null
  return {
    noradId: config.line1.substring(2, 7).trim(),
    name: config.name,
    intlDes: '',
    group: '',
    tleLine1: config.line1,
    tleLine2: config.line2,
    objectType: 'PAYLOAD',
  }
}

/** 从卫星配置获取实时位置 + 轨道根数 */
export function getSatelliteInfo(config: SatelliteConfig): SelectedObjectInfo {
  const info: SelectedObjectInfo = { type: 'satellite', name: config.name, satellite: config }
  if (config.orbitType !== 'TLE' || !config.line1 || !config.line2) return info
  try {
    const tle: SatelliteTle = {
      noradId: config.line1.substring(2, 7).trim(),
      name: config.name,
      intlDes: '',
      group: '',
      tleLine1: config.line1,
      tleLine2: config.line2,
      objectType: 'PAYLOAD',
    }
    const rec = createSatRecord(tle)
    if (!rec) return info
    const elements = orbitElements(rec)
    info.orbitInfo = {
      periodMin: elements.periodMin,
      inclinationDeg: elements.inclinationDeg,
      eccentricity: elements.eccentricity,
      apogeeKm: elements.apogeeKm,
      perigeeKm: elements.perigeeKm,
      meanMotionRevPerDay: elements.meanMotionRevPerDay,
      raanDeg: elements.raanDeg,
      argPerigeeDeg: elements.argPerigeeDeg,
      meanAnomalyDeg: elements.meanAnomalyDeg,
    }
    const geo = propagateAt(rec, new Date())
    if (geo) info.livePosition = geo
  } catch {
    // 传播失败，仅返回基本信息
  }
  return info
}

/** 从地面站构建详情信息 */
export function getStationInfo(station: GroundStation): SelectedObjectInfo {
  return { type: 'station', name: station.name, station }
}
