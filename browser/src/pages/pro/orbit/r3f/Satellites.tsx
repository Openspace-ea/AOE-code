/**
 * 卫星点位渲染与拾取
 *
 * 每个启用分组一个 THREE.Points：自定义 shader（圆点精灵、gl_PointSize
 * 随距离衰减、分组颜色 uniform），depthTest 开启 → 地球背面点被球体遮挡。
 * position attribute 预分配 + 原地更新，避免 GC。
 *
 * 平滑运动（借鉴 ssa 系前端的双缓冲技巧）：sync 按秒级节拍写入「上一拍/下一拍」
 * 位置缓冲，useFrame 内按仿真时钟在两拍间线性插值——高倍速下点位平滑滑动，
 * 而不是每拍跳变。LEO 一拍（60× 时 460km 弧长）的弦插值矢高偏差 ~4km，
 * 球面尺度下不可辨。
 *
 * 拾取：Raycaster（阈值按当前相机距离换算 ≈ 屏幕 8px）取最近命中，
 * 3D 下做正面过滤剔除地球背面点，点空返回 null。
 *
 * 点位挂在 earthGroup 下（本地坐标 = 地固系经纬高换算结果），随地球自转；
 * 2D 模式下 earthGroup 不旋转，点位直接按等距圆柱投影写平面坐标。
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { SatPositionItem } from '../viewTypes'
import { geoToMap, geoToScene } from '../../render/coords'

export type ViewMode = '3d' | '2d'

export interface SatellitesHandle {
  /** 全量同步点位：更新已有、新增缺失、移除消失（与 OrbitViewHandle.syncSatellites 语义一致） */
  sync: (items: SatPositionItem[], colors: Record<string, string>) => void
  /** 射线拾取：返回正面（朝向相机）的最近命中 noradId，未命中返回 null */
  pick: (raycaster: THREE.Raycaster, camera: THREE.Camera, canvasHeightPx: number) => string | null
  /** 取目标当前位置（earthGroup 本地坐标），目标不存在返回 false */
  getLocalPosition: (noradId: string, out: THREE.Vector3) => boolean
  /** 设置高亮卫星集合：null = 全部正常显示；非空 = 集合内100%，其余30% */
  setHighlight: (noradIds: Set<string> | null) => void
}

/** 单个分组的 Points 数据（容量预分配，倍增扩容） */
interface GroupEntry {
  points: THREE.Points
  geometry: THREE.BufferGeometry
  material: THREE.ShaderMaterial
  positions: Float32Array
  /** per-vertex alpha（高亮/非高亮） */
  alphas: Float32Array
  /** index → noradId */
  ids: string[]
  /** noradId → index */
  indexById: Map<string, number>
  /** 下一拍目标位置（本地系，与 index 对齐；帧循环插值的终点） */
  nextPos: [number, number, number][]
  count: number
}

const POINTS_VERTEX = /* glsl */ `
  uniform float uPixelRatio;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float scale = (6.371 * 3.0) / max(-mv.z, 0.001);
    gl_PointSize = clamp(5.0 * uPixelRatio * scale, 2.0 * uPixelRatio, 40.0);
    gl_Position = projectionMatrix * mv;
  }
`

const POINTS_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.32, d) * vAlpha;
    gl_FragColor = vec4(uColor, alpha);
  }
`

const INITIAL_CAPACITY = 256

function createGroupEntry(colorCss: string, pixelRatio: number): GroupEntry {
  const positions = new Float32Array(INITIAL_CAPACITY * 3)
  const alphas = new Float32Array(INITIAL_CAPACITY).fill(1)
  const geometry = new THREE.BufferGeometry()
  const posAttr = new THREE.BufferAttribute(positions, 3)
  posAttr.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', posAttr)
  const alphaAttr = new THREE.BufferAttribute(alphas, 1)
  alphaAttr.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('aAlpha', alphaAttr)
  geometry.setDrawRange(0, 0)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colorCss) },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: POINTS_VERTEX,
    fragmentShader: POINTS_FRAGMENT,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  return { points, geometry, material, positions, alphas, ids: [], indexById: new Map(), nextPos: [], count: 0 }
}

const _tmp = new THREE.Vector3()

interface SatellitesProps {
  mode: ViewMode
  /** 视图仿真时钟（ms，帧级平滑推进）：双缓冲插值的时间基准 */
  simClockRef: { current: number }
}

const Satellites = forwardRef<SatellitesHandle, SatellitesProps>(function Satellites(
  { mode, simClockRef },
  ref,
) {
  const groupRef = useRef<THREE.Group>(null)
  const groupsRef = useRef(new Map<string, GroupEntry>())
  const modeRef = useRef(mode)
  modeRef.current = mode
  /** 最近一次同步的数据：2D/3D 切换时原地重投影，不必等下一拍 */
  const lastSyncRef = useRef<{ items: SatPositionItem[]; colors: Record<string, string> } | null>(null)
  /** 上一拍渲染位置（noradId → 本地坐标）：插值起点 */
  const prevSceneRef = useRef(new Map<string, [number, number, number]>())
  /** 上一拍/下一拍仿真时间（ms）：插值区间 */
  const prevTimeRef = useRef<number | null>(null)
  const nextTimeRef = useRef<number>(0)
  const hasSyncedRef = useRef(false)
  const gl = useThree((s) => s.gl)

  const projectItem = (item: SatPositionItem, out: THREE.Vector3) =>
    modeRef.current === '3d'
      ? geoToScene(item.latDeg, item.lonDeg, item.altKm, out)
      : geoToMap(item.latDeg, item.lonDeg, out, 0.5)

  useImperativeHandle(
    ref,
    () => ({
      sync(items, colors) {
        lastSyncRef.current = { items, colors }
        const container = groupRef.current
        if (!container) return
        const groups = groupsRef.current

        // 插值缓冲：当前渲染位置 → prev（重建前按旧索引抄出）
        const prevMap = prevSceneRef.current
        prevMap.clear()
        if (hasSyncedRef.current) {
          for (const entry of groups.values()) {
            for (let i = 0; i < entry.count; i++) {
              prevMap.set(entry.ids[i], [
                entry.positions[i * 3],
                entry.positions[i * 3 + 1],
                entry.positions[i * 3 + 2],
              ])
            }
          }
        }
        prevTimeRef.current = hasSyncedRef.current ? nextTimeRef.current : null
        nextTimeRef.current = simClockRef.current

        const seen = new Set<string>()
        for (const item of items) {
          seen.add(item.noradId)
          let entry = groups.get(item.group)
          if (!entry) {
            entry = createGroupEntry(colors[item.group] ?? '#4da6ff', gl.getPixelRatio())
            groups.set(item.group, entry)
            container.add(entry.points)
          }
          entry.material.uniforms.uColor.value.set(colors[item.group] ?? '#4da6ff')

          let idx = entry.indexById.get(item.noradId)
          if (idx === undefined) {
            // 新增：容量不足时倍增扩容（非每帧路径，GC 可接受）
            if (entry.count * 3 >= entry.positions.length) {
              const nextPos = new Float32Array(entry.positions.length * 2)
              nextPos.set(entry.positions)
              entry.positions = nextPos
              const pAttr = new THREE.BufferAttribute(nextPos, 3)
              pAttr.setUsage(THREE.DynamicDrawUsage)
              entry.geometry.setAttribute('position', pAttr)
              const nextAlpha = new Float32Array(entry.alphas.length * 2).fill(1)
              nextAlpha.set(entry.alphas)
              entry.alphas = nextAlpha
              const aAttr = new THREE.BufferAttribute(nextAlpha, 1)
              aAttr.setUsage(THREE.DynamicDrawUsage)
              entry.geometry.setAttribute('aAlpha', aAttr)
            }
            idx = entry.count
            entry.count += 1
            entry.ids[idx] = item.noradId
            entry.indexById.set(item.noradId, idx)
          }
          projectItem(item, _tmp)
          entry.nextPos[idx] = [_tmp.x, _tmp.y, _tmp.z]
          // 同步写入位置（首帧用；帧循环覆盖时才走插值）
          const o = idx * 3
          entry.positions[o] = _tmp.x
          entry.positions[o + 1] = _tmp.y
          entry.positions[o + 2] = _tmp.z
          const posAttr = entry.geometry.getAttribute('position') as THREE.BufferAttribute
          posAttr.needsUpdate = true
        }

        // 移除本次未出现的目标（分组被关闭或传播失败）：swap-remove
        for (const entry of groups.values()) {
          for (let i = entry.count - 1; i >= 0; i--) {
            const removedId = entry.ids[i]
            if (seen.has(removedId)) continue
            const last = entry.count - 1
            if (i !== last) {
              entry.ids[i] = entry.ids[last]
              entry.indexById.set(entry.ids[i], i)
              entry.nextPos[i] = entry.nextPos[last]
              entry.alphas[i] = entry.alphas[last]
            }
            entry.indexById.delete(removedId)
            entry.count -= 1
          }
          entry.nextPos.length = entry.count
          entry.geometry.setDrawRange(0, entry.count)
        }
        hasSyncedRef.current = true
      },

      pick(raycaster, camera, canvasHeightPx) {
        // 拾取阈值 ≈ 屏幕 8px，按当前相机距离/缩放换算成世界单位
        if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
          const cam = camera as THREE.PerspectiveCamera
          const dist = camera.position.length()
          raycaster.params.Points.threshold =
            (2 * dist * Math.tan((cam.fov * Math.PI) / 360) * 8) / canvasHeightPx
        } else {
          // 正交相机（2D）：drei OrthographicCamera 视锥以像素为单位，世界/像素 = 1/zoom
          raycaster.params.Points.threshold = 8 / (camera as THREE.OrthographicCamera).zoom
        }
        const objects: THREE.Object3D[] = []
        for (const entry of groupsRef.current.values()) {
          if (entry.count > 0) objects.push(entry.points)
        }
        if (objects.length === 0) return null
        const hits = raycaster.intersectObjects(objects, false)
        for (const hit of hits) {
          // 正面过滤：剔除地球背面点（dot(radial, toCamera) > 0 才有效）
          if (modeRef.current === '3d') {
            _a.copy(hit.point).normalize()
            _b.copy(camera.position).sub(hit.point).normalize()
            if (_a.dot(_b) <= 0) continue
          }
          for (const entry of groupsRef.current.values()) {
            if (entry.points === hit.object && hit.index !== undefined) {
              return entry.ids[hit.index] ?? null
            }
          }
        }
        return null
      },

      getLocalPosition(noradId, out) {
        for (const entry of groupsRef.current.values()) {
          const idx = entry.indexById.get(noradId)
          if (idx !== undefined) {
            out.fromArray(entry.positions, idx * 3)
            return true
          }
        }
        return false
      },

      setHighlight(noradIds) {
        for (const entry of groupsRef.current.values()) {
          let dirty = false
          for (let i = 0; i < entry.count; i++) {
            const target = noradIds === null ? 1 : (noradIds.has(entry.ids[i]) ? 1 : 0.3)
            if (entry.alphas[i] !== target) {
              entry.alphas[i] = target
              dirty = true
            }
          }
          if (dirty) {
            const aAttr = entry.geometry.getAttribute('aAlpha') as THREE.BufferAttribute
            aAttr.needsUpdate = true
          }
        }
      },
    }),
    [gl],
  )

  // 帧循环：两拍之间按仿真时钟插值（高倍速平滑；暂停时时钟不走，点位静止）
  useFrame(() => {
    if (!hasSyncedRef.current) return
    const prevT = prevTimeRef.current
    const nextT = nextTimeRef.current
    const span = prevT !== null && nextT > prevT ? nextT - prevT : 0
    const alpha = span > 0 ? Math.min(1, Math.max(0, (simClockRef.current - prevT!) / span)) : 1
    const prevMap = prevSceneRef.current
    for (const entry of groupsRef.current.values()) {
      if (entry.count === 0) continue
      let dirty = false
      for (let i = 0; i < entry.count; i++) {
        const next = entry.nextPos[i]
        if (!next) continue
        const prev = prevMap.get(entry.ids[i])
        const o = i * 3
        if (prev && alpha < 1) {
          entry.positions[o] = prev[0] + (next[0] - prev[0]) * alpha
          entry.positions[o + 1] = prev[1] + (next[1] - prev[1]) * alpha
          entry.positions[o + 2] = prev[2] + (next[2] - prev[2]) * alpha
        } else {
          // 无上一拍（新目标/模式切换后）或插值完成：直接到位
          entry.positions[o] = next[0]
          entry.positions[o + 1] = next[1]
          entry.positions[o + 2] = next[2]
        }
        dirty = true
      }
      if (dirty) {
        ;(entry.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
      }
    }
  })

  // 2D/3D 切换：用最近一次同步数据重投影目标位置并立即到位（snap，不插值）
  useEffect(() => {
    const last = lastSyncRef.current
    if (!last) return
    for (const item of last.items) {
      const entry = groupsRef.current.get(item.group)
      const idx = entry?.indexById.get(item.noradId)
      if (!entry || idx === undefined) continue
      projectItem(item, _tmp)
      entry.nextPos[idx] = [_tmp.x, _tmp.y, _tmp.z]
    }
    prevSceneRef.current.clear()
    prevTimeRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // 卸载清理
  useEffect(
    () => () => {
      for (const entry of groupsRef.current.values()) {
        entry.points.removeFromParent()
        entry.geometry.dispose()
        entry.material.dispose()
      }
      groupsRef.current.clear()
    },
    [],
  )

  return <group ref={groupRef} />
})

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()

export default Satellites
