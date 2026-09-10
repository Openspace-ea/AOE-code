/**
 * 专业场景统一 UI 壳：布局骨架
 *
 * 固定五区：左工作栏 | 中央视图 | 右 Agent 面板 | 底部时间+状态栏 |
 * 场景管理浮框入口。左栏收起为细条的交互在此只实现一次（右 Agent 面板的
 * 收起/宽度拖拽由 AgentPanel 自身托管）。场景只提供各槽位内容，不写布局；
 * 场景管理浮框的触发机制（导航轨 → sessionStorage 标志 / 自定义事件）
 * 在 pro/modes.ts，由场景页监听后把浮框经 sceneModal 槽传入。
 *
 * expandedPanel：可选展开面板（如轨迹曲线图），渲染在主视图下方，
 * 与主视图按 3:1 分割（主视图占 75%，展开面板占 25%）。
 */

import { useState, type ReactNode } from 'react'
import CollapseRail from './CollapseRail'
import StatBar from './StatBar'
import './shell.css'

interface ProSceneShellProps {
  /** 左工作栏内容（业务控件，如星座分组/搜索）；不传则无左栏（如 GNC 场景无工作控件） */
  sidebar?: ReactNode
  /** 右 Agent 面板（shell/AgentPanel 的场景封装） */
  agent?: ReactNode
  /** 中央视图（3D/2D 画布），铺满视图区 */
  children: ReactNode
  /** 中央视图浮层（鹰眼、仿真时钟、视图控件、详情面板等） */
  overlays?: ReactNode
  /** 底部栏左侧控件（TimeControls 等） */
  bottomLeft?: ReactNode
  /** 底部状态条目（StatBar 内容，场景注入） */
  stats?: ReactNode
  /** 场景管理浮框（打开时传入） */
  sceneModal?: ReactNode
  /** 展开面板（如轨迹曲线图），渲染在主视图下方，3:1 分割 */
  expandedPanel?: ReactNode
}

export default function ProSceneShell({
  sidebar,
  agent,
  children,
  overlays,
  bottomLeft,
  stats,
  sceneModal,
  expandedPanel,
}: ProSceneShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="pro-shell">
      {sidebar != null &&
        (sidebarCollapsed ? (
          <CollapseRail
            side="left"
            title="展开侧边栏"
            onExpand={() => setSidebarCollapsed(false)}
          />
        ) : (
          <aside className="pro-shell__sidebar">
            <div className="pro-shell__sidebar-bar pro-shell__sidebar-bar--right">
              <button
                className="pro-shell__sidebar-collapse"
                onClick={() => setSidebarCollapsed(true)}
                title="收起侧边栏"
              >
                «
              </button>
            </div>
            {sidebar}
          </aside>
        ))}

      <div className="pro-shell__main">
        <div className="pro-shell__content-row">
          <div className={`pro-shell__body${expandedPanel ? ' pro-shell__body--split' : ''}`}>
            <div className="pro-shell__view">
              {children}
              {overlays}
            </div>
            {expandedPanel && (
              <div className="pro-shell__expanded-panel">
                {expandedPanel}
              </div>
            )}
          </div>
          {agent}
        </div>

        <div className="pro-shell__bottom">
          {bottomLeft}
          <StatBar>{stats}</StatBar>
        </div>
      </div>

      {sceneModal}
    </div>
  )
}
