/**
 * 分组卫星悬浮面板：点击侧栏分组名称后，贴在侧栏右侧弹出，展示该分组的卫星列表。
 * 点击面板外部区域自动关闭。
 */

import { useEffect, useRef } from 'react'
import type { OrbitGroup } from './services/groups'
import type { SatRecord } from './services/propagator'

interface Props {
  groupKey: string
  group: OrbitGroup | undefined
  satellites: SatRecord[]
  onSelect: (noradId: string) => void
  /** 切换卫星高亮状态（点击行左侧 checkbox） */
  onToggleHighlight?: (noradId: string) => void
  /** 当前高亮的卫星 ID 集合 */
  highlightedIds?: Set<string> | null
  onClose: () => void
}

const TYPE_LABEL: Record<string, string> = {
  PAYLOAD: '有效载荷',
  DEBRIS: '碎片',
  'ROCKET BODY': '火箭残骸',
  UNKNOWN: '未知',
}

export default function GroupFloatingPanel({ group, satellites, onSelect, onToggleHighlight, highlightedIds, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  // 点击面板外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // 延迟注册，避免触发本次点击就关闭
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [onClose])

  return (
    <div className="orbit-floating-panel" ref={panelRef}>
      <div className="orbit-floating-panel__header">
        <span className="orbit-floating-panel__dot" style={{ background: group?.color ?? '#4da6ff' }} />
        <span className="orbit-floating-panel__title">{group?.label ?? '未知分组'}</span>
        <span className="orbit-floating-panel__count">{satellites.length} 颗</span>
        <button className="orbit-floating-panel__close" onClick={onClose}>✕</button>
      </div>
      {/* 表头 */}
      <div className="orbit-floating-panel__thead">
        {onToggleHighlight && <span className="orbit-floating-panel__th orbit-floating-panel__th--check" />}
        <span className="orbit-floating-panel__th orbit-floating-panel__th--name">名称</span>
        <span className="orbit-floating-panel__th orbit-floating-panel__th--id">NORAD</span>
        <span className="orbit-floating-panel__th orbit-floating-panel__th--intl">国际标识</span>
        <span className="orbit-floating-panel__th orbit-floating-panel__th--type">类型</span>
      </div>
      <div className="orbit-floating-panel__list">
        {satellites.length === 0 && (
          <p className="orbit-sidebar__hint" style={{ padding: '12px 10px' }}>该分组暂无数据</p>
        )}
        {satellites.slice(0, 200).map((sat) => {
          const isHighlighted = highlightedIds?.has(sat.tle.noradId) ?? false
          return (
            <div
              key={sat.tle.noradId}
              className={`orbit-floating-panel__sat ${isHighlighted ? 'orbit-floating-panel__sat--highlighted' : ''} ${highlightedIds && !isHighlighted ? 'orbit-floating-panel__sat--dimmed' : ''}`}
            >
              {onToggleHighlight && (
                <input
                  type="checkbox"
                  className="orbit-floating-panel__check"
                  checked={isHighlighted}
                  onChange={() => onToggleHighlight(sat.tle.noradId)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <button
                className="orbit-floating-panel__sat-btn"
                onClick={() => onSelect(sat.tle.noradId)}
              >
                <span className="orbit-floating-panel__td orbit-floating-panel__td--name">{sat.tle.name}</span>
                <span className="orbit-floating-panel__td orbit-floating-panel__td--id">{sat.tle.noradId}</span>
                <span className="orbit-floating-panel__td orbit-floating-panel__td--intl">{sat.tle.intlDes}</span>
                <span className="orbit-floating-panel__td orbit-floating-panel__td--type">{TYPE_LABEL[sat.tle.objectType ?? ''] ?? sat.tle.objectType ?? '-'}</span>
              </button>
            </div>
          )
        })}
        {satellites.length > 200 && (
          <p className="orbit-sidebar__hint" style={{ padding: '8px 10px' }}>
            显示前 200 条，共 {satellites.length} 颗，可用搜索定位
          </p>
        )}
      </div>
    </div>
  )
}
