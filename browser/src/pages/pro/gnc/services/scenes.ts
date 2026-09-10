/**
 * GNC 发射模拟场景管理（localStorage 持久化）
 *
 * 场景 = 发射模拟的一份工作区配置：发射站、目标轨道、时间倍速。
 * 与轨道模式 scenes.ts 结构一致，存储键独立。
 */

const STORAGE_KEY = 'aoe_gnc_scenes'

export interface GncScene {
  id: string
  name: string
  /** 发射站代码（如 JSC、KSC） */
  siteCode: string
  /** 目标轨道高度 km */
  targetAltKm: number
  /** 目标轨道倾角 deg */
  targetIncDeg: number
  /** 时间倍速 */
  speed: number
  createdAt: number
  updatedAt: number
}

export const DEFAULT_SITE_CODE = 'JSC'
export const DEFAULT_TARGET_ALT = 400
export const DEFAULT_TARGET_INC = 42

export function listScenes(): GncScene[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const scenes = raw ? (JSON.parse(raw) as GncScene[]) : []
    return scenes.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

function persist(scenes: GncScene[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes))
}

export function createScene(name: string): GncScene {
  const now = Date.now()
  const scene: GncScene = {
    id: `gnc-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    siteCode: DEFAULT_SITE_CODE,
    targetAltKm: DEFAULT_TARGET_ALT,
    targetIncDeg: DEFAULT_TARGET_INC,
    speed: 1,
    createdAt: now,
    updatedAt: now,
  }
  persist([scene, ...listScenes()])
  return scene
}

export function saveScene(scene: GncScene): void {
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
