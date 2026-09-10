/**
 * Header 组件
 */

import React from 'react'

export interface HeaderProps {
  /** 标题 */
  title: string
  /** 副标题 */
  subtitle?: string
  /** 左侧内容 */
  left?: React.ReactNode
  /** 右侧内容 */
  right?: React.ReactNode
  /** 是否固定顶部 */
  fixed?: boolean
  /** 自定义类名 */
  className?: string
}

export function Header({
  title,
  subtitle,
  left,
  right,
  fixed = false,
  className = '',
}: HeaderProps) {
  const fixedStyle = fixed ? 'fixed top-0 left-0 right-0 z-40' : ''

  return (
    <header className={`bg-white border-b border-gray-200 ${fixedStyle} ${className}`}>
      <div className="flex items-center justify-between h-16 px-6">
        {/* 左侧 */}
        <div className="flex items-center gap-4">
          {left}
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>

        {/* 右侧 */}
        {right && (
          <div className="flex items-center gap-4">
            {right}
          </div>
        )}
      </div>
    </header>
  )
}
