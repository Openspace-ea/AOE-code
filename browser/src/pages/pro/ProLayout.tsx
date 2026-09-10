/**
 * 专业模式布局：左侧模式导航轨 + 子模式工作区（路由出口）
 *
 * 导航轨是用户切换场景/模式的入口：点击模式即弹出该模式的场景管理浮框
 * （新建/选择历史场景），选定后进入专注工作区——场景管理不占用工作区窗口。
 * 可用模式高亮，未上线模式置灰（敬请期待）。
 */

import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  OPEN_SCENE_MODAL_EVENT,
  OPEN_SCENES_FLAG_PREFIX,
  PRO_MODES,
  type ProMode,
} from './modes'
import './pro.css'

export default function ProLayout() {
  const location = useLocation()
  const [comingSoonOpen, setComingSoonOpen] = useState(false)
  const enabledModes = PRO_MODES.filter((m) => m.enabled)
  const disabledModes = PRO_MODES.filter((m) => !m.enabled)

  /** 点击模式：置浮框标志；若已在该模式内，直接派发事件弹浮框（不跳转） */
  const handleModeClick = (e: React.MouseEvent, mode: ProMode) => {
    sessionStorage.setItem(OPEN_SCENES_FLAG_PREFIX + mode.key, '1')
    if (location.pathname.startsWith(mode.path)) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent(OPEN_SCENE_MODAL_EVENT, { detail: { mode: mode.key } }))
    }
  }

  return (
    <div className="pro-layout">
      <nav className="pro-rail">
        {enabledModes.map((mode) => (
          <NavLink
            key={mode.key}
            to={mode.path}
            onClick={(e) => handleModeClick(e, mode)}
            className={({ isActive }) =>
              `pro-rail__item${isActive ? ' pro-rail__item--active' : ''}`
            }
            title={mode.label}
          >
            <span className="pro-rail__icon">{mode.icon}</span>
            <span className="pro-rail__label">{mode.label}</span>
          </NavLink>
        ))}

        {/* 未实现的模式收进「敬请期待」折叠组 */}
        {disabledModes.length > 0 && (
          <>
            <button
              className={`pro-rail__item pro-rail__item--soon${
                comingSoonOpen ? ' pro-rail__item--soon-open' : ''
              }`}
              onClick={() => setComingSoonOpen((v) => !v)}
              title={comingSoonOpen ? '收起' : '更多模式'}
            >
              <span className="pro-rail__icon">✨</span>
              <span className="pro-rail__label">
                敬请期待 {comingSoonOpen ? '▴' : '▾'}
              </span>
            </button>
            {comingSoonOpen &&
              disabledModes.map((mode) => (
                <span
                  key={mode.key}
                  className="pro-rail__item pro-rail__item--disabled"
                  title={`${mode.label}（敬请期待）`}
                >
                  <span className="pro-rail__icon">{mode.icon}</span>
                  <span className="pro-rail__label">{mode.label}</span>
                </span>
              ))}
          </>
        )}
      </nav>
      <div className="pro-content">
        <Outlet />
      </div>
    </div>
  )
}
