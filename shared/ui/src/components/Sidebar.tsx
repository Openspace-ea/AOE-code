/**
 * Sidebar 组件
 */

import React from 'react'

export interface SidebarItem {
  /** 唯一标识 */
  id: string
  /** 显示文本 */
  label: string
  /** 图标 */
  icon?: React.ReactNode
  /** 是否激活 */
  active?: boolean
  /** 点击事件 */
  onClick?: () => void
}

export interface SidebarProps {
  /** 菜单项 */
  items: SidebarItem[]
  /** 宽度 */
  width?: string
  /** 是否折叠 */
  collapsed?: boolean
  /** 头部内容 */
  header?: React.ReactNode
  /** 底部内容 */
  footer?: React.ReactNode
  /** 自定义类名 */
  className?: string
}

export function Sidebar({
  items,
  width = '240px',
  collapsed = false,
  header,
  footer,
  className = '',
}: SidebarProps) {
  return (
    <aside
      className={`bg-gray-900 text-white flex flex-col h-full ${className}`}
      style={{ width: collapsed ? '64px' : width }}
    >
      {/* 头部 */}
      {header && (
        <div className="px-4 py-4 border-b border-gray-700">
          {header}
        </div>
      )}

      {/* 菜单 */}
      <nav className="flex-1 overflow-y-auto py-2">
        {items.map(item => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`
              w-full flex items-center gap-3 px-4 py-3 text-sm
              transition-colors
              ${item.active
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }
            `}
          >
            {item.icon && (
              <span className="flex-shrink-0">{item.icon}</span>
            )}
            {!collapsed && (
              <span className="truncate">{item.label}</span>
            )}
          </button>
        ))}
      </nav>

      {/* 底部 */}
      {footer && (
        <div className="px-4 py-4 border-t border-gray-700">
          {footer}
        </div>
      )}
    </aside>
  )
}
