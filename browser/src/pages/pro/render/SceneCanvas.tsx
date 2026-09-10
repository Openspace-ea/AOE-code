/**
 * 统一场景画布：R3F Canvas 公共配置（抗锯齿 / DPR / 背景色）
 *
 * 只抽场景间真正无差别的部分：相机属业务装配（初始机位随场景、2D 正交
 * 与 3D 透视随视图模式切换），不进本组件；懒加载边界在页面层
 * （React.lazy + Suspense，如 OrbitPage 对 OrbitR3fView 的分包），也不进本组件。
 * 星空背景已下线（程序化星点不真实，2026-08-17 移除），纯深空底色。
 */

import type { ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'

interface SceneCanvasProps {
  children: ReactNode
}

export function SceneCanvas({ children }: SceneCanvasProps) {
  return (
    <Canvas gl={{ antialias: true }} dpr={[1, 2]}>
      <color attach="background" args={['#050a16']} />
      {children}
    </Canvas>
  )
}
