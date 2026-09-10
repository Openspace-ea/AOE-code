/**
 * 2D 平面模式：等距圆柱纹理铺满平面（默认宽高比 2:1），正交相机正视。
 * 参数化：纹理 URL 与平面尺寸由调用方按星球预设/底图选择传入。
 * 无 morph 动画——3D↔2D 直接切换（相对已下线 Cesium 引擎的已知降级，见设计文档 §6）。
 * 点位投影、拖拽/缩放钳制在场景业务层完成（如轨道 OrbitR3fView 的相机装配）。
 */

import { useEffect, useState } from 'react'
import { loadTexture } from './CelestialBody'
import { MAP_H, MAP_W } from './coords'

interface Map2DProps {
  /** 底图纹理 URL（随星球预设/底图选择走） */
  textureUrl: string
  /** 平面尺寸（场景单位）：默认地球表面展开——宽 = 赤道周长，高 = 赤道半周长 */
  width?: number
  height?: number
  /** 纹理就绪（父组件关加载遮罩） */
  onReady: () => void
  onError: (message: string) => void
}

export function Map2D({ textureUrl, width = MAP_W, height = MAP_H, onReady, onError }: Map2DProps) {
  const [tex, setTex] = useState<import('three').Texture | null>(null)

  useEffect(() => {
    let cancelled = false
    loadTexture(textureUrl)
      .then((t) => {
        if (cancelled) return
        setTex(t)
        onReady()
      })
      .catch((error: unknown) => {
        if (!cancelled) onError(error instanceof Error ? error.message : '纹理加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [textureUrl, onReady, onError])

  if (!tex) return null

  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={tex} />
    </mesh>
  )
}
