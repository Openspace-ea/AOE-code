/**
 * 轨道模式自研 R3F 3D 视图（唯一引擎；对比期的 Cesium 引擎已于 S4 下线）
 *
 * React Three Fiber 场景：render/ 共享底座（SceneCanvas 画布 + CelestialBody
 * 全亮贴图/大气辉光 + TileDetailLayer 高清瓦片补丁 + 仿真时钟自转）+ 分组卫星点位
 * + 选中标记/轨道线/跟踪 + 2D 平面模式（正交相机，无 morph 动画）。
 *
 * 对外句柄为 ../viewTypes 的 OrbitViewHandle（沿用双引擎期的同形接口），
 * 由 OrbitPage 直接渲染。本组件经 React.lazy 独立 chunk 懒加载，不进主 bundle
 * （three 已被 GNC chunk 引入，可复用分包）。
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
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { BasemapKey, OrbitViewHandle } from '../viewTypes'
import { CelestialBody } from '../../render/CelestialBody'
import { Map2D } from '../../render/Map2D'
import { SceneCanvas } from '../../render/SceneCanvas'
import { TileDetailLayer } from '../../render/TileDetailLayer'
import { OrbitLine } from './OrbitLine'
import { BASEMAP_DETAIL_SOURCES, EARTH_PRESET, type EarthTextureKey } from '../../render/presets'
import {
  EARTH_R_SCENE,
  MAP_H,
  MAP_W,
  MIN_DISTANCE,
  geoToMap,
  geoToScene,
  gmstRad,
} from '../../render/coords'
import Satellites, { type SatellitesHandle, type ViewMode } from './Satellites'
import { SelectedSat, type SelectedInfo } from './SelectedSat'

export interface OrbitR3fViewProps {
  /** 初始底图（键与 EARTH_PRESET.basemaps 一一对应，非法键回退 tex-day） */
  initialBasemap?: BasemapKey
  /** 初始视图模式（保持用户所在的 2D/3D 状态） */
  initialViewMode?: ViewMode
  /** 点击点位选中 / 点空白取消选中 */
  onSelect: (noradId: string | null) => void
  /** 悬停点位（用于展示悬停轨道）；移出/点空白为 null */
  onHover: (noradId: string | null) => void
  /** 主视口中心变化（鹰眼图视野框用） */
  onCameraChange?: (center: { latDeg: number; lonDeg: number }) => void
  /** 纹理/初始化失败（父组件降级处理） */
  onError: (message: string) => void
}

const UP = new THREE.Vector3(0, 1, 0)
const _to = new THREE.Vector3()
/** 2D 最小视野跨度（度）：约对应 z6 在线瓦片的细节上限，再放大无意义 */
const MIN_2D_SPAN_DEG = 8

const OrbitR3fView = forwardRef<OrbitViewHandle, OrbitR3fViewProps>(function OrbitR3fView(
  { initialBasemap, initialViewMode, onSelect, onHover, onCameraChange, onError },
  ref,
) {
  const [mode, setMode] = useState<ViewMode>(initialViewMode ?? '3d')
  const [textureKey, setTextureKey] = useState<EarthTextureKey>(
    initialBasemap && initialBasemap in EARTH_PRESET.basemaps ? initialBasemap : 'tex-day',
  )
  const [selected, setSelected] = useState<SelectedInfo | null>(null)
  const [hovered, setHovered] = useState<SelectedInfo | null>(null)
  const [ready, setReady] = useState(false)
  /** 首帧纹理就绪前 onError 才上抛为致命错误（整页错误遮罩）；
   *  就绪后底图切换失败只告警并保持旧底图（原子替换语义），不白屏 */
  const readyRef = useRef(false)

  const modeRef = useRef(mode)
  modeRef.current = mode
  const earthGroupRef = useRef<THREE.Group>(null)
  const satsRef = useRef<SatellitesHandle>(null)
  const controlsRef = useRef<any>(null)
  const cameraRef = useRef<THREE.Camera | null>(null)
  const followRef = useRef(false)
  const selectedIdRef = useRef<string | null>(null)
  /** 仿真时钟（ms）：setSimTime 锚定，useFrame 内按倍速平滑推进 */
  const simClockRef = useRef(Date.now())
  const playbackRef = useRef({ playing: true, speed: 1 })
  /** 最远缩放（场景单位；setMaxZoom 入参是米，换算 1 单位 = 1e6 米） */
  const maxZoomRef = useRef(30)
  /** flyTo 相机动画：null 表示无动画（用户操作即取消） */
  const flyRef = useRef<{ from: THREE.Vector3; to: THREE.Vector3; startAt: number } | null>(null)

  // 回调经 ref 转发，避免句柄/子组件因闭包过期
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onHoverRef = useRef(onHover)
  onHoverRef.current = onHover
  const onCameraChangeRef = useRef(onCameraChange)
  onCameraChangeRef.current = onCameraChange
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const handleReady = useCallback(() => {
    readyRef.current = true
    setReady(true)
  }, [])
  const stableOnError = useCallback((message: string) => {
    if (!readyRef.current) {
      onErrorRef.current(message)
    } else {
      // 底图切换等后续加载失败：保持旧底图，仅告警（不触发整页错误遮罩）
      console.warn(`[轨道视图] 纹理加载失败，保持当前底图：${message}`)
    }
  }, [])

  // 初始视角：全球俯瞰（略偏东半球），沿用已下线 Cesium 引擎的取值
  const initialCamPos = useMemo(
    () => geoToScene(20, 110, 24000).applyAxisAngle(UP, gmstRad(simClockRef.current)),
    [],
  )

  useImperativeHandle(
    ref,
    () => ({
      syncSatellites(items, colors) {
        satsRef.current?.sync(items, colors)
      },

      setSelected(noradId, name, orbit, color, orbitRing) {
        selectedIdRef.current = noradId
        setSelected(noradId ? { noradId, name, orbit, orbitRing, color } : null)
      },

      setHovered(noradId, name, orbit, color, orbitRing) {
        setHovered(noradId ? { noradId, name, orbit, orbitRing, color } : null)
      },

      flyTo(latDeg, lonDeg, heightKm = 12000) {
        if (modeRef.current === '2d') {
          // 2D：直接 pan 到对应经纬（无动画）
          const controls = controlsRef.current
          const camera = cameraRef.current
          if (!controls || !camera) return
          geoToMap(latDeg, lonDeg, _to)
          camera.position.x += _to.x - controls.target.x
          camera.position.y += _to.y - controls.target.y
          controls.target.set(_to.x, _to.y, 0)
          controls.update()
          return
        }
        const camera = cameraRef.current
        if (!camera || followRef.current) return // 跟踪中视角锁卫星，flyTo 不抢控制权
        // 目标：当前地球自转角下 (lat, lon, height) 上空的惯性位置，1.5s 缓动飞达
        geoToScene(latDeg, lonDeg, heightKm, _to).applyAxisAngle(UP, gmstRad(simClockRef.current))
        flyRef.current = { from: camera.position.clone(), to: _to.clone(), startAt: performance.now() }
      },

      setFollow(follow) {
        followRef.current = follow
        const controls = controlsRef.current
        const camera = cameraRef.current
        if (!controls || !camera) return

        if (follow) {
          // 开启跟踪：立即将相机聚焦到选中卫星位置，放大到最近距离
          const selectedId = selectedIdRef.current
          if (selectedId && satsRef.current) {
            const out = new THREE.Vector3()
            if (satsRef.current.getLocalPosition(selectedId, out)) {
              // 3D：将 controls target 移到卫星位置，相机移近
              if (modeRef.current === '3d') {
                const dir = out.clone().sub(camera.position).normalize()
                camera.position.copy(out).addScaledVector(dir, -0.05)
                controls.target.copy(out)
              } else {
                // 2D：pan 到卫星位置，zoom 到最大
                controls.target.set(out.x, out.y, 0)
                camera.position.set(out.x, out.y, 10)
                const cam2d = camera as THREE.OrthographicCamera
                cam2d.zoom = controls.maxZoom
                cam2d.updateProjectionMatrix()
              }
              controls.update()
            }
          }
        } else {
          // 退出跟踪恢复自由环绕：target 归位地心
          if (modeRef.current === '3d') {
            controls.target.set(0, 0, 0)
          }
          controls.update()
        }
      },

      morphTo(next) {
        // R3F 侧为直接切换（无 morph 动画，见设计文档 §6）
        flyRef.current = null
        followRef.current = false
        setMode(next)
      },

      setBasemap(key) {
        // 键与 EARTH_PRESET.basemaps 一一对应；非法键回退默认影像
        setTextureKey(
          key in EARTH_PRESET.basemaps ? (key as EarthTextureKey) : 'tex-day',
        )
      },

      setSimTime(timeMs) {
        simClockRef.current = timeMs
      },

      setPlayback(playing, speed) {
        playbackRef.current = { playing, speed }
      },

      setMaxZoom(distanceMeters) {
        maxZoomRef.current = Math.max(MIN_DISTANCE + 0.01, distanceMeters / 1e6)
      },

      setHighlight(noradIds) {
        satsRef.current?.setHighlight(noradIds)
      },
    }),
    [],
  )

  return (
    <div className="orbit-r3f-view">
      <SceneCanvas>
        {mode === '3d' ? (
          <PerspectiveCamera
            makeDefault
            fov={55}
            near={0.001}
            far={3000}
            position={initialCamPos}
          />
        ) : (
          <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={40} near={0.01} far={100} />
        )}
        {/* 地球、点位、轨道线统一挂 earthGroup：rotation.y = GMST(仿真时钟) */}
        <group ref={earthGroupRef}>
          {mode === '3d' ? (
            <CelestialBody
              radiusKm={EARTH_PRESET.radiusKm}
              dayTexture={EARTH_PRESET.basemaps[textureKey]}
              textureOffsetY={EARTH_PRESET.textureOffsetY}
              atmosphere={EARTH_PRESET.atmosphere}
              onReady={handleReady}
              onError={stableOnError}
            />
          ) : (
            <Map2D
              textureUrl={EARTH_PRESET.basemaps[textureKey]}
              onReady={handleReady}
              onError={stableOnError}
            />
          )}
          <Satellites ref={satsRef} mode={mode} simClockRef={simClockRef} />
          <SelectedSat
            selected={selected}
            mode={mode}
            satsRef={satsRef}
            controlsRef={controlsRef}
            earthGroupRef={earthGroupRef}
            followRef={followRef}
          />
          {/* 拉近时按视野拼接在线高清瓦片补丁（拉远自动移除） */}
          <TileDetailLayer
            mode={mode}
            detailSource={BASEMAP_DETAIL_SOURCES[textureKey]}
            controlsRef={controlsRef}
            earthGroupRef={earthGroupRef}
          />
        </group>
        {/* 轨道线挂在旋转组之外：3D 为惯性系轨道环（不随地球自转，圈间闭合），
            2D 星下点轨迹此时旋转组不旋转，坐标一致 */}
        {selected && (
          <OrbitLine
            orbit={selected.orbit}
            orbitRing={selected.orbitRing}
            mode={mode}
            color={selected.color ?? '#3ae0d8'}
            lineWidth={2}
            opacity={0.9}
          />
        )}
        {/* 悬停目标的 1.2 圈轨道（与选中目标同色同分组，选中时不重复绘制） */}
        {hovered && hovered.noradId !== selected?.noradId && (
          <OrbitLine
            orbit={hovered.orbit}
            orbitRing={hovered.orbitRing}
            mode={mode}
            color={hovered.color ?? '#3ae0d8'}
            lineWidth={1.5}
            opacity={0.85}
          />
        )}
        {mode === '3d' ? (
          <OrbitControls
            key="controls-3d"
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.08}
            enablePan={false}
            minDistance={MIN_DISTANCE}
            maxDistance={maxZoomRef.current}
            onStart={() => {
              flyRef.current = null
            }}
          />
        ) : (
          // 2D：禁旋转、屏幕平面平移、左键拖拽即 pan；边界钳制在 SceneDriver 内
          // key 强制卸载重建：两套 OrbitControls props 不同，同位更新会触发
          // R3F 的 props-diff remove 分支（new OrbitControls() 取默认值）而崩溃
          <OrbitControls
            key="controls-2d"
            ref={controlsRef}
            makeDefault
            enableRotate={false}
            enableDamping
            dampingFactor={0.08}
            screenSpacePanning
            mouseButtons={{
              LEFT: THREE.MOUSE.PAN,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN,
            }}
            touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
            onStart={() => {
              flyRef.current = null
            }}
          />
        )}
        <CameraGrabber cameraRef={cameraRef} />
        <SceneDriver
          modeRef={modeRef}
          simClockRef={simClockRef}
          playbackRef={playbackRef}
          earthGroupRef={earthGroupRef}
          controlsRef={controlsRef}
          followRef={followRef}
          selectedIdRef={selectedIdRef}
          satsRef={satsRef}
          maxZoomRef={maxZoomRef}
          flyRef={flyRef}
          onCameraChangeRef={onCameraChangeRef}
        />
        <PickHandler satsRef={satsRef} onSelectRef={onSelectRef} onHoverRef={onHoverRef} />
      </SceneCanvas>
      {!ready && <div className="orbit-r3f-view__loading">3D 地球加载中…</div>}
    </div>
  )
})

/** 把当前默认相机暴露给 imperative 句柄（flyTo 等需要） */
function CameraGrabber({ cameraRef }: { cameraRef: React.MutableRefObject<THREE.Camera | null> }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    cameraRef.current = camera
  }, [camera, cameraRef])
  return null
}

const _dir = new THREE.Vector3()
const _oc = new THREE.Vector3()
const _hit = new THREE.Vector3()

interface SceneDriverProps {
  modeRef: React.RefObject<ViewMode>
  simClockRef: { current: number }
  playbackRef: { current: { playing: boolean; speed: number } }
  earthGroupRef: React.RefObject<THREE.Group>
  controlsRef: React.RefObject<any>
  /** 跟踪卫星状态（跟踪时最近距离放宽到贴近卫星，否则锁定地表以上） */
  followRef: React.RefObject<boolean>
  selectedIdRef: React.RefObject<string | null>
  satsRef: React.RefObject<any>
  maxZoomRef: { current: number }
  flyRef: {
    current: { from: THREE.Vector3; to: THREE.Vector3; startAt: number } | null
  }
  onCameraChangeRef: React.RefObject<
    ((center: { latDeg: number; lonDeg: number }) => void) | undefined
  >
}

/** 每帧驱动：仿真时钟推进、地球自转、缩放/拖拽钳制、flyTo 动画、视口中心上报 */
function SceneDriver({
  modeRef,
  simClockRef,
  playbackRef,
  earthGroupRef,
  controlsRef,
  followRef,
  selectedIdRef,
  satsRef,
  maxZoomRef,
  flyRef,
  onCameraChangeRef,
}: SceneDriverProps) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const lastReportAtRef = useRef(0)
  const lastCamPosRef = useRef(new THREE.Vector3(Infinity, 0, 0))

  useFrame((_, delta) => {
    const now = performance.now()
    // 仿真时钟：暂停不走、倍速加速（沿用已下线 Cesium 引擎 setPlayback 语义）
    const { playing, speed } = playbackRef.current
    if (playing) {
      simClockRef.current += Math.min(delta, 0.5) * 1000 * speed
    }
    // 地球自转绑仿真时钟（2D 模式不转）
    const earthGroup = earthGroupRef.current
    if (earthGroup) {
      earthGroup.rotation.y = modeRef.current === '3d' ? gmstRad(simClockRef.current) : 0
    }

    const controls = controlsRef.current
    if (controls) {
      // 跟踪模式：每帧将 controls target 移到卫星位置
      if (followRef.current && selectedIdRef.current && satsRef.current) {
        const out = new THREE.Vector3()
        if (satsRef.current.getLocalPosition(selectedIdRef.current, out)) {
          if (modeRef.current === '3d') {
            controls.target.copy(out)
            // 保持相机到目标的距离不变，只平移
            const camDir = camera.position.clone().sub(controls.target).normalize()
            const dist = camera.position.distanceTo(controls.target)
            camera.position.copy(out).addScaledVector(camDir, dist)
          } else {
            controls.target.set(out.x, out.y, 0)
            camera.position.set(out.x, out.y, 10)
          }
          controls.update()
        }
      }

      if (modeRef.current === '3d') {
        // 最近距离：跟踪卫星时放宽到贴近卫星；否则锁定地表以上（MIN_DISTANCE=半径+300km，防穿模）
        controls.minDistance = followRef.current ? 0.02 : MIN_DISTANCE
        // 最远缩放自适应（按已启用星座的最高轨道高度，由 setMaxZoom 写入）
        controls.maxDistance = maxZoomRef.current
        // 上限变小时，相机若已超出则收敛回来
        const dist = camera.position.distanceTo(controls.target)
        if (dist > maxZoomRef.current) {
          camera.position.sub(controls.target).setLength(maxZoomRef.current).add(controls.target)
        }
      } else {
        // 2D：pan 边界与缩放钳制，不允许把地图外区域拖出来
        const cam = camera as THREE.OrthographicCamera
        const minZoom = Math.max(size.width / MAP_W, size.height / MAP_H)
        controls.minZoom = minZoom
        if (cam.zoom < minZoom) {
          cam.zoom = minZoom
          cam.updateProjectionMatrix()
        }
        // 最大放大：视野跨度不小于 MIN_2D_SPAN_DEG（约对应 z6 在线瓦片细节上限）
        const maxZoom = size.width / (MAP_W * (MIN_2D_SPAN_DEG / 360))
        controls.maxZoom = maxZoom
        if (cam.zoom > maxZoom) {
          cam.zoom = maxZoom
          cam.updateProjectionMatrix()
        }
        const visW = size.width / cam.zoom
        const visH = size.height / cam.zoom
        const boundX = Math.max(0, (MAP_W - visW) / 2)
        const boundY = Math.max(0, (MAP_H - visH) / 2)
        const clampedX = THREE.MathUtils.clamp(controls.target.x, -boundX, boundX)
        const clampedY = THREE.MathUtils.clamp(controls.target.y, -boundY, boundY)
        const dx = clampedX - controls.target.x
        const dy = clampedY - controls.target.y
        if (dx !== 0 || dy !== 0) {
          controls.target.x = clampedX
          controls.target.y = clampedY
          camera.position.x += dx
          camera.position.y += dy
        }
      }

      // flyTo 相机动画（1.5s 缓动）
      const fly = flyRef.current
      if (fly) {
        const t = Math.min(1, (now - fly.startAt) / 1500)
        const eased = t * t * (3 - 2 * t)
        camera.position.lerpVectors(fly.from, fly.to, eased)
        if (t >= 1) flyRef.current = null
      }
      controls.update()
    }

    // 视口中心上报（鹰眼图视野框）：相机移动时节流上报
    if (
      onCameraChangeRef.current &&
      camera.position.distanceToSquared(lastCamPosRef.current) > 1e-6 &&
      now - lastReportAtRef.current > 150
    ) {
      lastReportAtRef.current = now
      lastCamPosRef.current.copy(camera.position)
      reportCenter(modeRef, earthGroupRef, controlsRef, camera, onCameraChangeRef.current)
    }
  })
  return null
}

/** 视口中心经纬度：3D = 相机→目标射线与地球求交（转回地固系）；2D = 平面中心 */
function reportCenter(
  modeRef: React.RefObject<ViewMode>,
  earthGroupRef: React.RefObject<THREE.Group>,
  controlsRef: React.RefObject<any>,
  camera: THREE.Camera,
  report: (center: { latDeg: number; lonDeg: number }) => void,
) {
  const controls = controlsRef.current
  if (!controls) return
  if (modeRef.current === '2d') {
    report({
      latDeg: THREE.MathUtils.clamp((controls.target.y / (MAP_H / 2)) * 90, -90, 90),
      lonDeg: THREE.MathUtils.clamp((controls.target.x / (MAP_W / 2)) * 180, -180, 180),
    })
    return
  }
  const earthGroup = earthGroupRef.current
  if (!earthGroup) return
  _dir.copy(controls.target).sub(camera.position)
  const maxDist = _dir.length()
  _dir.normalize()
  // 球心在原点、半径 EARTH_R_SCENE 的射线求交
  _oc.copy(camera.position)
  const b = _oc.dot(_dir)
  const c = _oc.lengthSq() - EARTH_R_SCENE * EARTH_R_SCENE
  const disc = b * b - c
  if (disc < 0) return
  const tHit = -b - Math.sqrt(disc)
  if (tHit < 0 || tHit > maxDist) return
  _hit.copy(camera.position).addScaledVector(_dir, tHit)
  earthGroup.worldToLocal(_hit)
  const r = _hit.length()
  const lat = Math.asin(THREE.MathUtils.clamp(_hit.y / r, -1, 1))
  const lon = Math.atan2(-_hit.z, _hit.x)
  report({ latDeg: (lat * 180) / Math.PI, lonDeg: (lon * 180) / Math.PI })
}

const _ndc = new THREE.Vector2()

interface PickHandlerProps {
  satsRef: React.RefObject<SatellitesHandle>
  onSelectRef: React.RefObject<(noradId: string | null) => void>
  onHoverRef: React.RefObject<(noradId: string | null) => void>
}

/** 点击拾取：小位移点击才触发（拖拽视角不拾取），点空白取消选中；
 * 悬停拾取：pointermove 节流 80ms，拖拽中/移出画布不触发 */
function PickHandler({ satsRef, onSelectRef, onHoverRef }: PickHandlerProps) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  useEffect(() => {
    const el = gl.domElement
    let downX = 0
    let downY = 0
    let lastHoverAt = 0
    const pickAt = (clientX: number, clientY: number): string | null => {
      const rect = el.getBoundingClientRect()
      _ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(_ndc, camera)
      return satsRef.current?.pick(raycaster, camera, rect.height) ?? null
    }
    const onDown = (e: PointerEvent) => {
      if (e.button === 0) {
        downX = e.clientX
        downY = e.clientY
      }
    }
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return // 拖拽不拾取
      onSelectRef.current?.(pickAt(e.clientX, e.clientY))
    }
    const onMove = (e: PointerEvent) => {
      if (e.buttons !== 0) return // 拖拽中不悬停
      const now = performance.now()
      if (now - lastHoverAt < 80) return
      lastHoverAt = now
      onHoverRef.current?.(pickAt(e.clientX, e.clientY))
    }
    const onLeave = () => onHoverRef.current?.(null)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [gl, camera, raycaster, satsRef, onSelectRef, onHoverRef])

  return null
}

export default OrbitR3fView
