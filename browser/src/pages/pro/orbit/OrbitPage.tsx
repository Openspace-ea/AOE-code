/**
 * 太空轨道模式总控页
 *
 * 状态编排：场景（本地持久化）→ 启用分组 → 拉取 TLE（ssa.aseem.cn 全量目录，带缓存）
 * → 编译 SatRecord → 秒级传播（satellite.js）→ 推给 R3F 主视图 / 鹰眼图 /
 * 详情面板。支持深链（?groups=…&sat=…）、时间控制、场景 CRUD。
 * 布局骨架与通用控件走 pro/shell（ProSceneShell/AgentPanel/TimeControls 等），
 * 本页只组装 shell + R3F 视图（唯一引擎，Cesium 已于 S4 下线）+ 轨道业务图层。
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchGroup, prefetchCatalog } from './services/ssaCatalog'
import { tleEpochDate } from './services/tle'
import { getGroup, ORBIT_GROUPS } from './services/groups'
import {
  createSatRecord,
  orbitElements,
  propagateAt,
  sampleOrbit,
  sampleOrbitInertial,
  type SatRecord,
} from './services/propagator'
import {
  createScene,
  deleteScene,
  listScenes,
  saveScene,
  touchScene,
  DEFAULT_SCENE_GROUPS,
  type OrbitScene,
} from './services/scenes'
import { SNAPSHOT_DATE } from './services/snapshot'
import {
  BASEMAP_OPTIONS,
  type BasemapKey,
  type OrbitViewHandle,
} from './viewTypes'
// R3F 自研引擎（唯一引擎）：懒加载独立 chunk，不进主 bundle
// （three 已被 GNC chunk 引入，可复用分包）
const OrbitR3fView = lazy(() => import('./r3f/OrbitR3fView'))
import EagleEye from '../render/EagleEye'
import ProSceneShell from '../shell/ProSceneShell'
import TimeControls from '../shell/TimeControls'
import SimClock from '../shell/SimClock'
import ViewToggle from '../shell/ViewToggle'
import BasemapMenu from '../shell/BasemapMenu'
import SceneManagerModal from '../shell/SceneManagerModal'
import { formatCount, formatUtcMinute } from '../shell/formatters'
import OrbitSidebar from './OrbitSidebar'
import GroupFloatingPanel from './GroupFloatingPanel'
import SatelliteDetailPanel from './SatelliteDetailPanel'
import OrbitAgentChat from './agent/OrbitAgentChat'
import { clearSceneAgentMessages } from '../shell/AgentPanel'
import { OPEN_SCENE_MODAL_EVENT, OPEN_SCENES_FLAG_PREFIX } from '../modes'
import type { GeoPosition } from './services/types'
import './orbit.css'

/** 鹰眼点位（含完整实时位置：详情面板 live 用；EagleEye 组件只消费经纬子集） */
type SatDot = GeoPosition & { noradId: string; group: string }

/** 分组加载状态 */
interface GroupMeta {
  state: 'loading' | 'ready' | 'error'
  count?: number
  fetchedAt?: number
  stale?: boolean
  snapshot?: boolean
  epoch?: Date | null
}

const GROUP_COLORS: Record<string, string> = Object.fromEntries(
  ORBIT_GROUPS.map((g) => [g.key, g.color]),
)

/** 记住当前场景的 localStorage 键 */
const ACTIVE_SCENE_KEY = 'aoe_orbit_active_scene'

/**
 * 能看全已启用星座的自适应最远缩放（米）：
 * ≈ 2.2 × 最高轨道半径（含 60° 视场余量），钳制 30000–150000 km
 */
function computeMaxZoomMeters(enabledGroups: string[]): number {
  const maxAltKm = enabledGroups.reduce(
    (max, key) => Math.max(max, ORBIT_GROUPS.find((g) => g.key === key)?.orbitAltKm ?? 400),
    400,
  )
  return Math.min(150_000_000, Math.max(30_000_000, 2.2 * (6371 + maxAltKm) * 1000))
}

export default function OrbitPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // ---------- 场景与工作配置 ----------
  const [scenes, setScenes] = useState<OrbitScene[]>(() => listScenes())
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)
  const [enabledGroups, setEnabledGroups] = useState<string[]>(() => {
    const fromUrl = searchParams.get('groups')
    return fromUrl ? fromUrl.split(',').filter(Boolean) : [...DEFAULT_SCENE_GROUPS]
  })
  /** 高亮卫星集合：null = 全部正常；非空 = 集合内100%亮度，其余30% */
  const [highlightedSats, setHighlightedSats] = useState<Set<string> | null>(null)
  const [selectedNoradId, setSelectedNoradId] = useState<string | null>(
    () => searchParams.get('sat'),
  )
  // 悬停目标（视图 pointermove 节流上报；仅用于展示 1.2 圈轨道线）
  const [hoveredNoradId, setHoveredNoradId] = useState<string | null>(null)
  const handleHover = useCallback((noradId: string | null) => {
    setHoveredNoradId((prev) => (prev === noradId ? prev : noradId))
  }, [])
  const [speed, setSpeed] = useState(1)
  // 场景管理浮框：首次进入且无任何场景时自动打开，引导创建
  const [sceneModalOpen, setSceneModalOpen] = useState(() => listScenes().length === 0)
  /** 当前悬浮面板显示的分组 key（null = 关闭） */
  const [floatingGroup, setFloatingGroup] = useState<string | null>(null)

  // 点击模式导航轨：弹出场景管理浮框（跨页经 sessionStorage 标志，同页经自定义事件）
  useEffect(() => {
    const flag = OPEN_SCENES_FLAG_PREFIX + 'orbit'
    if (sessionStorage.getItem(flag)) {
      sessionStorage.removeItem(flag)
      setSceneModalOpen(true)
    }
    const onOpen = () => setSceneModalOpen(true)
    window.addEventListener(OPEN_SCENE_MODAL_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_SCENE_MODAL_EVENT, onOpen)
  }, [])

  // ---------- 数据 ----------
  const [satData, setSatData] = useState<SatRecord[]>([])
  const [groupMeta, setGroupMeta] = useState<Record<string, GroupMeta>>({})
  const loadingGroupsRef = useRef<Set<string>>(new Set())

  // ---------- 仿真时间 ----------
  const [simTimeMs, setSimTimeMs] = useState(() => Date.now())
  const [playing, setPlaying] = useState(true)

  // ---------- 视图 ----------
  const [dots, setDots] = useState<SatDot[]>([])
  const [cameraCenter, setCameraCenter] = useState<{ latDeg: number; lonDeg: number } | null>(null)
  const [following, setFollowing] = useState(false)
  const [viewError, setViewError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d')
  // 底图选择（持久化）：本地保底（卫星影像/地图瓦片）+ 第三方在线源（Esri/CARTO，
  // 浏览器直连，见 render/tileStitch.ts）。历史存储值不在当前选项内即回退卫星影像
  //（不清存储值，用户重新选择时覆盖）
  const [basemap, setBasemap] = useState<BasemapKey>(() => {
    const stored = localStorage.getItem('aoe_orbit_basemap')
    return BASEMAP_OPTIONS.some((b) => b.key === stored) ? (stored as BasemapKey) : 'tex-day'
  })
  // 历史遗留：双引擎开关的 localStorage 键 aoe_orbit_engine 已随 Cesium 下线废弃，
  // 不再读取（不主动清理用户本地数据）；视图固定使用 R3F 引擎
  const viewRef = useRef<OrbitViewHandle | null>(null)

  // key 来自底图菜单选项（即 BASEMAP_OPTIONS 的 key），可直接视为 BasemapKey
  const handleBasemapChange = (key: string) => {
    const next = key as BasemapKey
    setBasemap(next)
    localStorage.setItem('aoe_orbit_basemap', next)
    viewRef.current?.setBasemap(next)
  }

  // 3D/2D 视图切换（鹰眼图点击也可进入 2D，内容随传播节拍同步）
  const handleToggleViewMode = () => {
    const next = viewMode === '3d' ? '2d' : '3d'
    setViewMode(next)
    viewRef.current?.morphTo(next)
  }

  /** 鹰眼图点击：定位到对应经纬度上空（保持当前 2D/3D 模式，切换只走按钮） */
  const handleEagleJump = (latDeg: number, lonDeg: number) => {
    viewRef.current?.flyTo(latDeg, lonDeg, 12000)
  }

  // 初始挂载：确定当前场景（上次使用 > 最近更新 > 自动创建默认场景）；
  // URL 深链参数（?groups/?sat）优先，覆盖场景配置
  useEffect(() => {
    const stored = listScenes()
    const lastActiveId = localStorage.getItem(ACTIVE_SCENE_KEY)
    const scene =
      stored.find((s) => s.id === lastActiveId) ?? stored[0] ?? createScene('默认场景')
    setScenes(listScenes())
    setActiveSceneId(scene.id)
    const groupsFromUrl = searchParams.get('groups')
    setEnabledGroups(
      groupsFromUrl ? groupsFromUrl.split(',').filter(Boolean) : scene.groups,
    )
    setSelectedNoradId(searchParams.get('sat') ?? scene.selectedNoradId ?? null)
    setSpeed(scene.speed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 配置变化写回当前场景 + 记住当前场景 + 深链
  useEffect(() => {
    if (!activeSceneId) return
    localStorage.setItem(ACTIVE_SCENE_KEY, activeSceneId)
    const scene = listScenes().find((s) => s.id === activeSceneId)
    if (scene) {
      saveScene({
        ...scene,
        groups: enabledGroups,
        selectedNoradId: selectedNoradId ?? undefined,
        speed,
      })
      setScenes(listScenes())
    }
    const params: Record<string, string> = {}
    if (enabledGroups.length > 0) params.groups = enabledGroups.join(',')
    if (selectedNoradId) params.sat = selectedNoradId
    setSearchParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledGroups, selectedNoradId, speed, activeSceneId])

  // ---------- 分组数据加载 ----------
  // 进入轨道模式即预热全量目录（后台拉取+缓存），分组加载都读缓存
  useEffect(() => {
    prefetchCatalog()
  }, [])

  useEffect(() => {
    for (const group of enabledGroups) {
      const meta = groupMeta[group]
      if (meta?.state === 'ready' || meta?.state === 'loading') continue
      if (loadingGroupsRef.current.has(group)) continue
      loadingGroupsRef.current.add(group)

      setGroupMeta((prev) => ({ ...prev, [group]: { state: 'loading' } }))
      fetchGroup(group)
        .then((result) => {
          const records = result.satellites
            .map(createSatRecord)
            .filter((r): r is SatRecord => r !== null)
          setSatData((prev) => [
            ...prev.filter((r) => r.tle.group !== group),
            ...records,
          ])
          // 分组内最新的 TLE 数据纪元
          let epoch: Date | null = null
          for (const record of records) {
            const e = tleEpochDate(record.tle.tleLine1)
            if (e && (!epoch || e > epoch)) epoch = e
          }
          setGroupMeta((prev) => ({
            ...prev,
            [group]: {
              state: 'ready',
              count: records.length,
              fetchedAt: result.fetchedAt,
              stale: result.stale,
              snapshot: result.snapshot,
              epoch,
            },
          }))
        })
        .catch(() => {
          setGroupMeta((prev) => ({ ...prev, [group]: { state: 'error' } }))
        })
        .finally(() => {
          loadingGroupsRef.current.delete(group)
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledGroups, groupMeta])

  // ---------- 自适应最远缩放（按已启用星座的最高轨道高度） ----------
  useEffect(() => {
    viewRef.current?.setMaxZoom(computeMaxZoomMeters(enabledGroups))
  }, [enabledGroups])

  // 高亮集合变化时同步到视图
  useEffect(() => {
    viewRef.current?.setHighlight(highlightedSats)
  }, [highlightedSats])

  // ---------- 仿真时钟（200ms 节拍，高倍速下插值窗口更小更平滑） ----------
  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setSimTimeMs((t) => t + 200 * speed)
    }, 200)
    return () => clearInterval(timer)
  }, [playing, speed])

  // 播放状态同步到视图（地球自转随仿真时钟：暂停不转、倍速加速）
  useEffect(() => {
    viewRef.current?.setPlayback(playing, speed)
  }, [playing, speed])

  // ---------- 秒级传播（分批摊销：每帧 500 颗，万级星座不卡主线程） ----------
  useEffect(() => {
    const time = new Date(simTimeMs)
    const enabled = new Set(enabledGroups)
    const queue = satData.filter((r) => enabled.has(r.tle.group))
    const nextDots: SatDot[] = []
    const viewItems: {
      noradId: string
      group: string
      latDeg: number
      lonDeg: number
      altKm: number
    }[] = []

    let cancelled = false
    let i = 0
    const BATCH = 500
    const step = () => {
      if (cancelled) return
      const end = Math.min(i + BATCH, queue.length)
      for (; i < end; i++) {
        const record = queue[i]
        try {
          const pos = propagateAt(record, time)
          if (!pos) continue
          nextDots.push({
            noradId: record.tle.noradId,
            group: record.tle.group,
            ...pos,
          })
          viewItems.push({
            noradId: record.tle.noradId,
          group: record.tle.group,
          latDeg: pos.latDeg,
          lonDeg: pos.lonDeg,
          altKm: pos.altKm,
          })
        } catch {
          // TLE 传播异常（数据损坏/衰减），跳过该目标
        }
      }
      if (i < queue.length) {
        requestAnimationFrame(step)
        return
      }
      setDots(nextDots)
      viewRef.current?.syncSatellites(viewItems, GROUP_COLORS)
      // 仿真时间写入视图时钟：地球自转/点位插值按此推演
      viewRef.current?.setSimTime(simTimeMs)
    }
    step()
    return () => {
      cancelled = true
    }
  }, [simTimeMs, satData, enabledGroups])

  // 选中目标的分组被关闭时，取消选中
  useEffect(() => {
    if (!selectedNoradId) return
    const record = satData.find((r) => r.tle.noradId === selectedNoradId)
    if (record && !enabledGroups.includes(record.tle.group)) {
      setSelectedNoradId(null)
    }
  }, [enabledGroups, satData, selectedNoradId])

  // ---------- 选中与详情 ----------
  const selectedRecord = useMemo(
    () => satData.find((r) => r.tle.noradId === selectedNoradId) ?? null,
    [satData, selectedNoradId],
  )
  const selectedElements = useMemo(
    () => (selectedRecord ? orbitElements(selectedRecord) : null),
    [selectedRecord],
  )
  const selectedLive = useMemo(
    () => dots.find((d) => d.noradId === selectedNoradId) ?? null,
    [dots, selectedNoradId],
  )

  // 视图挂载完成（回调 ref）时，把当前状态补推给它：
  // 播放/倍速、最远缩放、选中目标（点位与仿真时钟随下一传播拍自动同步）
  const latestViewStateRef = useRef({ playing, speed, enabledGroups, selectedRecord, simTimeMs })
  latestViewStateRef.current = { playing, speed, enabledGroups, selectedRecord, simTimeMs }
  const bindViewRef = useCallback((handle: OrbitViewHandle | null) => {
    viewRef.current = handle
    if (!handle) return
    const s = latestViewStateRef.current
    handle.setPlayback(s.playing, s.speed)
    handle.setMaxZoom(computeMaxZoomMeters(s.enabledGroups))
    if (s.selectedRecord) {
      handle.setSelected(
        s.selectedRecord.tle.noradId,
        s.selectedRecord.tle.name,
        sampleOrbit(s.selectedRecord, new Date(s.simTimeMs)),
        getGroup(s.selectedRecord.tle.group)?.color,
        sampleOrbitInertial(s.selectedRecord, new Date(s.simTimeMs)),
      )
    }
  }, [])

  // 选中变化 → 更新视图选中标记（含轨道线）
  // 注意：不清除跟踪状态，跟踪只在用户显式点击"取消跟踪"时退出
  useEffect(() => {
    if (selectedRecord) {
      viewRef.current?.setSelected(
        selectedRecord.tle.noradId,
        selectedRecord.tle.name,
        sampleOrbit(selectedRecord, new Date(simTimeMs)),
        getGroup(selectedRecord.tle.group)?.color,
        sampleOrbitInertial(selectedRecord, new Date(simTimeMs)),
      )
    } else {
      viewRef.current?.setSelected(null, '', null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoradId, selectedRecord])

  // ---------- 悬停与轨道预览（1.2 圈） ----------
  const hoveredRecord = useMemo(
    () => satData.find((r) => r.tle.noradId === hoveredNoradId) ?? null,
    [satData, hoveredNoradId],
  )

  // 悬停变化 → 更新视图悬停轨道线（分组关闭时自动清除）；
  // 采样基准时刻取最近一次渲染的仿真时钟（故意不依赖 simTimeMs：秒级推进不触发重采样）
  useEffect(() => {
    if (hoveredRecord && enabledGroups.includes(hoveredRecord.tle.group)) {
      const baseTime = new Date(latestViewStateRef.current.simTimeMs)
      viewRef.current?.setHovered(
        hoveredRecord.tle.noradId,
        hoveredRecord.tle.name,
        sampleOrbit(hoveredRecord, baseTime, 150, 1.2),
        getGroup(hoveredRecord.tle.group)?.color,
        sampleOrbitInertial(hoveredRecord, baseTime, 150, 1.2),
      )
    } else {
      viewRef.current?.setHovered(null, '', null)
    }
  }, [hoveredRecord, enabledGroups])

  const handleSearchSelect = useCallback(
    (noradId: string) => {
      const record = satData.find((r) => r.tle.noradId === noradId)
      if (!record) return
      if (!enabledGroups.includes(record.tle.group)) {
        setEnabledGroups((prev) => [...prev, record.tle.group])
      }
      setSelectedNoradId(noradId)
      const pos = propagateAt(record, new Date(simTimeMs))
      if (pos) {
        viewRef.current?.flyTo(pos.latDeg, pos.lonDeg, Math.max(4000, pos.altKm * 4))
      }
    },
    [satData, enabledGroups, simTimeMs],
  )

  // ---------- 场景操作（新建/切换/重命名/删除均在浮框中完成） ----------
  const handleCreateScene = () => {
    const scene = createScene(`场景 ${scenes.length + 1}`)
    setScenes(listScenes())
    setActiveSceneId(scene.id)
    setEnabledGroups(scene.groups)
    setSelectedNoradId(null)
    setSpeed(scene.speed)
    setSceneModalOpen(false)
  }

  const handleSwitchScene = (id: string) => {
    const scene = scenes.find((s) => s.id === id)
    if (!scene) return
    setActiveSceneId(id)
    setEnabledGroups(scene.groups)
    setSelectedNoradId(scene.selectedNoradId ?? null)
    setSpeed(scene.speed)
    setSceneModalOpen(false)
  }

  const handleRenameScene = (id: string, name: string) => {
    const scene = scenes.find((s) => s.id === id)
    if (!scene) return
    saveScene({ ...scene, name })
    setScenes(listScenes())
  }

  const handleDeleteScene = (id: string) => {
    deleteScene(id)
    // 一并清理该场景的 Agent 会话 id 映射与本地消息缓存
    clearSceneAgentMessages(`orbit_${id}`)
    let remaining = listScenes()
    // 工作区始终需要一个场景：删光后自动补一个默认场景
    if (remaining.length === 0) {
      remaining = [createScene('默认场景')]
    }
    setScenes(remaining)
    if (id === activeSceneId) {
      const next = remaining[0]
      setActiveSceneId(next.id)
      setEnabledGroups(next.groups)
      setSelectedNoradId(next.selectedNoradId ?? null)
      setSpeed(next.speed)
    }
  }

  // ---------- 分组操作 ----------
  const handleToggleGroup = (key: string, enabled: boolean) => {
    setEnabledGroups((prev) =>
      enabled ? [...new Set([...prev, key])] : prev.filter((g) => g !== key),
    )
  }

  const handleSetAllGroups = (enabled: boolean) => {
    setEnabledGroups(enabled ? ORBIT_GROUPS.map((g) => g.key) : [])
  }

  // ---------- 底部状态 ----------
  const totalCount = Object.values(groupMeta).reduce((sum, m) => sum + (m.count ?? 0), 0)
  const anyStale = Object.values(groupMeta).some((m) => m.stale && !m.snapshot)
  const anySnapshot = Object.values(groupMeta).some((m) => m.snapshot)
  const latestEpoch = Object.values(groupMeta).reduce<Date | null>(
    (max, m) => (m.epoch && (!max || m.epoch > max) ? m.epoch : max),
    null,
  )
  const groupCounts = Object.fromEntries(
    Object.entries(groupMeta).map(([k, m]) => [k, m.count ?? (m.state === 'error' ? -1 : 0)]),
  )

  // ---------- Agent：场景状态序列化 + 动作执行 ----------
  const groupLabel = (key: string) => ORBIT_GROUPS.find((g) => g.key === key)?.label ?? key

  /** 场景实时状态摘要（注入 system prompt 的 sceneContext 层，每次发送时调用） */
  const buildPromptContext = () => {
    const enabledDesc =
      enabledGroups
        .map((key) => `${groupLabel(key)}(${key})`)
        .join('、') || '无'
    const simTimeText = new Date(simTimeMs).toISOString().replace('T', ' ').slice(0, 19)
    return `[轨道场景状态]
- 已启用分组：${enabledDesc}
- 各分组已加载目标数：${JSON.stringify(groupCounts)}
- 选中目标：${selectedRecord ? `${selectedRecord.tle.name} (NORAD ${selectedRecord.tle.noradId})` : '无'}
- 跟踪视角：${following ? '开启' : '关闭'}
- 时间：${playing ? '播放中' : '已暂停'}，倍速 ${speed}×，仿真时间 ${simTimeText} UTC
- 已加载目标总数：${satData.length}`
  }

  /** 执行 Agent 动作，返回每条动作的结果描述 */
  const executeAgentActions = (actions: Record<string, unknown>[]): string[] =>
    actions.map((action) => {
      switch (action.type) {
        case 'enable_groups':
        case 'disable_groups': {
          const keys = Array.isArray(action.groups)
            ? action.groups.filter((g): g is string => typeof g === 'string')
            : []
          const valid = keys.filter((k) => ORBIT_GROUPS.some((g) => g.key === k))
          if (valid.length === 0) return `无有效分组：${JSON.stringify(action.groups)}`
          const enable = action.type === 'enable_groups'
          setEnabledGroups((prev) =>
            enable
              ? [...new Set([...prev, ...valid])]
              : prev.filter((g) => !valid.includes(g)),
          )
          return `已${enable ? '开启' : '关闭'}分组：${valid.map(groupLabel).join('、')}`
        }
        case 'select_satellite': {
          const query = typeof action.query === 'string' ? action.query.trim().toLowerCase() : ''
          if (!query) return '缺少 query 参数'
          const record = satData.find(
            (r) =>
              r.tle.name.toLowerCase().includes(query) || r.tle.noradId === query,
          )
          if (!record) {
            return `未找到「${action.query}」（仅搜索已加载分组，可先开启相关分组）`
          }
          handleSearchSelect(record.tle.noradId)
          return `已选中 ${record.tle.name}（NORAD ${record.tle.noradId}），视角已跟随`
        }
        case 'follow_satellite': {
          if (!selectedRecord) return '当前无选中目标，无法跟踪'
          const follow = action.follow !== false
          setFollowing(follow)
          viewRef.current?.setFollow(follow)
          return follow ? `已开启对 ${selectedRecord.tle.name} 的跟踪` : '已取消跟踪'
        }
        case 'set_time_speed': {
          const s = Number(action.speed)
          if (![1, 10, 60].includes(s)) return `不支持的倍速：${JSON.stringify(action.speed)}（可选 1/10/60）`
          setSpeed(s)
          return `已设置时间倍速 ${s}×`
        }
        case 'set_playing': {
          const p = action.playing !== false
          setPlaying(p)
          return p ? '已继续播放' : '已暂停'
        }
        case 'reset_time': {
          setSimTimeMs(Date.now())
          setSpeed(1)
          setPlaying(true)
          return '已回到实时'
        }
        case 'fly_to': {
          const lat = Number(action.lat)
          const lon = Number(action.lon)
          if (Number.isNaN(lat) || Number.isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
            return `非法经纬度：${JSON.stringify({ lat: action.lat, lon: action.lon })}`
          }
          viewRef.current?.flyTo(lat, lon)
          return `视角已定位到 ${lat.toFixed(1)}°, ${lon.toFixed(1)}° 上空`
        }
        case 'filter_by_region': {
          const lat = Number(action.lat)
          const lon = Number(action.lon)
          const radiusKm = Number(action.radiusKm ?? 2000)
          if (Number.isNaN(lat) || Number.isNaN(lon)) return '缺少经纬度参数'
          const toRad = Math.PI / 180
          const R = 6371
          const now = new Date(simTimeMs)
          const inRegion = satData
            .filter((r) => {
              const pos = propagateAt(r, now)
              if (!pos) return false
              const dLat = (pos.latDeg - lat) * toRad
              const dLon = (pos.lonDeg - lon) * toRad
              const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * toRad) * Math.cos(pos.latDeg * toRad) * Math.sin(dLon / 2) ** 2
              const distKm = 2 * R * Math.asin(Math.sqrt(a))
              return distKm <= radiusKm
            })
            .map((r) => r.tle.noradId)
          if (inRegion.length === 0) {
            setHighlightedSats(null)
            return `${lat.toFixed(1)}°, ${lon.toFixed(1)}° 上空 ${radiusKm}km 范围内无卫星（请确认已开启相关分组）`
          }
          setHighlightedSats(new Set(inRegion))
          viewRef.current?.setHighlight(new Set(inRegion))
          return `已筛选 ${inRegion.length} 颗卫星（${lat.toFixed(1)}°, ${lon.toFixed(1)}° 上空 ${radiusKm}km 范围内），其余已半透明`
        }
        case 'clear_filter': {
          setHighlightedSats(null)
          viewRef.current?.setHighlight(null)
          return '已清除区域筛选，显示所有卫星'
        }
        default:
          return `未知动作类型：${String(action.type)}`
      }
    })

  return (
    <ProSceneShell
      sidebar={
        <OrbitSidebar
          groups={ORBIT_GROUPS}
          enabledGroups={enabledGroups}
          groupCounts={groupCounts}
          onToggleGroup={handleToggleGroup}
          onSetAllGroups={handleSetAllGroups}
          satellites={satData}
          onSearchSelect={handleSearchSelect}
          onGroupClick={(key) => {
            setFloatingGroup(key)
            // 点击分组名时，若未启用则自动启用（确保数据已加载）
            if (!enabledGroups.includes(key)) {
              handleToggleGroup(key, true)
            }
          }}
        />
      }
      agent={
        activeSceneId && (
          // Agent 对话面板：按场景持久化会话（历史场景带出历史对话），key 保证切场景重建
          <OrbitAgentChat
            key={activeSceneId}
            sceneId={activeSceneId}
            buildPromptContext={buildPromptContext}
            executeActions={executeAgentActions}
            onAgentReply={() => { touchScene(activeSceneId); setScenes(listScenes()) }}
          />
        )
      }
      overlays={
        <>
          {!viewError && (
            <>
              <div className="orbit-main__eagle">
                <EagleEye
                  dots={dots}
                  groupColors={GROUP_COLORS}
                  selectedNoradId={selectedNoradId ?? undefined}
                  viewCenter={cameraCenter}
                  onJump={handleEagleJump}
                />
              </div>
              <SimClock simTimeMs={simTimeMs} />
              <BasemapMenu
                options={BASEMAP_OPTIONS}
                value={basemap}
                onChange={handleBasemapChange}
              />
              <ViewToggle viewMode={viewMode} onToggle={handleToggleViewMode} />
            </>
          )}
          {selectedRecord && selectedElements && (
            <SatelliteDetailPanel
              tle={selectedRecord.tle}
              elements={selectedElements}
              live={selectedLive}
              following={following}
              onToggleFollow={() => {
                const next = !following
                setFollowing(next)
                viewRef.current?.setFollow(next)
              }}
              onClose={() => setSelectedNoradId(null)}
            />
          )}
        </>
      }
      bottomLeft={
        <TimeControls
          playing={playing}
          speed={speed}
          simTimeMs={simTimeMs}
          onTogglePlay={() => setPlaying((v) => !v)}
          onSetSpeed={setSpeed}
          onResetToLive={() => {
            setSimTimeMs(Date.now())
            setSpeed(1)
            setPlaying(true)
          }}
        />
      }
      stats={
        <>
          <span>目标数：{formatCount(totalCount)}</span>
          {latestEpoch && <span>数据纪元：{formatUtcMinute(latestEpoch)}</span>}
          {anySnapshot && (
            <span className="pro-shell__stats-warn">快照数据（{SNAPSHOT_DATE}）</span>
          )}
          {anyStale && <span className="pro-shell__stats-warn">部分数据来自缓存</span>}
          {/* 分组卫星悬浮面板 */}
          {floatingGroup && (
            <GroupFloatingPanel
              groupKey={floatingGroup}
              group={ORBIT_GROUPS.find((g) => g.key === floatingGroup)}
              satellites={satData.filter((s) => s.tle.group === floatingGroup)}
              onSelect={(noradId) => { handleSearchSelect(noradId); setFloatingGroup(null) }}
              onToggleHighlight={(noradId) => {
                setHighlightedSats((prev) => {
                  const next = new Set(prev ?? [])
                  if (next.has(noradId)) next.delete(noradId)
                  else next.add(noradId)
                  return next.size > 0 ? next : null
                })
              }}
              highlightedIds={highlightedSats}
              onClose={() => setFloatingGroup(null)}
            />
          )}
        </>
      }
      sceneModal={
        sceneModalOpen && (
          // 场景管理浮框：新建/切换/重命名/删除
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
    >
      {viewError ? (
        <div className="orbit-main__view-error">
          <p>3D 视图加载失败：{viewError}</p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            重试
          </button>
        </div>
      ) : (
        <Suspense
          fallback={<div className="orbit-r3f-view__loading">3D 地球加载中…</div>}
        >
          <OrbitR3fView
            ref={bindViewRef}
            initialBasemap={basemap}
            initialViewMode={viewMode}
            onSelect={(noradId) => {
              // 跟踪模式下点击空白不取消选中（保持跟踪）
              if (!noradId && following) return
              setSelectedNoradId(noradId)
            }}
            onHover={handleHover}
            onCameraChange={setCameraCenter}
            onError={setViewError}
          />
        </Suspense>
      )}
    </ProSceneShell>
  )
}
