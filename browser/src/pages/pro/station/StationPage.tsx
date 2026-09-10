/**
 * 测控仿真场景主页面
 *
 * 布局：ProSceneShell 统一壳
 * - sidebar：地面站/卫星列表 + 仰角约束 + 运行按钮
 * - agent：StationAgentChat（右侧对话面板）
 * - children：CelestialBody 地球底座（Phase 1 占位，Phase 3 补业务图层）
 * - expandedPanel：Access 报告表格
 * - stats：可见性摘要
 * - sceneModal：场景管理浮框
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import ProSceneShell from '../shell/ProSceneShell'
import SceneManagerModal from '../shell/SceneManagerModal'
import { CelestialBody } from '../render/CelestialBody'
import { EARTH_PRESET } from '../render/presets'
import StationAgentChat from './agent/StationAgentChat'
import StationMarkers, { getStationInfo, getSatelliteInfo } from './r3f/StationMarkers'
import type { SelectedObjectInfo } from './r3f/StationMarkers'
import DetailPanel from '../shell/DetailPanel'
import type {
  GroundStation,
  SatelliteConfig,
  ElevationConstraint,
  VisibilityResult,
} from './services/stationTypes'
import { PRESET_STATIONS, DEFAULT_CONSTRAINT } from './services/stationTypes'
import {
  listScenes,
  createScene,
  saveScene,
  touchScene,
  deleteScene,
  addStation as addStationToScene,
  removeStation as removeStationFromScene,
  addSatellite as addSatelliteToScene,
  removeSatellite as removeSatelliteFromScene,
  saveResult,
} from './services/scenes'
import {
  runVisibility,
  searchCatalogSatellites,
  fetchCatalogGroup,
  QUICK_GROUPS,
  nowOrbitTime,
  offsetHours,
  formatOrbitTime,
  formatDuration,
  formatRange,
} from './services/stationService'
import type { SearchedSatellite } from './services/stationService'
import './station.css'

// ============ 预设地面站快捷选择下拉 ============

function PresetSelect({ onSelect }: { onSelect: (p: typeof PRESET_STATIONS[number]) => void }) {
  return (
    <select
      className="station-preset-select"
      defaultValue=""
      onChange={(e) => {
        const preset = PRESET_STATIONS.find((p) => p.name === e.target.value)
        if (preset) onSelect(preset)
        e.target.value = ''
      }}
    >
      <option value="" disabled>
        快速选择…
      </option>
      {PRESET_STATIONS.map((p) => (
        <option key={p.name} value={p.name}>
          {p.name}（{p.city}）
        </option>
      ))}
    </select>
  )
}

// ============ Access 报告表格 ============

function AccessReport({ result }: { result: VisibilityResult }) {
  const [expanded, setExpanded] = useState(false)

  if (result.windows.length === 0) {
    return <div className="station-report station-report--empty">在指定时间范围内未找到可见窗口</div>
  }
  const maxElevation = Math.max(...result.windows.map((w) => w.middle.elevationDegrees))
  const totalDuration = result.windows.reduce((s, w) => s + w.durationSeconds, 0)
  return (
    <div className={`station-report ${expanded ? 'station-report--expanded' : ''}`}>
      <div className="station-report__header">
        <div className="station-report__summary">
          <span>过站 {result.windows.length} 次</span>
          <span>总时长 {formatDuration(totalDuration)}</span>
          <span>最大仰角 {maxElevation.toFixed(1)}°</span>
          <span>{result.stationName} ↔ {result.satelliteName}</span>
        </div>
        <button
          className="station-report__expand-btn"
          onClick={() => setExpanded(!expanded)}
          title={expanded ? '缩小' : '放大'}
        >
          {expanded ? '⤡' : '⤢'}
        </button>
      </div>
      <div className="station-report__table-wrap">
        <table className="station-report__table">
          <thead>
            <tr>
              <th>#</th>
              <th>开始 (UTC)</th>
              <th>结束 (UTC)</th>
              <th>持续</th>
              <th>最大仰角</th>
              <th>入境方位</th>
              <th>出境方位</th>
              <th>最近距离</th>
            </tr>
          </thead>
          <tbody>
            {result.windows.map((w, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{formatOrbitTime(w.startTime)}</td>
                <td>{formatOrbitTime(w.endTime)}</td>
                <td>{formatDuration(w.durationSeconds)}</td>
                <td>{w.middle.elevationDegrees.toFixed(1)}°</td>
                <td>{w.entry.azimuthDegrees.toFixed(1)}°</td>
                <td>{w.exit.azimuthDegrees.toFixed(1)}°</td>
                <td>{formatRange(w.minimumRangeMeters)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============ 详情面板数据构建 ============

function buildDetailSections(info: SelectedObjectInfo): Array<{ title?: string; items: Array<{ key: string; value: string; description?: string }> }> {
  if (info.type === 'station' && info.station) {
    const s = info.station
    return [
      {
        title: '基本信息',
        items: [
          { key: '名称', value: s.name },
          { key: '经度', value: `${s.lon.toFixed(4)}°E`, description: '东经为正，西经为负' },
          { key: '纬度', value: `${s.lat.toFixed(4)}°N`, description: '北纬为正，南纬为负' },
          { key: '海拔', value: `${s.alt.toFixed(2)} km` },
        ],
      },
    ]
  }

  if (info.type === 'satellite' && info.satellite) {
    const sections: Array<{ title?: string; items: Array<{ key: string; value: string; description?: string }> }> = [
      {
        title: '基本信息',
        items: [
          { key: '名称', value: info.satellite.name },
          { key: '轨道类型', value: info.satellite.orbitType },
          ...(info.satellite.line1
            ? [{ key: 'NORAD', value: info.satellite.line1.substring(2, 7).trim() }]
            : []),
        ],
      },
    ]

    if (info.orbitInfo) {
      const o = info.orbitInfo
      sections.push({
        title: '轨道根数',
        items: [
          { key: '周期', value: `${o.periodMin.toFixed(1)} min` },
          { key: '倾角', value: `${o.inclinationDeg.toFixed(2)}°`, description: '轨道平面与赤道面的夹角' },
          { key: '偏心率', value: o.eccentricity.toFixed(6), description: '0=圆轨道，接近1=椭圆' },
          { key: '远地点', value: `${o.apogeeKm.toFixed(1)} km` },
          { key: '近地点', value: `${o.perigeeKm.toFixed(1)} km` },
          { key: 'RAAN', value: `${o.raanDeg.toFixed(2)}°`, description: '升交点赤经' },
          { key: '近地点幅角', value: `${o.argPerigeeDeg.toFixed(2)}°` },
          { key: '平近点角', value: `${o.meanAnomalyDeg.toFixed(2)}°` },
          { key: '日转数', value: o.meanMotionRevPerDay.toFixed(2), description: '每天绕地球圈数' },
        ],
      })
    }

    if (info.livePosition) {
      const p = info.livePosition
      sections.push({
        title: '实时数据',
        items: [
          { key: '经度', value: `${p.lonDeg.toFixed(4)}°` },
          { key: '纬度', value: `${p.latDeg.toFixed(4)}°` },
          { key: '高度', value: `${p.altKm.toFixed(1)} km` },
          { key: '速度', value: `${p.velocityKmS.toFixed(2)} km/s` },
        ],
      })
    }

    return sections
  }

  return []
}

// ============ 主页面 ============

export default function StationPage() {
  // 场景 CRUD
  const [sceneModalOpen, setSceneModalOpen] = useState(false)
  const [sceneId, setSceneId] = useState<string | null>(null)
  const [sceneName, setSceneName] = useState('')

  // 场景数据
  const [stations, setStations] = useState<GroundStation[]>([])
  const [satellites, setSatellites] = useState<SatelliteConfig[]>([])
  const [constraint, setConstraint] = useState<ElevationConstraint>({ ...DEFAULT_CONSTRAINT })
  const [lastResult, setLastResult] = useState<VisibilityResult | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 分析配置：选择地面站/卫星/时长
  const [selectedStationId, setSelectedStationId] = useState<string>('')
  const [selectedSatelliteId, setSelectedSatelliteId] = useState<string>('')
  const [analysisHours, setAnalysisHours] = useState(24)

  // 左侧编辑态
  const [editingStation, setEditingStation] = useState<Partial<GroundStation> | null>(null)
  const [editingSatellite, setEditingSatellite] = useState<Partial<SatelliteConfig> | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<SearchedSatellite[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [groupResults, setGroupResults] = useState<SearchedSatellite[]>([])
  const [loadingGroup, setLoadingGroup] = useState(false)
  // 相机聚焦目标（新增地面站/卫星时触发）
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lon: number; alt: number } | null>(null)
  // 选中对象详情
  const [selectedObject, setSelectedObject] = useState<SelectedObjectInfo | null>(null)

  const scenes = useRef(listScenes())

  // 加载场景
  const loadScene = useCallback((id: string) => {
    const all = listScenes()
    const s = all.find((sc) => sc.id === id)
    if (!s) return
    setSceneId(s.id)
    setSceneName(s.name)
    setStations(s.stations)
    setSatellites(s.satellites)
    setConstraint(s.constraint)
    setLastResult(s.lastResult ?? null)
    setShowReport(!!s.lastResult)
    setSelectedStationId(s.stations[0]?.id ?? '')
    setSelectedSatelliteId(s.satellites[0]?.id ?? '')
    scenes.current = all
  }, [])

  // 恢复上次场景，无场景则自动创建
  useEffect(() => {
    scenes.current = listScenes()
    const flag = sessionStorage.getItem('aoe_pro_open_scenes_station')
    if (flag) {
      sessionStorage.removeItem('aoe_pro_open_scenes_station')
      setSceneModalOpen(true)
      return
    }
    if (scenes.current.length > 0) {
      loadScene(scenes.current[0].id)
    } else {
      // 自动创建默认场景
      const s = createScene('测控仿真')
      scenes.current = listScenes()
      loadScene(s.id)
    }
  }, [loadScene])

  // 同页点击导航轨
  useEffect(() => {
    const handler = () => setSceneModalOpen(true)
    window.addEventListener('aoe:open-scene-modal', handler)
    return () => window.removeEventListener('aoe:open-scene-modal', handler)
  }, [])

  // 持久化当前场景
  const persistScene = useCallback(
    (overrides?: Partial<{ stations: GroundStation[]; satellites: SatelliteConfig[]; constraint: ElevationConstraint; lastResult: VisibilityResult }>) => {
      if (!sceneId) return
      const s = {
        id: sceneId,
        name: sceneName,
        stations: overrides?.stations ?? stations,
        satellites: overrides?.satellites ?? satellites,
        constraint: overrides?.constraint ?? constraint,
        lastResult: overrides?.lastResult ?? lastResult,
        createdAt: 0,
        updatedAt: Date.now(),
      }
      saveScene(s as any)
    },
    [sceneId, sceneName, stations, satellites, constraint, lastResult],
  )

  // ============ Agent 动作执行器 ============

  const executeAgentActions = useCallback(
    (actions: Record<string, unknown>[]): string[] => {
      const results: string[] = []
      for (const action of actions) {
        switch (action.type) {
          case 'create_station': {
            const name = String(action.name || '新地面站')
            const lon = Number(action.lon)
            const lat = Number(action.lat)
            const alt = Number(action.alt ?? 0)
            if (isNaN(lon) || isNaN(lat)) {
              results.push('缺少经度或纬度参数')
              break
            }
            const id = `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            const station: GroundStation = { id, name, lon, lat, alt }
            const updated = addStationToScene({ id: sceneId!, name: sceneName, stations, satellites, constraint, createdAt: 0, updatedAt: 0 } as any, station)
            setStations(updated.stations)
            setSelectedStationId(id)
            setFocusTarget({ lat, lon, alt: 0 })
            saveScene(updated as any)
            results.push(`已创建地面站「${name}」：${lon}°E, ${lat}°N, 海拔 ${alt}km`)
            break
          }
          case 'create_satellite': {
            const name = String(action.name || '新卫星')
            const line1 = action.line1 ? String(action.line1) : undefined
            const line2 = action.line2 ? String(action.line2) : undefined
            const oe = action.oe as any
            if (!line1 && !oe) {
              results.push('缺少轨道参数（TLE 或开普勒六根数），请先用 sta_search_satellite 搜索')
              break
            }
            const id = `sat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            const sat: SatelliteConfig = {
              id,
              name,
              orbitType: line1 ? 'TLE' : 'KEPLER',
              line1,
              line2,
              oe: oe ? { a: oe.a, e: oe.e, i: oe.i, xw: oe.xw, dw: oe.dw, M: oe.M } : undefined,
            }
            const updated = addSatelliteToScene({ id: sceneId!, name: sceneName, stations, satellites, constraint, createdAt: 0, updatedAt: 0 } as any, sat)
            setSatellites(updated.satellites)
            setSelectedSatelliteId(id)
            setFocusTarget({ lat: 0, lon: 0, alt: 500 })
            saveScene(updated as any)
            results.push(`已创建卫星「${name}」（${sat.orbitType}）`)
            break
          }
          case 'set_constraint': {
            const c: ElevationConstraint = {
              minElevation: Number(action.min_elevation ?? 10),
              azimuthMin: Number(action.azimuth_min ?? 0),
              azimuthMax: Number(action.azimuth_max ?? 360),
            }
            setConstraint(c)
            persistScene({ constraint: c })
            results.push(`已设置约束：最小仰角 ${c.minElevation}°，方位角 ${c.azimuthMin}°~${c.azimuthMax}°`)
            break
          }
          case 'run_visibility': {
            if (stations.length === 0) { results.push('当前没有地面站，请先创建'); break }
            if (satellites.length === 0) { results.push('当前没有卫星，请先创建'); break }
            const stId = action.station_id ? String(action.station_id) : selectedStationId || stations[0].id
            const satId = action.satellite_id ? String(action.satellite_id) : selectedSatelliteId || satellites[0].id
            const st = stations.find((s) => s.id === stId) ?? stations[0]
            const sat = satellites.find((s) => s.id === satId) ?? satellites[0]
            const hours = Number(action.hours ?? analysisHours)
            const start = nowOrbitTime()
            const end = offsetHours(start, hours)
            results.push(`正在计算 ${st.name} ↔ ${sat.name} 的可见性（未来 ${hours} 小时）…`)
            // 异步执行，结果更新到状态
            runVisibility(sat, st, constraint, start, end)
              .then((r) => {
                setLastResult(r)
                setShowReport(true)
                if (sceneId) {
                  const updated = saveResult({ id: sceneId, name: sceneName, stations, satellites, constraint, createdAt: 0, updatedAt: 0 } as any, r)
                  saveScene(updated as any)
                }
              })
              .catch((e) => setError(e instanceof Error ? e.message : '可见性计算失败'))
            break
          }
          case 'search_satellite': {
            const keyword = String(action.keyword || '')
            if (!keyword) { results.push('缺少搜索关键词'); break }
            results.push(`正在搜索「${keyword}」…`)
            searchCatalogSatellites(keyword)
              .then((r) => {
                setSearchResults(r)
                if (r.length === 0) setError(`未找到与「${keyword}」匹配的卫星`)
              })
              .catch((e) => setError(e instanceof Error ? e.message : '搜索失败'))
            break
          }
          case 'show_report': {
            setShowReport(action.show !== false)
            results.push(action.show !== false ? '已打开报告面板' : '已关闭报告面板')
            break
          }
          default:
            results.push(`未知操作：${action.type}`)
        }
      }
      return results
    },
    [sceneId, sceneName, stations, satellites, constraint, lastResult, selectedStationId, selectedSatelliteId, analysisHours, persistScene],
  )

  // ============ buildPromptContext ============

  const buildPromptContext = useCallback((): string => {
    const parts: string[] = []
    parts.push(`## 场景状态`)
    parts.push(`场景名：${sceneName}`)
    parts.push(`地面站 ${stations.length} 个：${stations.map((s) => `${s.name}(${s.lon}°E/${s.lat}°N)`).join('、') || '无'}`)
    parts.push(`卫星 ${satellites.length} 颗：${satellites.map((s) => `${s.name}(${s.orbitType})`).join('、') || '无'}`)
    parts.push(`约束：最小仰角 ${constraint.minElevation}°，方位角 ${constraint.azimuthMin}°~${constraint.azimuthMax}°`)
    if (lastResult) {
      parts.push(`最近计算：${lastResult.stationName} ↔ ${lastResult.satelliteName}，${lastResult.windows.length} 次过站`)
      if (lastResult.windows.length > 0) {
        const w = lastResult.windows[0]
        parts.push(`最近一次：${formatOrbitTime(w.startTime)} ~ ${formatOrbitTime(w.endTime)}，持续 ${formatDuration(w.durationSeconds)}，最大仰角 ${w.middle.elevationDegrees.toFixed(1)}°`)
      }
    }
    if (searchResults.length > 0) {
      parts.push(`搜索到的卫星（可选）：${searchResults.slice(0, 10).map((s) => s.name).join('、')}`)
    }
    return parts.join('\n')
  }, [sceneName, stations, satellites, constraint, lastResult, searchResults])

  // ============ 场景 CRUD 回调 ============

  const handleCreateScene = useCallback(() => {
    const s = createScene('新测控场景')
    loadScene(s.id)
    setSceneModalOpen(false)
  }, [loadScene])

  const handleSwitchScene = useCallback(
    (id: string) => {
      loadScene(id)
      setSceneModalOpen(false)
    },
    [loadScene],
  )

  const handleDeleteScene = useCallback(
    (id: string) => {
      deleteScene(id)
      scenes.current = listScenes()
      if (sceneId === id) {
        if (scenes.current.length > 0) loadScene(scenes.current[0].id)
        else { setSceneId(null); setSceneModalOpen(true) }
      }
    },
    [sceneId, loadScene],
  )

  const handleRenameScene = useCallback(
    (id: string, name: string) => {
      const all = listScenes()
      const s = all.find((sc) => sc.id === id)
      if (s) { s.name = name; saveScene(s); scenes.current = all; if (sceneId === id) setSceneName(name) }
    },
    [sceneId],
  )

  // ============ UI 回调 ============

  const handleAddStation = () => {
    setEditingStation({ name: '', lon: 116.4, lat: 39.9, alt: 0.05 })
  }

  const handleSaveStation = () => {
    if (!editingStation || !editingStation.name || editingStation.lon == null || editingStation.lat == null) return
    const id = editingStation.id ?? `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const station: GroundStation = { id, name: editingStation.name!, lon: editingStation.lon!, lat: editingStation.lat!, alt: editingStation.alt ?? 0 }
    let updated
    if (editingStation.id) {
      // 编辑已有
      updated = { ...stations.map((s) => (s.id === id ? station : s)) }
    } else {
      updated = addStationToScene({ id: sceneId!, name: sceneName, stations, satellites, constraint, createdAt: 0, updatedAt: 0 } as any, station)
    }
    const newStations = Array.isArray(updated) ? updated : (updated as any).stations ?? [...stations, station]
    setStations(newStations)
    setSelectedStationId(id)
    setFocusTarget({ lat: station.lat, lon: station.lon, alt: 0 })
    persistScene({ stations: newStations })
    setEditingStation(null)
  }

  const handleRemoveStation = (id: string) => {
    const updated = removeStationFromScene({ id: sceneId!, name: sceneName, stations, satellites, constraint, createdAt: 0, updatedAt: 0 } as any, id)
    setStations(updated.stations)
    persistScene({ stations: updated.stations })
  }

  const handleSelectPreset = (p: typeof PRESET_STATIONS[number]) => {
    setEditingStation({ name: p.name, lon: p.lon, lat: p.lat, alt: p.alt })
  }

  const handleAddSatellite = () => {
    setEditingSatellite({ name: '', orbitType: 'TLE', line1: '', line2: '' })
  }

  const handleSaveSatellite = () => {
    if (!editingSatellite || !editingSatellite.name) return
    const id = editingSatellite.id ?? `sat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const sat: SatelliteConfig = {
      id,
      name: editingSatellite.name!,
      orbitType: editingSatellite.orbitType ?? 'TLE',
      line1: editingSatellite.line1,
      line2: editingSatellite.line2,
      oe: editingSatellite.oe,
    }
    const updated = addSatelliteToScene({ id: sceneId!, name: sceneName, stations, satellites, constraint, createdAt: 0, updatedAt: 0 } as any, sat)
    setSatellites(updated.satellites)
    setSelectedSatelliteId(id)
    setFocusTarget({ lat: 0, lon: 0, alt: 500 })
    persistScene({ satellites: updated.satellites })
    setEditingSatellite(null)
  }

  const handleRemoveSatellite = (id: string) => {
    const updated = removeSatelliteFromScene({ id: sceneId!, name: sceneName, stations, satellites, constraint, createdAt: 0, updatedAt: 0 } as any, id)
    setSatellites(updated.satellites)
    persistScene({ satellites: updated.satellites })
  }

  const handleRunVisibility = async () => {
    console.log('[Station] 点击运行', { stations: stations.length, satellites: satellites.length, selectedStationId, selectedSatelliteId })
    if (stations.length === 0 || satellites.length === 0) {
      console.log('[Station] 缺少对象，提示错误')
      setError('需要至少一个地面站和一颗卫星才能运行分析')
      return
    }
    const st = stations.find((s) => s.id === selectedStationId) ?? stations[0]
    const sat = satellites.find((s) => s.id === selectedSatelliteId) ?? satellites[0]
    console.log('[Station] 选中:', { station: st?.name, satellite: sat?.name })
    if (!st || !sat) {
      setError('未找到选定的地面站或卫星')
      return
    }
    setComputing(true)
    setError(null)
    try {
      const start = nowOrbitTime()
      const end = offsetHours(start, analysisHours)
      console.log('[Station] 调用 runVisibility...')
      const result = await runVisibility(sat, st, constraint, start, end)
      console.log('[Station] 成功:', result.windows.length, '个窗口')
      setLastResult(result)
      setShowReport(true)
      if (sceneId) {
        const updated = saveResult({ id: sceneId, name: sceneName, stations, satellites, constraint, createdAt: 0, updatedAt: 0 } as any, result)
        saveScene(updated as any)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '计算失败'
      console.error('[Station] 分析失败:', msg, e)
      setError(`可见性分析失败：${msg}`)
    } finally {
      setComputing(false)
    }
  }

  const handleSearchSatellite = async () => {
    if (!searchKeyword.trim()) return
    setSearching(true)
    setError(null)
    try {
      const results = await searchCatalogSatellites(searchKeyword.trim())
      setSearchResults(results)
      if (results.length === 0) setError(`未找到「${searchKeyword}」`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '搜索失败')
    } finally {
      setSearching(false)
    }
  }

  /** 加载星座分组卫星列表 */
  const handleLoadGroup = async (groupKey: string) => {
    setSelectedGroup(groupKey)
    setGroupResults([])
    setLoadingGroup(true)
    setError(null)
    try {
      const results = await fetchCatalogGroup(groupKey)
      setGroupResults(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载星座数据失败')
    } finally {
      setLoadingGroup(false)
    }
  }

  // ============ 选中交互 ============

  const handleSelectStation = useCallback(
    (id: string) => {
      setSelectedStationId(id)
      const st = stations.find((s) => s.id === id)
      if (st) setSelectedObject(getStationInfo(st))
    },
    [stations],
  )

  const handleSelectSatellite = useCallback(
    (id: string) => {
      setSelectedSatelliteId(id)
      const sat = satellites.find((s) => s.id === id)
      if (sat) {
        setSelectedObject(getSatelliteInfo(sat))
        setFocusTarget({ lat: 0, lon: 0, alt: 500 })
      }
    },
    [satellites],
  )

  // 无场景时显示占位
  if (!sceneId) {
    return (
      <section className="station-empty">
        <p>选择或新建一个测控场景</p>
        {sceneModalOpen && (
          <SceneManagerModal
            scenes={[]}
            activeSceneId={null}
            onCreate={handleCreateScene}
            onSelect={handleSwitchScene}
            onDelete={handleDeleteScene}
            onRename={handleRenameScene}
            onClose={() => setSceneModalOpen(false)}
          />
        )}
      </section>
    )
  }

  return (
    <ProSceneShell
      sidebar={
        <div className="station-sidebar">
          {/* 地面站列表 */}
          <section className="station-sidebar__section">
            <div className="station-sidebar__header">
              <span className="station-sidebar__title">地面站</span>
              <button className="station-sidebar__add" onClick={handleAddStation} title="新增地面站">
                +
              </button>
            </div>
            {stations.length === 0 && <p className="station-sidebar__hint">暂无地面站，点击 + 添加</p>}
            {stations.map((s) => (
              <div key={s.id} className="station-sidebar__item">
                <span className="station-sidebar__item-name" title={`${s.lon}°E, ${s.lat}°N`}>
                  {s.name}
                </span>
                <span className="station-sidebar__item-meta">
                  {s.lon.toFixed(1)}°E {s.lat.toFixed(1)}°N
                </span>
                <button className="station-sidebar__remove" onClick={() => handleRemoveStation(s.id)} title="删除">
                  ×
                </button>
              </div>
            ))}
          </section>

          {/* 卫星列表 */}
          <section className="station-sidebar__section">
            <div className="station-sidebar__header">
              <span className="station-sidebar__title">卫星</span>
              <button className="station-sidebar__add" onClick={handleAddSatellite} title="新增卫星">
                +
              </button>
            </div>
            {satellites.length === 0 && <p className="station-sidebar__hint">暂无卫星，点击 + 添加</p>}
            {satellites.map((s) => (
              <div key={s.id} className="station-sidebar__item">
                <span className="station-sidebar__item-name">{s.name}</span>
                <span className="station-sidebar__item-meta">{s.orbitType}</span>
                <button className="station-sidebar__remove" onClick={() => handleRemoveSatellite(s.id)} title="删除">
                  ×
                </button>
              </div>
            ))}
          </section>

          {/* 仰角约束 */}
          <section className="station-sidebar__section">
            <span className="station-sidebar__title">约束</span>
            <label className="station-sidebar__field">
              <span>最小仰角</span>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={constraint.minElevation}
                onChange={(e) => {
                  const c = { ...constraint, minElevation: Number(e.target.value) }
                  setConstraint(c)
                  persistScene({ constraint: c })
                }}
              />
              <span className="station-sidebar__field-value">{constraint.minElevation}°</span>
            </label>
          </section>

          {/* 分析配置 */}
          <section className="station-sidebar__section">
            <span className="station-sidebar__title">分析配置</span>
            {stations.length > 0 && (
              <label className="station-sidebar__field--col">
                <span>地面站</span>
                <select
                  className="station-sidebar__select"
                  value={selectedStationId}
                  onChange={(e) => setSelectedStationId(e.target.value)}
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            )}
            {satellites.length > 0 && (
              <label className="station-sidebar__field--col">
                <span>卫星</span>
                <select
                  className="station-sidebar__select"
                  value={selectedSatelliteId}
                  onChange={(e) => setSelectedSatelliteId(e.target.value)}
                >
                  {satellites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="station-sidebar__field--col">
              <span>分析时长</span>
              <div className="station-sidebar__hours-row">
                <input
                  type="number"
                  className="station-sidebar__hours-input"
                  min={1}
                  max={168}
                  value={analysisHours}
                  onChange={(e) => setAnalysisHours(Math.max(1, Math.min(168, Number(e.target.value))))}
                />
                <span className="station-sidebar__hours-unit">小时</span>
              </div>
            </label>
          </section>

          {/* 运行按钮 */}
          <button
            className="btn btn--primary station-sidebar__run"
            onClick={handleRunVisibility}
            disabled={computing}
          >
            {computing ? '计算中…' : '运行可见性分析'}
          </button>

          {error && <p className="station-sidebar__error">{error}</p>}

          {/* 编辑弹层：地面站 */}
          {editingStation && (
            <div className="station-edit-overlay">
              <div className="station-edit-form">
                <h4>{editingStation.id ? '编辑' : '新增'}地面站</h4>
                {!editingStation.id && <PresetSelect onSelect={handleSelectPreset} />}
                <label>
                  名称
                  <input value={editingStation.name ?? ''} onChange={(e) => setEditingStation({ ...editingStation, name: e.target.value })} />
                </label>
                <label>
                  经度（°）
                  <input type="number" value={editingStation.lon ?? ''} onChange={(e) => setEditingStation({ ...editingStation, lon: Number(e.target.value) })} />
                </label>
                <label>
                  纬度（°）
                  <input type="number" value={editingStation.lat ?? ''} onChange={(e) => setEditingStation({ ...editingStation, lat: Number(e.target.value) })} />
                </label>
                <label>
                  海拔（km）
                  <input type="number" step="0.01" value={editingStation.alt ?? 0} onChange={(e) => setEditingStation({ ...editingStation, alt: Number(e.target.value) })} />
                </label>
                <div className="station-edit-form__actions">
                  <button className="btn btn--ghost" onClick={() => setEditingStation(null)}>
                    取消
                  </button>
                  <button className="btn" onClick={handleSaveStation}>
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 编辑弹层：卫星 */}
          {editingSatellite && (
            <div className="station-edit-overlay">
              <div className="station-edit-form">
                <h4>{editingSatellite.id ? '编辑' : '新增'}卫星</h4>
                {!editingSatellite.id && (
                  <>
                    {/* 快速选择：星座分组 */}
                    <div className="station-quick-group">
                      <label className="station-quick-group__label">快速选择</label>
                      <div className="station-quick-group__buttons">
                        {QUICK_GROUPS.map((g) => (
                          <button
                            key={g.key}
                            className={`station-quick-group__btn ${selectedGroup === g.key ? 'station-quick-group__btn--active' : ''}`}
                            onClick={() => handleLoadGroup(g.key)}
                            disabled={loadingGroup}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                      {loadingGroup && <p className="station-search__loading">加载中…</p>}
                      {groupResults.length > 0 && (
                        <div className="station-search__results">
                          <div className="station-search__results-header">
                            <span>{QUICK_GROUPS.find((g) => g.key === selectedGroup)?.label}</span>
                            <span className="station-search__results-count">{groupResults.length} 颗</span>
                          </div>
                          <div className="station-search__results-list">
                            {groupResults.slice(0, 50).map((sr, i) => (
                              <button key={i} className="station-search__item" onClick={() => {
                                setEditingSatellite({ name: sr.name, orbitType: 'TLE', line1: sr.line1, line2: sr.line2 })
                                setGroupResults([])
                                setSelectedGroup('')
                                setSearchResults([])
                              }}>
                                {sr.name}
                              </button>
                            ))}
                            {groupResults.length > 50 && (
                              <div className="station-search__results-more">还有 {groupResults.length - 50} 颗，请使用搜索筛选</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 关键词搜索 */}
                    <div className="station-search">
                      <input placeholder="搜索卫星名称（如 北斗、ISS）" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchSatellite()} />
                      <button className="btn btn--ghost" onClick={handleSearchSatellite} disabled={searching}>
                        {searching ? '…' : '搜索'}
                      </button>
                      {searchResults.length > 0 && (
                        <div className="station-search__results">
                          <div className="station-search__results-header">
                            <span>搜索结果</span>
                            <span className="station-search__results-count">{searchResults.length} 条</span>
                          </div>
                          <div className="station-search__results-list">
                            {searchResults.map((sr, i) => (
                              <button key={i} className="station-search__item" onClick={() => {
                                setEditingSatellite({ name: sr.name, orbitType: 'TLE', line1: sr.line1, line2: sr.line2 })
                                setSearchResults([])
                                setSearchKeyword('')
                                setGroupResults([])
                              }}>
                                {sr.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <label>
                  名称
                  <input value={editingSatellite.name ?? ''} onChange={(e) => setEditingSatellite({ ...editingSatellite, name: e.target.value })} />
                </label>
                {editingSatellite.orbitType === 'TLE' && (
                  <>
                    <label>
                      TLE 第一行
                      <input value={editingSatellite.line1 ?? ''} onChange={(e) => setEditingSatellite({ ...editingSatellite, line1: e.target.value })} placeholder="1 NNNNN..." />
                    </label>
                    <label>
                      TLE 第二行
                      <input value={editingSatellite.line2 ?? ''} onChange={(e) => setEditingSatellite({ ...editingSatellite, line2: e.target.value })} placeholder="2 NNNNN..." />
                    </label>
                  </>
                )}
                <div className="station-edit-form__actions">
                  <button className="btn btn--ghost" onClick={() => { setEditingSatellite(null); setSearchResults([]); setGroupResults([]); setSelectedGroup('') }}>
                    取消
                  </button>
                  <button className="btn" onClick={handleSaveSatellite}>
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      }
      agent={
        <StationAgentChat
          sceneId={sceneId}
          buildPromptContext={buildPromptContext}
          executeActions={executeAgentActions}
          onAgentReply={() => touchScene(sceneId)}
        />
      }
      expandedPanel={showReport && lastResult ? <AccessReport result={lastResult} /> : undefined}
      overlays={
        selectedObject && (
          <div className="station-detail-wrapper" style={{ position: 'absolute', top: 16, right: 16, zIndex: 30, pointerEvents: 'auto' }}>
            <DetailPanel
              title={selectedObject.name}
              onClose={() => setSelectedObject(null)}
              sections={buildDetailSections(selectedObject)}
            />
          </div>
        )
      }
      stats={
        lastResult ? (
          <span>
            {lastResult.stationName} ↔ {lastResult.satelliteName}：{lastResult.windows.length} 次过站，
            最近 {lastResult.windows.length > 0 ? formatOrbitTime(lastResult.windows[0].startTime) : '-'}
          </span>
        ) : (
          <span>尚未运行可见性分析</span>
        )
      }
      sceneModal={
        sceneModalOpen ? (
          <SceneManagerModal
            scenes={scenes.current}
            activeSceneId={sceneId ?? ''}
            onCreate={handleCreateScene}
            onSelect={handleSwitchScene}
            onDelete={handleDeleteScene}
            onRename={handleRenameScene}
            onClose={() => setSceneModalOpen(false)}
          />
        ) : undefined
      }
    >
      {/* 地球底座 + 地面站/卫星标记 */}
      <Canvas camera={{ position: [0, 0, EARTH_PRESET.radiusKm / 1000 * 3], fov: 45 }} style={{ background: '#050a16' }}>
        <CelestialBody
          radiusKm={EARTH_PRESET.radiusKm}
          dayTexture={EARTH_PRESET.dayTexture}
          textureOffsetY={EARTH_PRESET.textureOffsetY}
          atmosphere={EARTH_PRESET.atmosphere}
          onReady={() => {}}
          onError={() => {}}
        />
        <StationMarkers
          stations={stations}
          selectedStationId={selectedStationId}
          satellites={satellites}
          selectedSatelliteId={selectedSatelliteId}
          focusTarget={focusTarget}
          onFocused={() => setFocusTarget(null)}
          onSelectStation={handleSelectStation}
          onSelectSatellite={handleSelectSatellite}
        />
        <ambientLight intensity={1} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={EARTH_PRESET.radiusKm / 1000 * 1.5}
          maxDistance={EARTH_PRESET.radiusKm / 1000 * 10}
        />
      </Canvas>
    </ProSceneShell>
  )
}
