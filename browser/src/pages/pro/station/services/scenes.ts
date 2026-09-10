/**
 * 测控仿真场景管理（localStorage 持久化）
 *
 * 结构与 gnc/services/scenes.ts 一致，存储键独立。
 */

import type { StationScene, GroundStation, SatelliteConfig, ElevationConstraint, VisibilityResult } from './stationTypes'
import { DEFAULT_CONSTRAINT } from './stationTypes'

const STORAGE_KEY = 'aoe_station_scenes'

export function listScenes(): StationScene[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const scenes = raw ? (JSON.parse(raw) as StationScene[]) : []
    return scenes.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

function persist(scenes: StationScene[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes))
}

export function createScene(name: string): StationScene {
  const now = Date.now()
  const scene: StationScene = {
    id: `sta-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    stations: [],
    satellites: [],
    constraint: { ...DEFAULT_CONSTRAINT },
    createdAt: now,
    updatedAt: now,
  }
  persist([scene, ...listScenes()])
  return scene
}

export function saveScene(scene: StationScene): void {
  const scenes = listScenes()
  const index = scenes.findIndex((s) => s.id === scene.id)
  if (index >= 0) {
    scenes[index] = scene
  } else {
    scenes.unshift(scene)
  }
  persist(scenes)
}

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

// ============ 场景数据操作（返回新场景对象，由调用方 saveScene） ============

export function addStation(scene: StationScene, station: GroundStation): StationScene {
  return { ...scene, stations: [...scene.stations, station], updatedAt: Date.now() }
}

export function removeStation(scene: StationScene, stationId: string): StationScene {
  return { ...scene, stations: scene.stations.filter((s) => s.id !== stationId), updatedAt: Date.now() }
}

export function addSatellite(scene: StationScene, sat: SatelliteConfig): StationScene {
  return { ...scene, satellites: [...scene.satellites, sat], updatedAt: Date.now() }
}

export function removeSatellite(scene: StationScene, satId: string): StationScene {
  return { ...scene, satellites: scene.satellites.filter((s) => s.id !== satId), updatedAt: Date.now() }
}

export function updateConstraint(scene: StationScene, constraint: ElevationConstraint): StationScene {
  return { ...scene, constraint, updatedAt: Date.now() }
}

export function saveResult(scene: StationScene, result: VisibilityResult): StationScene {
  return { ...scene, lastResult: result, updatedAt: Date.now() }
}
