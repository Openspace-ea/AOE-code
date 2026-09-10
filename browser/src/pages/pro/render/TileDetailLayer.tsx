/**
 * 高清细节补丁层（LOD）：相机拉近时，按当前视野经纬窗口从在线瓦片源
 * 拼接区域纹理，盖在基础底图上方；拉远即移除（基础纹理已够用）。
 *
 * 设计要点：
 * - 视野窗口 → 瓦片层级 z（视野越窄 z 越高，限定 4..6 层）与瓦片范围（含 30% 外扩余量），
 *   单次最多 MAX_TILES 块，超限自动降 z——带宽与加载量有硬上限；
 * - 基础全球纹理为本地 z3 瓦片（或单张纹理），z≥4 的在线补丁才有增益；
 * - 3D 补丁为球面网格（geoToScene 逐点换算，与底球同一坐标约定，零错位），
 *   浮空 PATCH_ALT_KM + polygonOffset 防 z-fight；2D 补丁为平面；
 * - 换源/拉远/卸载时释放 GPU 纹理与几何，加载失败保持现状（旧补丁或基础纹理）。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EARTH_R_SCENE, MAP_H, MAP_W, geoToScene, geoToMap } from './coords'
import { latToMercYNorm, loadRegionalTexture, type RegionalTexture } from './tileStitch'

/** 视野检查节流（ms） */
const CHECK_INTERVAL_MS = 250
/** 3D：相机离地超过该高度（场景单位，=4000km）不启用补丁 */
const MAX_3D_ALT = 4.0
/** 2D：视野经度跨度超过该值（度）不启用补丁 */
const MAX_2D_SPAN_DEG = 100
/** 单次拼接瓦片数上限（超出自动降层级） */
const MAX_TILES = 120
/** 3D 补丁浮空高度（km，防与底球 z-fight） */
const PATCH_ALT_KM = 10
/** 2D 补丁平面高度（场景单位，压在 Map2D 平面 z=0 之上） */
const PATCH_Z_2D = 0.02

interface TileDetailLayerProps {
  mode: '3d' | '2d'
  /** 高清在线瓦片源模板（{z}/{x}/{y}）；null 表示当前底图无高清源 */
  detailSource: string | null
  controlsRef: React.RefObject<any>
  earthGroupRef: React.RefObject<THREE.Group>
}

export function TileDetailLayer({
  mode,
  detailSource,
  controlsRef,
  earthGroupRef,
}: TileDetailLayerProps) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const [patch, setPatch] = useState<RegionalTexture | null>(null)
  const lastCheckRef = useRef(0)
  const loadedKeyRef = useRef('')
  const inflightRef = useRef<string | null>(null)
  const camLocalRef = useRef(new THREE.Vector3())

  // 换源：清空已加载补丁（新源第一次视野检查会重新拉取）
  useEffect(() => {
    loadedKeyRef.current = ''
    setPatch(null)
  }, [detailSource])

  useFrame(() => {
    if (!detailSource) return
    const now = performance.now()
    if (now - lastCheckRef.current < CHECK_INTERVAL_MS) return
    lastCheckRef.current = now

    // 1) 当前视野经纬窗口（地固系）
    let win: { lonC: number; latC: number; lonHalf: number; latHalf: number } | null = null
    if (mode === '3d') {
      const group = earthGroupRef.current
      if (!group) return
      const p = camLocalRef.current.copy(camera.position)
      group.worldToLocal(p)
      const dist = p.length()
      if (dist - EARTH_R_SCENE <= MAX_3D_ALT) {
        const inv = 1 / dist
        const latC = (Math.asin(THREE.MathUtils.clamp(p.y * inv, -1, 1)) * 180) / Math.PI
        const lonC = (Math.atan2(-p.z, p.x) * 180) / Math.PI
        const half = (Math.acos(THREE.MathUtils.clamp(EARTH_R_SCENE / dist, -1, 1)) * 180) / Math.PI
        const lonHalf = Math.min(90, half / Math.max(Math.cos((latC * Math.PI) / 180), 0.15))
        win = { lonC, latC, lonHalf, latHalf: Math.min(half, 85) }
        console.log(`[TileDetail] 触发: dist=${dist.toFixed(2)}, alt=${((dist - EARTH_R_SCENE) * 1000).toFixed(0)}km, lonC=${lonC.toFixed(1)}, latC=${latC.toFixed(1)}`)
      }
    } else {
      const controls = controlsRef.current
      if (!controls) return
      const cam = camera as THREE.OrthographicCamera
      const visW = size.width / cam.zoom
      const visH = size.height / cam.zoom
      const lonHalf = (visW / 2 / (MAP_W / 2)) * 180
      const latHalf = (visH / 2 / (MAP_H / 2)) * 90
      if (lonHalf * 2 <= MAX_2D_SPAN_DEG) {
        win = {
          lonC: (controls.target.x / (MAP_W / 2)) * 180,
          latC: (controls.target.y / (MAP_H / 2)) * 90,
          lonHalf,
          latHalf: Math.min(latHalf, 85),
        }
      }
    }

    // 2) 拉远/无窗口：移除补丁（基础纹理已够用）
    if (!win) {
      if (loadedKeyRef.current !== '') {
        loadedKeyRef.current = ''
        setPatch(null)
      }
      return
    }

    // 3) 窗口 → 瓦片层级与范围（30% 外扩余量；瓦片数超限自动降级）
    const lonSpan = Math.min(360, win.lonHalf * 2 * 1.3)
    let z = Math.max(4, Math.min(6, Math.round(Math.log2(2160 / lonSpan))))
    let x0 = 0
    let y0 = 0
    let x1 = 0
    let y1 = 0
    for (;;) {
      const n = 2 ** z
      const lonMin = Math.max(-180, win.lonC - win.lonHalf * 1.3)
      const lonMax = Math.min(180, win.lonC + win.lonHalf * 1.3)
      const latMax = Math.min(85, win.latC + win.latHalf * 1.3)
      const latMin = Math.max(-85, win.latC - win.latHalf * 1.3)
      x0 = Math.max(0, Math.floor(((lonMin + 180) / 360) * n))
      x1 = Math.min(n - 1, Math.floor(((lonMax + 180) / 360) * n))
      y0 = Math.max(0, Math.floor(latToMercYNorm(latMax) * n))
      y1 = Math.min(n - 1, Math.floor(latToMercYNorm(latMin) * n))
      if ((x1 - x0 + 1) * (y1 - y0 + 1) <= MAX_TILES || z <= 4) break
      z--
    }
    const key = `${z}:${x0}:${y0}:${x1}:${y1}`
    if (key === loadedKeyRef.current || key === inflightRef.current) return

    // 4) 拉取区域纹理（完成后若仍是最新需求则上屏，否则丢弃）
    console.log(`[TileDetail] 加载高清瓦片: z=${z}, tiles=${(x1-x0+1)*(y1-y0+1)}, src=${detailSource}`)
    inflightRef.current = key
    loadRegionalTexture(detailSource, z, x0, y0, x1, y1)
      .then((region) => {
        inflightRef.current = null
        loadedKeyRef.current = key
        setPatch(region)
      })
      .catch(() => {
        // 源失败：保持旧补丁/基础纹理，不清空（下次视野变化会重试）
        inflightRef.current = null
      })
  })

  // 补丁几何与材质（3D 球面网格 / 2D 平面），随补丁重建并释放旧资源
  const built = useMemo(() => {
    if (!patch) return null
    const material = new THREE.MeshBasicMaterial({
      map: patch.texture,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    if (mode === '2d') {
      const w = ((patch.lonMax - patch.lonMin) / 360) * MAP_W
      const h = ((patch.latMax - patch.latMin) / 180) * MAP_H
      const geometry = new THREE.PlaneGeometry(w, h)
      const center = geoToMap((patch.latMin + patch.latMax) / 2, (patch.lonMin + patch.lonMax) / 2)
      geometry.translate(center.x, center.y, PATCH_Z_2D)
      return { geometry, material }
    }
    // 3D 球面网格：与底球同一坐标约定（geoToScene），逐点贴合
    const SX = 48
    const SY = 32
    const positions = new Float32Array((SX + 1) * (SY + 1) * 3)
    const uvs = new Float32Array((SX + 1) * (SY + 1) * 2)
    const indices: number[] = []
    const v = new THREE.Vector3()
    let i3 = 0
    let i2 = 0
    for (let iy = 0; iy <= SY; iy++) {
      const lat = patch.latMax - (iy / SY) * (patch.latMax - patch.latMin)
      for (let ix = 0; ix <= SX; ix++) {
        const lon = patch.lonMin + (ix / SX) * (patch.lonMax - patch.lonMin)
        geoToScene(lat, lon, PATCH_ALT_KM, v)
        positions[i3++] = v.x
        positions[i3++] = v.y
        positions[i3++] = v.z
        uvs[i2++] = ix / SX
        uvs[i2++] = 1 - iy / SY
      }
    }
    for (let iy = 0; iy < SY; iy++) {
      for (let ix = 0; ix < SX; ix++) {
        const a = iy * (SX + 1) + ix
        const b = a + 1
        const c = a + SX + 1
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    return { geometry, material }
  }, [patch, mode])

  // 补丁替换/卸载时释放旧几何、材质与纹理
  useEffect(() => {
    if (!built) return
    const texture = built.material.map
    return () => {
      built.geometry.dispose()
      built.material.dispose()
      texture?.dispose()
    }
  }, [built])

  if (!built) return null
  return <mesh geometry={built.geometry} material={built.material} />
}
