/**
 * GNC 发射仿真场景（专业模式 /pro/gnc，显示名「发射模拟」）
 *
 * 物理：@gnc/core 发射制导 + 轨迹积分（GravityTurnGuidance +
 * integrateLaunchTrajectory，半隐式 Euler），载具为 SLS Block 1
 * （@gnc/scenarios，经 services/vehicle.ts 适配为双级模型）。
 * 渲染：R3F 视图（共享 render/ 底座；对比期的自研 Cesium 视图已于 S4 下线）
 * + 2D 高度-射程曲线角窗 + 遥测面板；右侧 AOE Code Agent
 * 对话面板（提示词驱动动作操作场景）。
 * 发射场：services/launchSites.ts 注册表（AOE 编目 41 站口径），左上角下拉
 * 或 Agent set_launch_site 动作切换，切换后重建坐标变换并重置仿真。
 * 布局骨架与通用控件走 pro/shell（ProSceneShell/AgentPanel/TimeControls/
 * DetailPanel 等），本页只组装 shell + 视图 + GNC 业务逻辑。
 */

import { useEffect, useRef, useState } from 'react'
import {
  EARTH_RADIUS,
  GravityTurnGuidance,
  SLSGuidance,
  initializeLaunchState,
  integrateLaunchTrajectory,
  keplerianPropagateTwoBody,
  LaunchPhase,
  MU_EARTH,
  type LaunchState,
  type SeparationEvent,
} from '@gnc/core'
import { SLS_LAUNCH_VEHICLE } from './services/vehicle'
import {
  circularVelocity,
  elementsFromState,
  radialRate,
} from './services/orbitOps'
import { makeSiteTransform } from './r3f/sceneCoords'
import {
  DEFAULT_SITE_CODE,
  getLaunchSite,
} from './services/launchSites'
import TrajectoryCanvas, { type TrajectoryPoint } from './TrajectoryCanvas'
import GncR3fView, { type GncR3fViewHandle } from './r3f/GncR3fView'
import GncAgentChat from './agent/GncAgentChat'
import { clearSceneAgentMessages } from '../shell/AgentPanel'
import SiteMenu from './SiteMenu'
import BasemapMenu from '../shell/BasemapMenu'
import ProSceneShell from '../shell/ProSceneShell'
import DetailPanel, { type DetailSection } from '../shell/DetailPanel'
import {
  formatAngleDeg,
  formatCount,
  formatDistanceKm,
  formatSpeedKmS,
} from '../shell/formatters'
import {
  createScene,
  deleteScene,
  listScenes,
  saveScene,
  touchScene,
  DEFAULT_TARGET_ALT,
  DEFAULT_TARGET_INC,
  type GncScene,
} from './services/scenes'
import { OPEN_SCENE_MODAL_EVENT, OPEN_SCENES_FLAG_PREFIX } from '../modes'
import SceneManagerModal from '../shell/SceneManagerModal'
import './gnc.css'

const PHASE_LABELS: Record<LaunchPhase, string> = {
  [LaunchPhase.PRELAUNCH]: '待发射',
  [LaunchPhase.LIFTOFF]: '点火起飞',
  [LaunchPhase.BOOSTER_BURN]: '助推器工作',
  [LaunchPhase.STAGE1_BURN]: '一级工作',
  [LaunchPhase.MAX_Q]: '最大动压',
  [LaunchPhase.BOOSTER_SEPARATION]: '助推器分离',
  [LaunchPhase.STAGE1_SEPARATION]: '一级分离',
  [LaunchPhase.CORE_STAGE_BURN]: '芯级工作',
  [LaunchPhase.LAS_JETTISON]: '逃逸塔抛离',
  [LaunchPhase.CORE_STAGE_MECO]: '芯级关机',
  [LaunchPhase.CORE_SEPARATION]: '芯级分离',
  [LaunchPhase.UPPER_STAGE_IGNITION]: '上面级点火',
  [LaunchPhase.STAGE2_IGNITION]: '二级点火',
  [LaunchPhase.FAIRING_JETTISON]: '整流罩抛离',
  [LaunchPhase.UPPER_STAGE_BURN]: '上面级工作',
  [LaunchPhase.STAGE2_BURN]: '二级工作',
  [LaunchPhase.ORBITAL_INSERTION]: '入轨',
  [LaunchPhase.ORBIT_CIRCULARIZATION]: '圆化',
  [LaunchPhase.TLI_PREP]: '转移准备',
  [LaunchPhase.TLI_BURN]: '地月转移',
}

/**
 * 仿真阶段状态机：prelaunch → launch（gnc-core 动力段，到达目标高度即圆化入轨）
 * → orbit（在轨巡航）⇄ transfer（霍曼转移，抵达目标拱点后圆化回 orbit）。
 * launch 阶段的细分显示沿用 gnc-core 的 LaunchPhase。
 * 简化约定：动力段持续至目标高度入轨点（不模拟精确关机），见 orbitOps.ts。
 */
type SimPhase = 'prelaunch' | 'launch' | 'transfer' | 'orbit'
const SIM_PHASE_LABELS: Record<SimPhase, string> = {
  prelaunch: '待发射',
  launch: '',
  transfer: '霍曼转移',
  orbit: '在轨巡航',
}
/** 任务时间格式化：T+MM:SS（任务经过时间，业务格式，不走 shell 墙钟 formatters） */
function formatMissionTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `T+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const SPEEDS = [1, 10, 60]

export default function LaunchPage() {
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [snapshot, setSnapshot] = useState<LaunchState | null>(null)
  const [points, setPoints] = useState<TrajectoryPoint[]>([])
  const [reachedOrbit, setReachedOrbit] = useState(false)
  const [separationEvents, setSeparationEvents] = useState<SeparationEvent[]>([])
  const [followCam, setFollowCam] = useState(false)
  const [telemetryOpen, setTelemetryOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chartExpanded, setChartExpanded] = useState(false)
  const [basemapKey, setBasemapKey] = useState('tex-day')
  // 目标轨道参数（可经 Agent 调整，调整后重置仿真）
  const [targetOrbitKm, setTargetOrbitKm] = useState(400)
  const [inclinationDeg, setInclinationDeg] = useState(28.5)
  // 目标轨道输入草稿（遥测面板可编辑；外部变更时同步）
  const [draftAlt, setDraftAlt] = useState('400')
  const [draftInc, setDraftInc] = useState('28.5')
  const [draftEcc, setDraftEcc] = useState('0')
  const [draftRaan, setDraftRaan] = useState('0')
  const [orbitMsg, setOrbitMsg] = useState('')
  const [settingsMode, setSettingsMode] = useState<'simple' | 'advanced'>('simple')

  // 常用轨道预设
  const ORBIT_PRESETS = [
    { label: '近地轨道 LEO', alt: 400, inc: 51.6, ecc: 0, site: 'WSC' },
    { label: '太阳同步 SSO', alt: 650, inc: 98, ecc: 0, site: 'TAISC' },
    { label: '中地球轨道 MEO', alt: 20200, inc: 55, ecc: 0, site: 'XICLF' },
    { label: '地球同步 GEO', alt: 35786, inc: 0, ecc: 0, site: 'XICLF' },
    { label: '大椭圆 HEO', alt: 400, inc: 63.4, ecc: 0.7, site: 'TAISC' },
    { label: '极轨 LEO', alt: 800, inc: 90, ecc: 0, site: 'TAISC' },
  ]
  // 发射场（AOE 编目发射站代码口径；切换后重置仿真）
  const [siteCode, setSiteCode] = useState(DEFAULT_SITE_CODE)
  const site = getLaunchSite(siteCode) ?? getLaunchSite(DEFAULT_SITE_CODE)!
  // 在轨状态机（发射段之外：巡航/转移）
  const [simPhase, setSimPhase] = useState<SimPhase>('prelaunch')
  // 场景管理
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)
  const [scenes, setScenes] = useState<GncScene[]>(listScenes)
  const [sceneModalOpen, setSceneModalOpen] = useState(() => listScenes().length === 0)
  const simPhaseRef = useRef<SimPhase>('prelaunch')
  const setPhase = (p: SimPhase) => {
    simPhaseRef.current = p
    setSimPhase(p)
  }
  /** 霍曼转移目标（transfer 阶段）：抵达对应拱点后圆化 */
  const transferRef = useRef<{
    targetRadiusM: number
    inclinationDeg: number
    expectApoapsis: boolean
  } | null>(null)
  /** 上一步径向速度（r·v 符号变化 = 通过远/近地点） */
  const prevRadialRef = useRef(0)
  /** 当前发射场的 仿真系→地理系 旋转（倾角/根数在地理系计算） */
  const siteRotRef = useRef(makeSiteTransform(site.latDeg, site.lonDeg).rot)

  const stateRef = useRef<LaunchState | null>(null)
  const guidanceRef = useRef<GravityTurnGuidance | null>(null)
  const trajectoryRef = useRef<TrajectoryPoint[]>([])
  // 发射场初始位置：+Z 方向（gnc-core 的 thrustVector 以 +Z 为"上"，发射场必须在 +Z 上）
  const launchSiteRef = useRef<[number, number, number]>([0, 0, EARTH_RADIUS])
  const reachedRef = useRef(false)
  const runningRef = useRef(false)
  const speedRef = useRef(1)
  const targetOrbitRef = useRef(400)
  const inclinationRef = useRef(28.5)
  const r3fRef = useRef<GncR3fViewHandle>(null)
  const separationEventsRef = useRef<SeparationEvent[]>([])

  runningRef.current = running
  speedRef.current = speed

  const reset = () => {
    guidanceRef.current = new SLSGuidance(
      targetOrbitRef.current * 1000,
      (inclinationRef.current * Math.PI) / 180,
    )
    stateRef.current = initializeLaunchState(
      { r: [...launchSiteRef.current], v: [0, 0, 0] },
      SLS_LAUNCH_VEHICLE,
    )
    trajectoryRef.current = [{ downrange: 0, altitude: 0 }]
    reachedRef.current = false
    transferRef.current = null
    prevRadialRef.current = 0
    separationEventsRef.current = []
    setPhase('prelaunch')
    setReachedOrbit(false)
    setSeparationEvents([])
    setPoints([...trajectoryRef.current])
    setSnapshot(stateRef.current)
    r3fRef.current?.resetTrail()
  }

  // 初始化
  useEffect(() => {
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 场景浮框触发（sessionStorage 标志 + 自定义事件）
  const ACTIVE_SCENE_KEY = 'aoe_gnc_active_scene'
  useEffect(() => {
    const flag = OPEN_SCENES_FLAG_PREFIX + 'gnc'
    if (sessionStorage.getItem(flag)) {
      sessionStorage.removeItem(flag)
      setSceneModalOpen(true)
    }
    const onOpen = () => setSceneModalOpen(true)
    window.addEventListener(OPEN_SCENE_MODAL_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_SCENE_MODAL_EVENT, onOpen)
  }, [])

  // 恢复上次激活场景
  useEffect(() => {
    const storedId = localStorage.getItem(ACTIVE_SCENE_KEY)
    if (storedId) {
      const scene = listScenes().find(s => s.id === storedId)
      if (scene) {
        setActiveSceneId(scene.id)
        setSiteCode(scene.siteCode)
        setTargetOrbitKm(scene.targetAltKm)
        setInclinationDeg(scene.targetIncDeg)
        setSpeed(scene.speed)
        targetOrbitRef.current = scene.targetAltKm
        inclinationRef.current = scene.targetIncDeg
        return
      }
    }
    // 无存储场景：不创建，等首次 Agent 对话后懒创建
    localStorage.removeItem(ACTIVE_SCENE_KEY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 配置变更自动保存
  useEffect(() => {
    if (!activeSceneId) return
    localStorage.setItem(ACTIVE_SCENE_KEY, activeSceneId)
    const scene = scenes.find(s => s.id === activeSceneId)
    if (scene) {
      saveScene({ ...scene, siteCode, targetAltKm: targetOrbitKm, targetIncDeg: inclinationDeg, speed })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetOrbitKm, inclinationDeg, speed, activeSceneId])

  /** 切换发射场：重建 3D 视图坐标变换、倾角抬到可达下限（直接上升段 ≈ 场区纬度绝对值）、重置仿真 */
  const applySite = (code: string) => {
    const next = getLaunchSite(code)
    if (!next || !next.selectable) return
    setSiteCode(next.code)
    siteRotRef.current = makeSiteTransform(next.latDeg, next.lonDeg).rot
    const minInc = Math.round(Math.abs(next.latDeg) * 10) / 10
    if (inclinationRef.current < minInc) {
      inclinationRef.current = minInc
      setInclinationDeg(minInc)
    }
    r3fRef.current?.setLaunchSite(next.latDeg, next.lonDeg, next.name)
    setRunning(false)
    reset()
  }

  // 相机跟踪开关联动 3D 视图
  useEffect(() => {
    r3fRef.current?.setFollow(followCam)
  }, [followCam])

  // 仿真循环（requestAnimationFrame，固定步长细分，10Hz 快照渲染）
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastSnapshot = 0
    const DT = 0.05 // 积分步长 s

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const realDt = Math.min((now - last) / 1000, 0.25)
      last = now

      if (runningRef.current && stateRef.current && guidanceRef.current) {
        let remaining = realDt * speedRef.current
        while (remaining > 0 && stateRef.current) {
          const dt = Math.min(DT, remaining)
          let st: LaunchState = stateRef.current
          const phase = simPhaseRef.current

          if (phase === 'launch') {
            // 动力段：gnc-core 制导 + 积分；到达目标高度即圆化入轨
            const result = integrateLaunchTrajectory(st, SLS_LAUNCH_VEHICLE, guidanceRef.current, dt)
            st = result
            // 检测分离事件
            if (result.separationEvent) {
              separationEventsRef.current.push(result.separationEvent)
              console.log('[GNC] 分离事件:', result.separationEvent.label,
                '质量:', (st.mass / 1000).toFixed(0) + 't',
                '高度:', (st.altitude / 1000).toFixed(1) + 'km')
            }
            // 每10秒打印一次状态
            if (Math.floor(st.mission_time) % 10 === 0 && st.mission_time - dt < Math.floor(st.mission_time)) {
              console.log('[GNC] T+' + Math.floor(st.mission_time) + 's',
                '高度:', (st.altitude / 1000).toFixed(1) + 'km',
                '速度:', (st.velocity_magnitude).toFixed(0) + 'm/s',
                '质量:', (st.mass / 1000).toFixed(0) + 't',
                '推力:', (Math.hypot(...st.thrust) / 1e6).toFixed(1) + 'MN')
            }
            // 落地检测：发射后回落到地面，停止仿真
            if (st.altitude <= 10 && st.mission_time > 5 && !reachedRef.current) {
              stateRef.current = st
              setSnapshot(st)
              setPoints([...trajectoryRef.current])
              setRunning(false)
              break
            }
            if (st.altitude >= targetOrbitRef.current * 1000) {
              // 到达目标高度 → 圆化并入目标轨道面（地理系倾角，旋转回仿真系）
              st = {
                ...st,
                v: circularVelocity(st.r, st.v, inclinationRef.current, siteRotRef.current),
              }
              prevRadialRef.current = 0
              setPhase('orbit')
              reachedRef.current = true
              setReachedOrbit(true)
            }
          } else if (phase !== 'prelaunch') {
            // 在轨段（巡航/转移共用）：二体 RK4
            const out = keplerianPropagateTwoBody({ r: st.r, v: st.v }, dt, MU_EARTH)
            const rm = Math.hypot(out.r[0], out.r[1], out.r[2])
            const vm = Math.hypot(out.v[0], out.v[1], out.v[2])
            st = {
              ...st,
              r: out.r,
              v: out.v,
              mission_time: st.mission_time + dt,
              altitude: Math.max(0, rm - EARTH_RADIUS),
              velocity_magnitude: vm,
              flight_path_angle: Math.asin(
                Math.max(-1, Math.min(1, radialRate(out.r, out.v) / (rm * vm))),
              ),
              thrust: [0, 0, 0],
              guidance: { ...st.guidance, throttle: 0 },
            }
            // 拱点检测（径向速度符号变化 = 通过远/近地点）→ 转移抵达后圆化入目标轨道面
            const radial = radialRate(st.r, st.v)
            const prevRadial = prevRadialRef.current
            prevRadialRef.current = radial
            if (phase === 'transfer' && transferRef.current) {
              const t = transferRef.current
              const arrived = t.expectApoapsis
                ? prevRadial > 0 && radial <= 0
                : prevRadial < 0 && radial >= 0
              if (arrived) {
                st = {
                  ...st,
                  v: circularVelocity(st.r, st.v, t.inclinationDeg, siteRotRef.current),
                }
                transferRef.current = null
                setPhase('orbit')
              }
            }
          }
          stateRef.current = st
          remaining -= dt

          // 轨迹采样（约每 0.5s 仿真时间一个点；在轨段地心角振荡，曲线自然停更）
          const lastPoint = trajectoryRef.current[trajectoryRef.current.length - 1]
          const lastSampleTime = trajectoryRef.current.length * 0.5
          if (st.mission_time >= lastSampleTime) {
            // 射程 = 地心角 × 地球半径
            const r0 = launchSiteRef.current
            const cosTheta =
              (r0[0] * st.r[0] + r0[1] * st.r[1] + r0[2] * st.r[2]) /
              (Math.hypot(...r0) * Math.hypot(st.r[0], st.r[1], st.r[2]))
            const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)))
            const downrange = (EARTH_RADIUS * theta) / 1000
            if (!lastPoint || downrange >= lastPoint.downrange) {
              trajectoryRef.current.push({ downrange, altitude: st.altitude / 1000 })
            }
          }
        }
      }

      if (now - lastSnapshot > 100) {
        lastSnapshot = now
        setSnapshot(stateRef.current)
        // 入轨后停止记录轨迹数据
        if (!reachedRef.current) {
          setPoints([...trajectoryRef.current])
        }
        // 同步分离事件
        if (separationEventsRef.current.length !== separationEvents.length) {
          setSeparationEvents([...separationEventsRef.current])
        }
        if (stateRef.current) {
          r3fRef.current?.updateState(stateRef.current)
        }
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const phase = snapshot?.phase ?? LaunchPhase.PRELAUNCH
  const thrusting = snapshot ? Math.hypot(...snapshot.thrust) > 0 : false
  /** 阶段显示：发射段用 gnc-core 细分阶段，在轨段用状态机阶段 */
  const phaseLabel =
    simPhase === 'launch' || simPhase === 'prelaunch'
      ? PHASE_LABELS[phase]
      : SIM_PHASE_LABELS[simPhase]
  // 在轨根数（入轨后才有意义；在地理系计算——仿真系发射场在极点，直接算倾角是假的）
  const orbitParams =
    snapshot && simPhase !== 'prelaunch' && simPhase !== 'launch'
      ? elementsFromState(snapshot.r, snapshot.v, siteRotRef.current)
      : null

  // ---------- 场景 CRUD ----------

  const handleCreateScene = () => {
    const scene = createScene(`发射 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`)
    setActiveSceneId(scene.id)
    setSiteCode(DEFAULT_SITE_CODE)
    setTargetOrbitKm(DEFAULT_TARGET_ALT)
    setInclinationDeg(DEFAULT_TARGET_INC)
    setSpeed(1)
    targetOrbitRef.current = DEFAULT_TARGET_ALT
    inclinationRef.current = DEFAULT_TARGET_INC
    setScenes(listScenes())
    setSceneModalOpen(false)
    reset()
  }

  const handleSwitchScene = (id: string) => {
    const scene = scenes.find(s => s.id === id)
    if (!scene) return
    setActiveSceneId(id)
    setSiteCode(scene.siteCode)
    setTargetOrbitKm(scene.targetAltKm)
    setInclinationDeg(scene.targetIncDeg)
    setSpeed(scene.speed)
    targetOrbitRef.current = scene.targetAltKm
    inclinationRef.current = scene.targetIncDeg
    setSceneModalOpen(false)
    reset()
  }

  const handleRenameScene = (id: string, name: string) => {
    const scene = scenes.find(s => s.id === id)
    if (!scene) return
    saveScene({ ...scene, name })
    setScenes(listScenes())
  }

  const handleDeleteScene = (id: string) => {
    deleteScene(id)
    // 一并清理该场景的 Agent 会话 id 映射与本地消息缓存
    clearSceneAgentMessages(`gnc_${id}`)
    let remaining = listScenes()
    if (remaining.length === 0) {
      const scene = createScene('默认发射')
      remaining = listScenes()
      setActiveSceneId(scene.id)
    } else if (activeSceneId === id) {
      setActiveSceneId(remaining[0].id)
    }
    setScenes(remaining)
  }

  // ---------- Agent：场景状态序列化 + 动作执行 ----------

  /** 场景实时状态摘要（注入 system prompt 的 sceneContext 层，每次发送时调用） */
  const buildPromptContext = () => {
    const timeText = formatMissionTime(snapshot?.mission_time ?? 0)
    return `[GNC 仿真场景状态]
- 载具：SLS Block 1；目标轨道：${targetOrbitKm} km，倾角 ${inclinationDeg}°
- 发射场：${site.name}(${site.code})，${site.country}，纬度 ${site.latDeg}°，经度 ${site.lonDeg}°
- 任务时间：${timeText}；阶段：${phaseLabel}
- 高度：${((snapshot?.altitude ?? 0) / 1000).toFixed(1)} km；速度：${((snapshot?.velocity_magnitude ?? 0) / 1000).toFixed(2)} km/s；质量：${((snapshot?.mass ?? 0) / 1000).toFixed(0)} t${orbitParams ? `\n- 当前轨道：远点 ${orbitParams.apogeeKm.toFixed(0)} km / 近点 ${orbitParams.perigeeKm.toFixed(0)} km / 倾角 ${orbitParams.inclinationDeg.toFixed(1)}° / 周期 ${orbitParams.periodMin.toFixed(1)} min` : ''}
- 仿真：${running ? '运行中' : '已暂停'}，倍速 ${speed}×；相机跟踪：${followCam ? '开' : '关'}`
  }

  /** 调整目标轨道（Agent 动作与遥测面板输入共用）：在轨巡航→霍曼转移；转移中→拒绝；否则重置仿真 */
  const applyTargetOrbit = (altRaw: number, incRaw: number): string => {
    // 发射后禁止修改目标轨道
    if (simPhaseRef.current !== 'prelaunch') {
      return '发射后无法修改目标轨道，需重置后重新设置'
    }
    const alt = altRaw
    const inc = incRaw
    const minInc = Math.abs(site.latDeg)
    if (Number.isNaN(alt) || alt < 200 || alt > 2000) {
      return `非法轨道高度：${altRaw}（范围 200–2000 km）`
    }
    if (Number.isNaN(inc) || inc < minInc || inc > 98) {
      return `非法倾角：${incRaw}（当前发射场可达范围 ${minInc.toFixed(1)}–98°）`
    }
    targetOrbitRef.current = alt
    inclinationRef.current = inc
    setTargetOrbitKm(alt)
    setInclinationDeg(inc)
    // 仅在待发射状态可修改，不需要处理在轨/转移的逻辑
    return `目标轨道已设为 ${alt} km / ${inc}°`
  }

  /** 遥测面板「应用」目标轨道 */
  const applyDraftOrbit = () => {
    setOrbitMsg(applyTargetOrbit(Number(draftAlt), Number(draftInc)))
  }

  // 目标轨道被外部修改时同步输入草稿
  useEffect(() => {
    setDraftAlt(String(targetOrbitKm))
    setDraftInc(String(inclinationDeg))
  }, [targetOrbitKm, inclinationDeg])

  const executeAgentActions = (actions: Record<string, unknown>[]): string[] =>
    actions.map((action) => {
      switch (action.type) {
        case 'ignite':
          if (simPhaseRef.current === 'prelaunch') setPhase('launch')
          setRunning(true)
          return '已点火，仿真运行中'
        case 'resume':
          setRunning(true)
          return reachedRef.current ? '已继续（在轨巡航中）' : '已继续，仿真运行中'
        case 'pause':
          setRunning(false)
          return '已暂停'
        case 'reset':
          reset()
          setRunning(false)
          return '已重置到待发射状态'
        case 'set_speed': {
          const s = Number(action.speed)
          if (!SPEEDS.includes(s)) return `不支持的倍速：${JSON.stringify(action.speed)}（可选 1/10/60）`
          setSpeed(s)
          return `已设置时间倍速 ${s}×`
        }
        case 'set_target_orbit': {
          // 发射后禁止修改目标轨道
          if (simPhaseRef.current !== 'prelaunch') {
            return '发射后无法修改目标轨道，需重置后重新设置'
          }
          const alt = Number(action.altitude_km)
          const inc =
            action.inclination_deg === undefined
              ? inclinationRef.current
              : Number(action.inclination_deg)
          return applyTargetOrbit(alt, inc)
        }
        case 'set_launch_site': {
          const code = String(action.code ?? '').toUpperCase()
          const next = getLaunchSite(code)
          if (!next || !next.selectable) {
            return `未知或不可选的发射站代码：${JSON.stringify(action.code)}`
          }
          applySite(code)
          return `发射场已切换为 ${next.name}(${next.code})，仿真已重置，可重新点火`
        }
        case 'set_follow': {
          const follow = action.follow !== false
          setFollowCam(follow)
          return follow ? '相机跟踪已开启' : '相机跟踪已关闭'
        }
        default:
          return `未知动作类型：${String(action.type)}`
      }
    })

  // ---------- 遥测面板数据（统一 DetailPanel + formatters 显示规范） ----------
  const telemetrySections: DetailSection[] = [
    {
      title: '任务',
      items: [
        { key: '任务时间', value: formatMissionTime(snapshot?.mission_time ?? 0) },
        {
          key: '任务阶段',
          value: <span style={{ color: 'var(--cyan)' }}>{phaseLabel}</span>,
        },
        { key: '发射场', value: site.name },
        {
          key: '目标轨道',
          value: <span style={{ color: 'var(--cyan)' }}>{formatDistanceKm(targetOrbitKm)} · {formatAngleDeg(inclinationDeg)}</span>,
        },
        {
          key: '场区位置',
          value: `${site.code} · ${site.country} · ${formatAngleDeg(site.latDeg)} / ${formatAngleDeg(site.lonDeg)}`,
        },
      ],
    },
    {
      title: '飞行遥测',
      items: [
        { key: '高度', value: formatDistanceKm((snapshot?.altitude ?? 0) / 1000) },
        { key: '速度', value: formatSpeedKmS((snapshot?.velocity_magnitude ?? 0) / 1000) },
        { key: '质量', value: `${formatCount((snapshot?.mass ?? 0) / 1000)} t` },
        {
          key: '飞行路径角',
          value: formatAngleDeg(((snapshot?.flight_path_angle ?? 0) * 180) / Math.PI),
        },
        { key: '节流', value: `${((snapshot?.guidance.throttle ?? 0) * 100).toFixed(0)}%` },
        {
          key: '发动机',
          value: (
            <span style={{ color: thrusting ? 'var(--success)' : 'var(--text-secondary)' }}>
              {thrusting ? '工作中' : '关机'}
            </span>
          ),
        },
      ],
    },
  ]

  // 在轨段追加轨道根数区（滑行/转移/巡航）
  if (orbitParams) {
    telemetrySections.push({
      title: '轨道根数',
      items: [
        { key: '远地点', value: formatDistanceKm(orbitParams.apogeeKm) },
        { key: '近地点', value: formatDistanceKm(orbitParams.perigeeKm) },
        { key: '倾角', value: formatAngleDeg(orbitParams.inclinationDeg) },
        { key: '偏心率', value: orbitParams.eccentricity.toFixed(4) },
        { key: '轨道周期', value: `${orbitParams.periodMin.toFixed(1)} min` },
      ],
    })
  }

  return (
    <ProSceneShell
      agent={
        <GncAgentChat
          key={activeSceneId ?? 'draft'}
            sceneId={activeSceneId ?? 'draft'}
            buildPromptContext={buildPromptContext}
            executeActions={executeAgentActions}
            onAgentReply={() => {
              // 首次对话时懒创建场景
              if (!activeSceneId) {
                const scene = createScene(`发射 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`)
                setActiveSceneId(scene.id)
                setScenes(listScenes())
                return
              }
              touchScene(activeSceneId)
              setScenes(listScenes())
            }}
          />
      }
      overlays={
        <>
          {/* 左上角：底图切换 + 发射场两级选择（上下排列） */}
          <div className="pro-shell__map-tools-stack">
            <BasemapMenu
              options={[
                { key: 'tex-day', label: '卫星影像' },
                { key: 'tex-map', label: '地图' },
              ]}
              value={basemapKey}
              onChange={(key) => { setBasemapKey(key); r3fRef.current?.setBasemap(key) }}
            />
            <div className="pro-shell__map-tools">
              <SiteMenu value={siteCode} onChange={applySite} />
            </div>
          </div>
          {/* 右上角：相机跟踪 / 遥测 */}
          <div className="pro-shell__tools-tr">
            <button
              className="pro-shell__view-toggle"
              onClick={() => setFollowCam((v) => !v)}
              title="相机跟踪开关"
            >
              跟踪视角：{followCam ? '开' : '关'}
            </button>
            <button
              className={`pro-shell__view-toggle${telemetryOpen ? ' pro-shell__view-toggle--active' : ''}`}
              onClick={() => setTelemetryOpen((v) => !v)}
              title="遥测面板开关"
            >
              遥测
            </button>
          </div>
          {/* 2D 高度-射程曲线角窗（左下角，点击展开为分屏） */}
          {!chartExpanded && (
            <div className="launch-stage__curve" onClick={() => setChartExpanded(true)} title="点击展开">
              <div className="launch-stage__curve-header">
                <span className="launch-stage__curve-title">高度-时间曲线</span>
                <span className="launch-stage__curve-hint">点击展开</span>
              </div>
              <TrajectoryCanvas points={points} targetOrbitKm={targetOrbitKm} reachedOrbit={reachedOrbit} separationEvents={separationEvents} />
            </div>
          )}
          {/* 展开的曲线图（底部分屏，不遮挡主视图） */}
          {chartExpanded && (
            <div className="launch-chart-bottom">
              <div className="launch-stage__curve-header">
                <span className="launch-stage__curve-title">高度-时间曲线</span>
                <button className="launch-chart-overlay__close" onClick={() => setChartExpanded(false)}>✕ 收起</button>
              </div>
              <TrajectoryCanvas points={points} targetOrbitKm={targetOrbitKm} reachedOrbit={reachedOrbit} separationEvents={separationEvents} />
            </div>
          )}
          {/* 入轨提示已移至高度-时间曲线图内，主视图不再显示 */}
          {telemetryOpen && (
            <DetailPanel
              title="SLS Block 1 遥测"
              onClose={() => setTelemetryOpen(false)}
              sections={telemetrySections}
            />
          )}
          {/* 目标轨道设定面板（仅待发射状态） */}
          {settingsOpen && simPhase === 'prelaunch' && (
            <DetailPanel
              title="目标轨道参数"
              onClose={() => setSettingsOpen(false)}
              sections={
                settingsMode === 'simple'
                  ? [
                      {
                        title: '轨道预设',
                        items: [
                          {
                            key: '选择轨道',
                            value: (
                              <select
                                className="gnc-orbit-select"
                                onChange={(e) => {
                                  const p = ORBIT_PRESETS[Number(e.target.value)]
                                  if (p) {
                                    setDraftAlt(String(p.alt))
                                    setDraftInc(String(p.inc))
                                    setDraftEcc(String(p.ecc))
                                  }
                                }}
                              >
                                <option value="">-- 选择预设 --</option>
                                {ORBIT_PRESETS.map((p, i) => (
                                  <option key={i} value={i}>{p.label} ({p.alt}km/{p.inc}°)</option>
                                ))}
                              </select>
                            ),
                          },
                        ],
                      },
                      {
                        title: '轨道参数',
                        items: [
                          {
                            key: '轨道高度',
                            description: '卫星距地球表面的平均距离。LEO:200-2000km，GEO:35786km',
                            value: (
                              <span className="gnc-target-edit">
                                <input type="number" min={200} max={36000} value={draftAlt} onChange={(e) => setDraftAlt(e.target.value)} />
                                <span>km</span>
                              </span>
                            ),
                          },
                          {
                            key: '轨道倾角',
                            description: '轨道平面与赤道面的夹角。0°=赤道，90°=极轨。不能小于发射场纬度',
                            value: (
                              <span className="gnc-target-edit">
                                <input type="number" min={0} max={98} step={0.1} value={draftInc} onChange={(e) => setDraftInc(e.target.value)} />
                                <span>deg</span>
                              </span>
                            ),
                          },
                          {
                            key: '发射场',
                            description: '火箭发射地点，纬度决定倾角下限',
                            value: site.name,
                          },
                          ...(orbitMsg
                            ? [{ key: '提示', value: <span style={{ color: 'var(--cyan)' }}>{orbitMsg}</span> }]
                            : []),
                        ],
                      },
                    ]
                  : [
                      {
                        title: '轨道根数（完整）',
                        items: [
                          {
                            key: '半长轴',
                            description: '轨道椭圆长轴的一半，决定轨道大小。=地球半径+高度（自动计算）',
                            value: <span style={{ color: 'var(--text-secondary)' }}>{formatDistanceKm(Number(draftAlt) + 6371)}（自动）</span>,
                          },
                          {
                            key: '轨道高度',
                            value: (
                              <span className="gnc-target-edit">
                                <input type="number" min={200} max={36000} value={draftAlt} onChange={(e) => setDraftAlt(e.target.value)} />
                                <span>km</span>
                              </span>
                            ),
                          },
                          {
                            key: '偏心率',
                            description: '轨道椭圆程度。0=正圆，0-1=椭圆。大部分卫星用0，Molniya用0.7',
                            value: (
                              <span className="gnc-target-edit">
                                <input type="number" min={0} max={0.99} step={0.001} value={draftEcc} onChange={(e) => setDraftEcc(e.target.value)} />
                                <span>（0=圆轨道）</span>
                              </span>
                            ),
                          },
                          {
                            key: '轨道倾角',
                            value: (
                              <span className="gnc-target-edit">
                                <input type="number" min={0} max={98} step={0.1} value={draftInc} onChange={(e) => setDraftInc(e.target.value)} />
                                <span>deg</span>
                              </span>
                            ),
                          },
                          {
                            key: '升交点赤经',
                            description: '轨道从南向北穿过赤道的经度方向(RAAN)。0-360°，影响星下点经度分布',
                            value: (
                              <span className="gnc-target-edit">
                                <input type="number" min={0} max={360} step={0.1} value={draftRaan} onChange={(e) => setDraftRaan(e.target.value)} />
                                <span>deg</span>
                              </span>
                            ),
                          },
                          {
                            key: '发射场',
                            value: site.name,
                          },
                          ...(orbitMsg
                            ? [{ key: '提示', value: <span style={{ color: 'var(--cyan)' }}>{orbitMsg}</span> }]
                            : []),
                        ],
                      },
                      {
                        title: '约束条件',
                        items: [
                          {
                            key: '倾角下限',
                            value: `≥ ${Math.abs(site.latDeg).toFixed(1)}°`,
                          },
                          {
                            key: '高度范围',
                            value: '200 – 2000 km（LEO）',
                          },
                        ],
                      },
                    ]
              }
              footer={
                <div className="pro-shell__detail-actions">
                  <button
                    className="btn btn--ghost"
                    onClick={() => setSettingsMode(settingsMode === 'simple' ? 'advanced' : 'simple')}
                  >
                    {settingsMode === 'simple' ? '高级模式' : '简单模式'}
                  </button>
                  <button
                    className="btn btn--primary"
                    onClick={() => {
                      applyDraftOrbit()
                      setSettingsOpen(false)
                    }}
                  >
                    保存
                  </button>
                </div>
              }
            />
          )}
        </>
      }
      bottomLeft={
        <div className="pro-shell__time">
          {/* 点火：仅待发射状态显示 */}
          {simPhase === 'prelaunch' && (
            <button
              className="btn btn--primary"
              disabled={running}
              onClick={() => {
                setSettingsOpen(false)
                setPhase('launch')
                setRunning(true)
              }}
            >
              点火
            </button>
          )}
          {/* 暂停：点火后才可用 */}
          <button
            className="btn btn--ghost"
            disabled={simPhase === 'prelaunch'}
            onClick={() => setRunning((v) => !v)}
          >
            {running ? '暂停' : '继续'}
          </button>
          {/* 倍速选择 */}
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`pro-shell__time-btn${speed === s ? ' pro-shell__time-btn--active' : ''}`}
              onClick={() => setSpeed(s)}
            >
              {s}×
            </button>
          ))}
          {/* 分隔 */}
          <span className="pro-shell__time-sep" />
          {/* 目标轨道 */}
          {simPhase === 'prelaunch' && (
            <button
              className={`btn btn--ghost${settingsOpen ? ' btn--active' : ''}`}
              onClick={() => setSettingsOpen((v) => !v)}
              title="设置目标轨道"
            >
              目标轨道
            </button>
          )}
          {/* 重置 */}
          <button
            className="btn btn--ghost"
            disabled={simPhase === 'prelaunch'}
            onClick={() => { setRunning(false); reset() }}
          >
            重置
          </button>
        </div>
      }
      stats={
        <>
          {reachedOrbit && (
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ 已入轨</span>
          )}
          <span>
            {site.name} · SLS Block 1 · 目标轨道 {formatDistanceKm(targetOrbitKm)} · 倾角{' '}
            {formatAngleDeg(inclinationDeg)}
          </span>
        </>
      }
      sceneModal={
        sceneModalOpen && (
          <SceneManagerModal
            scenes={scenes}
            activeSceneId={activeSceneId}
            onSelect={handleSwitchScene}
            onCreate={handleCreateScene}
            onRename={handleRenameScene}
            onDelete={handleDeleteScene}
            onClose={() => setSceneModalOpen(false)}
          />
        )
      }
      expandedPanel={undefined}
    >
      <GncR3fView ref={r3fRef} />
    </ProSceneShell>
  )
}
