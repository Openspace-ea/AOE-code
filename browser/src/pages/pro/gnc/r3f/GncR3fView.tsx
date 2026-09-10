/**
 * GNC R3F 视图（自 gnc-space-sim 移植起步，MIT）
 *
 * React Three Fiber 场景：render/ 共享底座（CelestialBody 参数化地球——全亮
 * 贴图 + 大气辉光，EARTH_PRESET）+ 航天器发光点位（恒定屏幕尺寸；SLS 程序化
 * 箭体已于 2026-08-18 下线——模型姿态问题多，先用点位表示）+ 发射场标记
 * （SiteMarker）+ 飞行轨迹线 + 相机自由环绕/跟踪。
 *
 * 坐标映射：gnc-core 仿真系发射场在 [0,0,R]（thrustVector 以 +Z 为"上"），
 * 经 sceneCoords.ts 的 makeSiteTransform 固定旋转映射到当前发射场
 * （忽略飞行期地球自转）；CelestialBody 贴图经度约定与 render/coords.ts
 * 的地理映射天然对齐。场景光照为固定平行光（地球全亮贴图不消费灯光）。
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { LaunchState } from '@gnc/core'
import { makeSiteTransform, simToSceneWith, type SiteTransform } from './sceneCoords'
import { DEFAULT_SITE_CODE, getLaunchSite } from '../services/launchSites'
import { CelestialBody } from '../../render/CelestialBody'
import { TileDetailLayer } from '../../render/TileDetailLayer'
import { EARTH_PRESET, BASEMAP_DETAIL_SOURCES, type EarthTextureKey } from '../../render/presets'

export interface GncR3fViewHandle {
  updateState: (state: LaunchState) => void
  setFollow: (follow: boolean) => void
  resetTrail: () => void
  /** 切换发射场：重建坐标变换、点位/轨迹归位新场区、相机聚焦新发射场上空 */
  setLaunchSite: (latDeg: number, lonDeg: number, label?: string) => void
  /** 切换底图纹理 */
  setBasemap: (key: string) => void
}

const _radial = new THREE.Vector3()
const _toCam = new THREE.Vector3()

/** 发射场标记：地表小球 + 名称标签（转到地球背面时标签隐藏） */
function SiteMarker({ position, label }: { position: THREE.Vector3; label: string }) {
  const labelRef = useRef<HTMLDivElement>(null)
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    if (!labelRef.current) return
    _radial.copy(position).normalize()
    _toCam.copy(camera.position).sub(position).normalize()
    labelRef.current.style.opacity = _radial.dot(_toCam) > 0 ? '1' : '0'
  })
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshBasicMaterial color="#ffa94d" />
      </mesh>
      <Html zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={labelRef} className="gnc-r3f__site-label">
          {label}
        </div>
      </Html>
    </group>
  )
}

/** 航天器点位 shader：白芯 + 青色描边环，恒定屏幕尺寸 */
const CRAFT_VERTEX = /* glsl */ `
  uniform float uPixelRatio;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float scale = (6.371 * 3.0) / max(-mv.z, 0.001);
    gl_PointSize = clamp(10.0 * uPixelRatio * scale, 4.0 * uPixelRatio, 60.0);
    gl_Position = projectionMatrix * mv;
  }
`
const CRAFT_FRAGMENT = /* glsl */ `
  uniform float uTime;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    // 核心白点 + 脉冲橙色辉光
    float pulse = 0.7 + 0.3 * sin(uTime * 4.0);
    float core = 1.0 - smoothstep(0.0, 0.4, d);
    float glow = smoothstep(1.0, 0.2, d) * 0.8 * pulse;
    vec3 col = vec3(1.0) * core + vec3(1.0, 0.5, 0.1) * glow;
    float alpha = max(core, glow * 0.9);
    gl_FragColor = vec4(col, alpha);
  }
`

interface CraftPointProps {
  posRef: React.RefObject<THREE.Vector3>
  followRef: React.RefObject<boolean>
  controlsRef: React.RefObject<any>
}

/** 航天器发光点位 + 平滑跟随 + 相机跟踪（防穿模） */
const _camDir = new THREE.Vector3()
const EARTH_R = 6.371

function CraftPoint({ posRef, followRef, controlsRef }: CraftPointProps) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const groupRef = useRef<THREE.Group>(null)
  const labelRef = useRef<THREE.Group>(null)
  const points = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3))
    const material = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: gl.getPixelRatio() }, uTime: { value: 0 } },
      vertexShader: CRAFT_VERTEX,
      fragmentShader: CRAFT_FRAGMENT,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    })
    const p = new THREE.Points(geometry, material)
    p.frustumCulled = false
    return p
  }, [gl])

  useEffect(
    () => () => {
      points.geometry.dispose()
      ;(points.material as THREE.Material).dispose()
    },
    [points],
  )

  useFrame(({ clock }) => {
    if (!posRef.current) return
    const group = groupRef.current
    const label = labelRef.current
    if (!group) return

    // 平滑跟随
    group.position.lerp(posRef.current, 0.35)
    // 脉冲动画
    ;(points.material as THREE.ShaderMaterial).uniforms.uTime.value = clock.elapsedTime

    // 相机防穿模
    const controls = controlsRef.current
    if (!controls) return
    if (followRef.current) {
      controls.target.copy(group.position)
      const camDist = camera.position.length()
      const minDist = EARTH_R + 0.15
      if (camDist < minDist) {
        _camDir.copy(camera.position).normalize()
        camera.position.copy(_camDir).multiplyScalar(minDist)
      }
    } else {
      controls.target.set(0, 0, 0)
    }
    controls.update()

    // 标签跟随（直接写 position，避免 React 渲染延迟）
    if (label) {
      label.position.copy(group.position)
    }
  })

  return (
    <>
      <group ref={groupRef}>
        <primitive object={points} />
      </group>
      {/* 发射目标文字标签（独立 group，useFrame 直接写位置） */}
      <group ref={labelRef}>
        <Html
          center
          style={{ pointerEvents: 'none' }}
          zIndexRange={[15, 0]}
        >
          <div className="gnc-craft-label">
            发射目标
            <span className="gnc-craft-arrow" />
          </div>
        </Html>
      </group>
    </>
  )
}

/** 飞行轨迹线 */
function Trail({ trailRef }: { trailRef: React.RefObject<THREE.Vector3[]> }) {
  const line = useMemo(
    () =>
      new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: '#3ae0d8' }),
      ),
    [],
  )
  useFrame(() => {
    const pts = trailRef.current
    if (pts && pts.length >= 2) {
      line.geometry.setFromPoints(pts)
    }
  })
  return <primitive object={line} />
}

const GncR3fView = forwardRef<GncR3fViewHandle, object>(function GncR3fView(_props, ref) {
  const controlsRef = useRef<any>(null)
  const earthGroupRef = useRef<THREE.Group>(null)
  // 发射场坐标变换（默认卡角；setLaunchSite 重建）
  const defaultSite = getLaunchSite(DEFAULT_SITE_CODE)!
  const transformRef = useRef<SiteTransform>(
    makeSiteTransform(defaultSite.latDeg, defaultSite.lonDeg),
  )
  const initialPad = useMemo(() => transformRef.current.padScene.clone(), []) // eslint-disable-line react-hooks/exhaustive-deps
  const craftPosRef = useRef<THREE.Vector3>(initialPad.clone())
  const trailRef = useRef<THREE.Vector3[]>([initialPad.clone()])
  const followRef = useRef(false)
  const [texError, setTexError] = useState<string | null>(null)
  // 发射场标记（位置 + 名称标签，setLaunchSite 时更新）
  const [siteMarker, setSiteMarker] = useState({ position: initialPad, label: defaultSite.name })
  const [textureKey, setTextureKey] = useState<EarthTextureKey>('tex-day')
  // CelestialBody 的 onReady 必须稳定（其纹理加载 effect 依赖该回调）
  const handleReady = useCallback(() => {}, [])

  useImperativeHandle(
    ref,
    () => ({
      updateState(state) {
        const pos = simToSceneWith(transformRef.current.rot, state.r)
        craftPosRef.current = pos
        const trail = trailRef.current
        // 距离抽稀（约 5km 一点），在轨长时间飞行也能覆盖多圈
        if (trail.length < 20000 && pos.distanceToSquared(trail[trail.length - 1]) > 2.5e-5) {
          trail.push(pos)
        }
      },
      setFollow(follow) {
        followRef.current = follow
        const controls = controlsRef.current
        if (!controls) return
        if (!follow) {
          // 退出跟踪：target 归位地心
          controls.target.set(0, 0, 0)
          controls.update()
        }
      },
      resetTrail() {
        const pad = transformRef.current.padScene
        trailRef.current = [pad.clone()]
        craftPosRef.current = pad.clone()
      },
      setLaunchSite(latDeg, lonDeg, label) {
        transformRef.current = makeSiteTransform(latDeg, lonDeg)
        const pad = transformRef.current.padScene
        craftPosRef.current = pad.clone()
        trailRef.current = [pad.clone()]
        setSiteMarker({ position: pad.clone(), label: label ?? '' })
        // 相机聚焦新发射场上空（与初始机位同一相对布局）
        const controls = controlsRef.current
        if (controls) {
          controls.target.copy(pad)
          controls.object.position.set(pad.x * 1.8, pad.y * 1.8 + 0.6, pad.z * 1.8)
          controls.update()
        }
      },
      setBasemap(key) {
        setTextureKey(key in EARTH_PRESET.basemaps ? (key as EarthTextureKey) : 'tex-day')
      },
    }),
    [],
  )

  return (
    <>
      <Canvas
        className="gnc-r3f"
        camera={{
          // 初始相机：发射场近旁上空，看向发射场
          position: [initialPad.x * 1.8, initialPad.y * 1.8 + 0.6, initialPad.z * 1.8],
          fov: 55,
          near: 0.001,
          far: 3000,
        }}
      >
        <color attach="background" args={['#050a16']} />
        {/* 灯光为全场景兜底；CelestialBody 为全亮贴图材质，不消费灯光 */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[60, 30, 40]} intensity={1.8} />
        {/* 地球（拉近时高清瓦片补丁层叠在上方） */}
        <group ref={earthGroupRef}>
          <CelestialBody
            radiusKm={EARTH_PRESET.radiusKm}
            dayTexture={EARTH_PRESET.basemaps[textureKey] ?? EARTH_PRESET.dayTexture}
            textureOffsetY={EARTH_PRESET.textureOffsetY}
            atmosphere={EARTH_PRESET.atmosphere}
            onReady={handleReady}
            onError={setTexError}
          />
          <TileDetailLayer
            mode="3d"
            detailSource={BASEMAP_DETAIL_SOURCES[textureKey]}
            controlsRef={controlsRef}
            earthGroupRef={earthGroupRef}
          />
        </group>
        <CraftPoint posRef={craftPosRef} followRef={followRef} controlsRef={controlsRef} />
        <Trail trailRef={trailRef} />
        <SiteMarker position={siteMarker.position} label={siteMarker.label} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          target={[initialPad.x, initialPad.y, initialPad.z]}
          minDistance={0.3}
          maxDistance={80}
        />
      </Canvas>
      {texError && <div className="gnc-r3f__error">地球纹理加载失败：{texError}</div>}
    </>
  )
})

export default GncR3fView
