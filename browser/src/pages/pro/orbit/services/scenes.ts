/**
 * 场景管理（localStorage 持久化）
 *
 * 场景 = 轨道模式的一份工作区配置：启用的星座分组、选中目标、时间倍速。
 * 后续如需多端同步，可迁移到后端（当前无场景 API）。
 */

const STORAGE_KEY = 'aoe_orbit_scenes'

export interface OrbitScene {
  id: string
  name: string
  /** 启用的分组 key 列表 */
  groups: string[]
  /** 选中航天器的 NORAD 编号 */
  selectedNoradId?: string
  /** 时间倍速（1/10/60） */
  speed: number
  createdAt: number
  updatedAt: number
}

export const DEFAULT_SCENE_GROUPS = ['stations', 'beidou', 'gps']

export function listScenes(): OrbitScene[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const scenes = raw ? (JSON.parse(raw) as OrbitScene[]) : []
    return scenes.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

function persist(scenes: OrbitScene[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes))
}

export function createScene(name: string): OrbitScene {
  const now = Date.now()
  const scene: OrbitScene = {
    id: `scene-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    groups: [...DEFAULT_SCENE_GROUPS],
    speed: 1,
    createdAt: now,
    updatedAt: now,
  }
  persist([scene, ...listScenes()])
  return scene
}

export function saveScene(scene: OrbitScene): void {
  const scenes = listScenes()
  const index = scenes.findIndex((s) => s.id === scene.id)
  if (index >= 0) {
    scenes[index] = scene
  } else {
    scenes.unshift(scene)
  }
  persist(scenes)
}

/** 仅更新场景的时间戳（Agent 回复时调用） */
export function touchScene(id: string): void {
  const scenes = listScenes()
  const scene = scenes.find((s) => s.id === id)
  if (scene) {
    scene.updatedAt = Date.now()
    persist(scenes)
  }
}

export function deleteScene(id: string): void {
  persist(listScenes().filter((s) => s.id !== id))
}
