/**
 * 轨道模式侧边栏内容：搜索 + 星座分组
 *
 * 布局：搜索栏在上 → 星座分组列表在下。
 * 分组交互：checkbox 切换启用/禁用；点击分组名称触发 onGroupClick（外部弹出悬浮面板）。
 *
 * 只放工作区业务控件；侧栏框架与收起细条由 pro/shell/ProSceneShell 托管。
 */

import { useMemo, useState } from 'react'
import type { OrbitGroup } from './services/groups'
import type { SatRecord } from './services/propagator'

interface OrbitSidebarProps {
  groups: OrbitGroup[]
  enabledGroups: string[]
  groupCounts: Record<string, number>
  onToggleGroup: (key: string, enabled: boolean) => void
  onSetAllGroups: (enabled: boolean) => void

  satellites: SatRecord[]
  onSearchSelect: (noradId: string) => void
  /** 点击分组名称 → 外部弹出悬浮面板 */
  onGroupClick: (groupKey: string) => void
}

export default function OrbitSidebar({
  groups,
  enabledGroups,
  groupCounts,
  onToggleGroup,
  onSetAllGroups,
  satellites,
  onSearchSelect,
  onGroupClick,
}: OrbitSidebarProps) {
  const [keyword, setKeyword] = useState('')

  // ---------- 搜索结果（已加载目标中模糊匹配，最多 20 条） ----------
  const results = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return []
    return satellites
      .filter(
        (s) =>
          s.tle.name.toLowerCase().includes(kw) || s.tle.noradId.includes(kw),
      )
      .slice(0, 20)
  }, [keyword, satellites])

  return (
    <>
      {/* ---------- 搜索（置顶） ---------- */}
      <section className="orbit-sidebar__section">
        <div className="orbit-sidebar__section-title">搜索航天器</div>
        <input
          className="orbit-sidebar__search"
          type="text"
          placeholder="名称 / NORAD 编号…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        {keyword.trim() && (
          <div className="orbit-sidebar__results">
            {results.length === 0 && (
              <p className="orbit-sidebar__hint">
                {satellites.length === 0 ? '先启用分组加载数据' : '无匹配结果'}
              </p>
            )}
            {results.map((record) => (
              <button
                key={record.tle.noradId}
                className="orbit-sidebar__result"
                onClick={() => {
                  onSearchSelect(record.tle.noradId)
                  setKeyword('')
                }}
              >
                <span className="orbit-sidebar__result-name">{record.tle.name}</span>
                <span className="orbit-sidebar__result-id">{record.tle.noradId}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ---------- 星座分组 ---------- */}
      <section className="orbit-sidebar__section orbit-sidebar__section--grow">
        <div className="orbit-sidebar__section-title">
          星座分组
          <span className="orbit-sidebar__section-tools">
            <button onClick={() => onSetAllGroups(true)}>全选</button>
            <button onClick={() => onSetAllGroups(false)}>清除</button>
          </span>
        </div>
        <div className="orbit-sidebar__groups">
          {groups.map((group) => {
            const enabled = enabledGroups.includes(group.key)
            const count = groupCounts[group.key]
            return (
              <div key={group.key} className="orbit-group-row">
                {/* checkbox：切换启用/禁用 */}
                <label className="orbit-group-check">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => onToggleGroup(group.key, e.target.checked)}
                  />
                </label>
                {/* 色块 + 名称：点击弹出悬浮面板 */}
                <button
                  className="orbit-group-name"
                  onClick={() => onGroupClick(group.key)}
                >
                  <span className="orbit-group__dot" style={{ background: group.color }} />
                  <span className="orbit-group__label">{group.label}</span>
                  <span className="orbit-group__count">
                    {count === undefined ? (enabled ? '…' : '') : count}
                  </span>
                  <span className="orbit-group__arrow">▸</span>
                </button>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
