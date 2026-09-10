/**
 * 选中目标标记与跟踪
 *
 * - 高亮圆点：双层 shader 点精灵（白芯 + 青色描边环），恒定屏幕尺寸，
 *   每帧从 Satellites 读取目标实时位置（earthGroup 本地坐标），depthTest
 *   开启 → 转到地球背面自动被遮挡；名称标签（drei Html）同步隐藏。
 * - 轨道线不在本组件：由 OrbitR3fView 用 OrbitLine 在旋转组外渲染
 *   （3D 为惯性系轨道环，圈间闭合；2D 为星下点轨迹）。
 * - 跟踪：每帧把 OrbitControls.target 设为卫星世界坐标，相机保持相对偏移
 *   （相机位置 += target 位移增量）。退出跟踪由 OrbitR3fView 把 target 归位地心。
 */

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { GeoPosition } from '../services/types'
import type { SatellitesHandle, ViewMode } from './Satellites'

export interface SelectedInfo {
  noradId: string
  name: string
  orbit: GeoPosition[] | null
  /** 惯性系 ECI 采样点（3D 轨道环用，km） */
  orbitRing?: [number, number, number][] | null
  /** 分组色（轨道线用）；缺省青色 */
  color?: string
}

interface SelectedSatProps {
  selected: SelectedInfo | null
  mode: ViewMode
  satsRef: React.RefObject<SatellitesHandle>
  controlsRef: React.RefObject<any>
  earthGroupRef: React.RefObject<THREE.Group>
  followRef: React.RefObject<boolean>
}

const MARKER_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aRing;
  uniform float uPixelRatio;
  varying float vRing;
  void main() {
    vRing = aRing;
    gl_PointSize = aSize * uPixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const MARKER_FRAGMENT = /* glsl */ `
  varying float vRing;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0; // 0..1
    if (vRing > 0.5) {
      // 青色描边环
      float band = smoothstep(0.55, 0.72, d) * (1.0 - smoothstep(0.9, 1.0, d));
      if (band < 0.01) discard;
      gl_FragColor = vec4(0.227, 0.878, 0.847, band);
    } else {
      // 白芯
      if (d > 1.0) discard;
      gl_FragColor = vec4(vec3(1.0), smoothstep(1.0, 0.7, d));
    }
  }
`

const _world = new THREE.Vector3()
const _radial = new THREE.Vector3()
const _toCam = new THREE.Vector3()

export function SelectedSat({
  selected,
  mode,
  satsRef,
  controlsRef,
  earthGroupRef,
  followRef,
}: SelectedSatProps) {
  /** 标签容器：每帧同步到卫星位置（Html 投影的是父级对象的世界坐标） */
  const labelGroupRef = useRef<THREE.Group>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const modeRef = useRef(mode)
  modeRef.current = mode
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  // 双层标记点精灵：顶点 0 = 白芯（10px），顶点 1 = 青色描边环（18px）
  const marker = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0]), 3),
    )
    geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array([10, 18]), 1))
    geometry.setAttribute('aRing', new THREE.BufferAttribute(new Float32Array([0, 1]), 1))
    const material = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: gl.getPixelRatio() } },
      vertexShader: MARKER_VERTEX,
      fragmentShader: MARKER_FRAGMENT,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    })
    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    points.visible = false
    return points
  }, [gl])

  useEffect(
    () => () => {
      marker.geometry.dispose()
      ;(marker.material as THREE.Material).dispose()
    },
    [marker],
  )

  // 每帧：标记/标签跟随卫星位置；跟踪视角；目标在地球背面时隐藏标签
  useFrame(() => {
    const info = selectedRef.current
    const ok = !!(info && satsRef.current?.getLocalPosition(info.noradId, marker.position))
    marker.visible = ok
    if (labelGroupRef.current && ok) {
      labelGroupRef.current.position.copy(marker.position)
    }
    if (!ok || !info) {
      // 目标缺失（分组关闭/传播失败）：标记隐藏，标签同步隐藏
      if (labelRef.current) labelRef.current.style.opacity = '0'
      return
    }

    // 世界坐标（earthGroup 可能正在自转）
    _world.copy(marker.position)
    if (earthGroupRef.current) {
      _world.applyMatrix4(earthGroupRef.current.matrixWorld)
    }

    // 标签遮挡：标记点本身靠 depthTest 遮挡，Html 是 DOM 需手动判定
    if (modeRef.current === '3d' && labelRef.current) {
      _radial.copy(_world).normalize()
      _toCam.copy(camera.position).sub(_world).normalize()
      labelRef.current.style.opacity = _radial.dot(_toCam) > 0 ? '1' : '0'
    }

    // 跟踪：target 锁卫星世界坐标，相机保持相对偏移
    const controls = controlsRef.current
    if (followRef.current && modeRef.current === '3d' && controls) {
      _toCam.copy(_world).sub(controls.target) // 复用临时向量存位移增量
      controls.target.copy(_world)
      camera.position.add(_toCam)
      controls.update()
    }
  })

  // 轨道线已由 OrbitR3fView 在旋转组外渲染（3D 惯性系轨道环），本组件只管标记/标签/跟踪
  if (!selected) return null

  return (
    <>
      <primitive object={marker} />
      {/* 名称标签：visible 控制显隐，背面遮挡经 opacity 手动判定 */}
      <group ref={labelGroupRef} visible={false}>
        <Html zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={labelRef} className="orbit-r3f-label">
            {selected.name}
          </div>
        </Html>
      </group>
    </>
  )
}
