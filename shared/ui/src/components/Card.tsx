/**
 * Card 组件
 */

import React from 'react'

export interface CardProps {
  /** 标题 */
  title?: string
  /** 副标题 */
  subtitle?: string
  /** 内容 */
  children: React.ReactNode
  /** 是否有阴影 */
  shadow?: boolean
  /** 是否有边框 */
  bordered?: boolean
  /** 自定义类名 */
  className?: string
}

export function Card({
  title,
  subtitle,
  children,
  shadow = true,
  bordered = true,
  className = '',
}: CardProps) {
  const shadowStyle = shadow ? 'shadow-md' : ''
  const borderStyle = bordered ? 'border border-gray-200' : ''

  return (
    <div className={`bg-white rounded-lg ${shadowStyle} ${borderStyle} ${className}`}>
      {(title || subtitle) && (
        <div className="px-6 py-4 border-b border-gray-200">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          )}
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
      )}
      <div className="px-6 py-4">
        {children}
      </div>
    </div>
  )
}
