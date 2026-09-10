/**
 * 专业模式注册表
 *
 * 专业模式是容器：各智能 Agent 场景（轨道、发射模拟、对接模拟、ATK 等）
 * 以子模式挂载到 /pro/<mode>。enabled=false 的模式在导航轨中置灰占位。
 */

export interface ProMode {
  key: string
  label: string
  icon: string
  path: string
  enabled: boolean
}

/** 点击模式导航时置的浮框标志前缀（sessionStorage，目标页面挂载后读取并弹出场景管理浮框） */
export const OPEN_SCENES_FLAG_PREFIX = 'aoe_pro_open_scenes_'

/** 已在模式内时点击模式导航，派发此事件弹出场景管理浮框 */
export const OPEN_SCENE_MODAL_EVENT = 'aoe:open-scene-modal'

export const PRO_MODES: ProMode[] = [
  { key: 'orbit', label: '轨道模式', icon: '🛰', path: '/pro/orbit', enabled: true },
  { key: 'gnc', label: '发射模拟', icon: '🚀', path: '/pro/gnc', enabled: true },
  { key: 'station', label: '测控仿真', icon: '📡', path: '/pro/station', enabled: true },
  { key: 'dock', label: '对接模拟', icon: '🔗', path: '/pro/dock', enabled: false },
  { key: 'atk', label: 'ATK 分析', icon: '📐', path: '/pro/atk', enabled: false },
  { key: 'algo', label: '专业算法', icon: '🧮', path: '/pro/algo', enabled: false },
  { key: 'manage', label: '航天器管理', icon: '📋', path: '/pro/manage', enabled: false },
]
