/**
 * 参数化天体：球体 + 全亮贴图 + 大气辉光（上提并参数化自 orbit/r3f/Earth.tsx，S1）
 *
 * 球体表面为 MeshBasicMaterial 全亮贴图（不消费场景灯光；昼夜 shader 已于
 * 2026-08-17 下线——效果不佳取消，原 SunSync/uSunDir 机制同步移除）。
 * 大气辉光 shader 源码见同目录 shaders.ts。
 * 星球参数（半径/贴图/大气）由调用方按 presets.ts 的预设传入——
 * 换星球（火星/月球）只换参数，渲染代码零改动。
 *
 * 自转说明：本组件不施加自转，星体自转由场景旋转组统一驱动（业务图层与星球
 * 同挂旋转组，随组一起转）；rotation-y 仅承担贴图经度校准（textureOffsetY）。
 */

import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { ATMO_FRAGMENT, ATMO_VERTEX } from './shaders'
import { loadTiledEquirectTexture } from './tileStitch'

/** 纹理模块级缓存：底图来回切换不重复下载/解码（Map2D 复用同一缓存） */
const textureCache = new Map<string, THREE.Texture>()
/** 在途加载去重：2D/3D 切换等并发场景共享同一个 Promise，避免重复拼接瓦片 */
const textureInflight = new Map<string, Promise<THREE.Texture>>()

export function loadTexture(url: string): Promise<THREE.Texture> {
  const cached = textureCache.get(url)
  if (cached) return Promise.resolve(cached)
  const inflight = textureInflight.get(url)
  if (inflight) return inflight

  // 瓦片源（tiles:<源>@<层级>）：运行时拼接为等距圆柱纹理，见 tileStitch.ts
  const promise = (
    url.startsWith('tiles:')
      ? loadTiledEquirectTexture(url)
      : new Promise<THREE.Texture>((resolve, reject) => {
          new THREE.TextureLoader().load(
            url,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace
              resolve(tex)
            },
            undefined,
            () => reject(new Error(`纹理加载失败：${url}`)),
          )
        })
  )
    .then((tex) => {
      textureCache.set(url, tex)
      textureInflight.delete(url)
      return tex
    })
    .catch((error: unknown) => {
      textureInflight.delete(url)
      throw error
    })
  textureInflight.set(url, promise)
  return promise
}

export interface CelestialBodyProps {
  /** 半径（km）：场景比例 1 单位 = 1000 km，内部换算 */
  radiusKm: number
  /** 表面贴图 URL（支持 tiles: 瓦片源） */
  dayTexture: string
  /** 贴图经度校准（弧度，mesh.rotation.y）：换贴图偏转时只改这里 */
  textureOffsetY?: number
  /** 大气辉光（颜色 + 厚度，厚度为半径比例）：无大气星球传 null */
  atmosphere: { color: string; thickness: number } | null
  /** 首张纹理就绪（父组件关加载遮罩） */
  onReady: () => void
  onError: (message: string) => void
}

export function CelestialBody({
  radiusKm,
  dayTexture,
  textureOffsetY = 0,
  atmosphere,
  onReady,
  onError,
}: CelestialBodyProps) {
  const radiusScene = radiusKm / 1000
  // 全亮贴图材质：map 异步就绪后原子替换（旧纹理保持显示）
  const material = useMemo(() => new THREE.MeshBasicMaterial(), [])
  // 大气辉光：无大气星球（atmosphere=null）不建材质（deps 取标量，避免预设对象标识抖动）
  const atmosphereColor = atmosphere?.color ?? null
  const atmosphereMaterial = useMemo(() => {
    if (atmosphereColor === null) return null
    return new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(atmosphereColor) } },
      vertexShader: ATMO_VERTEX,
      fragmentShader: ATMO_FRAGMENT,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [atmosphereColor])
  const [texReady, setTexReady] = useState(false)

  // 底图纹理加载 / 切换（旧纹理保持显示，新纹理就绪后原子替换）
  useEffect(() => {
    let cancelled = false
    loadTexture(dayTexture)
      .then((tex) => {
        if (cancelled) return
        material.map = tex
        material.needsUpdate = true
        setTexReady(true)
        onReady()
      })
      .catch((error: unknown) => {
        if (!cancelled) onError(error instanceof Error ? error.message : '纹理加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [dayTexture, material, onReady, onError])

  // 材质随组件销毁释放（纹理由模块缓存共享，不 dispose）
  useEffect(
    () => () => {
      material.dispose()
      atmosphereMaterial?.dispose()
    },
    [material, atmosphereMaterial],
  )

  if (!texReady) return null

  return (
    <>
      <mesh material={material} rotation-y={textureOffsetY}>
        <sphereGeometry args={[radiusScene, 96, 96]} />
      </mesh>
      {atmosphere && atmosphereMaterial && (
        <mesh material={atmosphereMaterial}>
          <sphereGeometry args={[radiusScene * (1 + atmosphere.thickness), 64, 64]} />
        </mesh>
      )}
    </>
  )
}
