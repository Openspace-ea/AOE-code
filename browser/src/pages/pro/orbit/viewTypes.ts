/**
 * 轨道模式 3D 视图的对外契约：imperative 句柄 + 底图注册表
 *
 * 历史：对比期为 Cesium/R3F 双引擎同形句柄（9 方法）；S4 Cesium 统一下线后
 * R3F（r3f/OrbitR3fView）成为唯一引擎，句柄接口与底图键保持不变，
 * OrbitPage 的 ref/回调接线不变。
 */

import type { BasemapOption } from '../shell/BasemapMenu'
import type { GeoPosition } from './services/types'

/**
 * 底图键（键与 render/presets.ts 的 EARTH_PRESET.basemaps 一一对应；
 * 拉近时的高清细节瓦片源见 presets.BASEMAP_DETAIL_SOURCES 与 render/TileDetailLayer）
 */
export type BasemapKey = 'tex-day' | 'tex-map'

/** 底图菜单选项 */
export const BASEMAP_OPTIONS: BasemapOption[] = [
  { key: 'tex-day', label: '卫星影像' },
  { key: 'tex-map', label: '地图' },
]

/** 单个目标的实时位置（父组件推入） */
export interface SatPositionItem {
  noradId: string
  group: string
  latDeg: number
  lonDeg: number
  altKm: number
}

/** 轨道 3D 视图 imperative 句柄（位置数据由父组件按秒级节拍推入） */
export interface OrbitViewHandle {
  /** 全量同步点位：更新已有、新增缺失、移除消失 */
  syncSatellites: (items: SatPositionItem[], groupColors: Record<string, string>) => void
  /** 设置选中目标（附轨道线采样点与分组色；orbitRing 为 3D 惯性系轨道环，orbit 为 2D 星下点轨迹）；null 取消选中 */
  setSelected: (
    noradId: string | null,
    name: string,
    orbit: GeoPosition[] | null,
    color?: string,
    orbitRing?: [number, number, number][] | null,
  ) => void
  /** 设置悬停目标（附 1.2 圈轨道采样点与分组色，参数同 setSelected）；null 取消悬停 */
  setHovered: (
    noradId: string | null,
    name: string,
    orbit: GeoPosition[] | null,
    color?: string,
    orbitRing?: [number, number, number][] | null,
  ) => void
  /** 相机飞到指定经纬度上空 */
  flyTo: (latDeg: number, lonDeg: number, heightKm?: number) => void
  /** 开启/关闭对选中目标的跟踪视角 */
  setFollow: (follow: boolean) => void
  /** 3D/2D 场景切换（R3F 为直接切换，无 morph 动画） */
  morphTo: (mode: '2d' | '3d') => void
  /** 切换底图 */
  setBasemap: (key: BasemapKey) => void
  /** 写入仿真时间（ms 时间戳）：驱动昼夜光照推演 */
  setSimTime: (timeMs: number) => void
  /** 写入播放状态：地球自转随仿真时钟（暂停不转、倍速加速） */
  setPlayback: (playing: boolean, speed: number) => void
  /** 自适应最远缩放（按已启用星座的最高轨道高度，确保能看全星座） */
  setMaxZoom: (distanceMeters: number) => void
  /** 设置高亮卫星集合：null = 全部正常；非空 = 集合内100%，其余30% */
  setHighlight: (noradIds: Set<string> | null) => void
}
