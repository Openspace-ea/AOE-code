/**
 * Alert 组件
 */

import React from 'react'

export interface AlertProps {
  /** 类型 */
  type?: 'info' | 'success' | 'warning' | 'error'
  /** 标题 */
  title?: string
  /** 内容 */
  children: React.ReactNode
  /** 是否可关闭 */
  closable?: boolean
  /** 关闭事件 */
  onClose?: () => void
  /** 自定义类名 */
  className?: string
}

const typeStyles: Record<string, { bg: string; text: string; icon: string }> = {
  info: { bg: 'bg-blue-50', text: 'text-blue-800', icon: 'ℹ️' },
  success: { bg: 'bg-green-50', text: 'text-green-800', icon: '✅' },
  warning: { bg: 'bg-yellow-50', text: 'text-yellow-800', icon: '⚠️' },
  error: { bg: 'bg-red-50', text: 'text-red-800', icon: '❌' },
}

export function Alert({
  type = 'info',
  title,
  children,
  closable = false,
  onClose,
  className = '',
}: AlertProps) {
  const style = typeStyles[type]

  return (
    <div className={`${style.bg} ${style.text} rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0">{style.icon}</span>
        <div className="flex-1">
          {title && (
            <h3 className="font-medium mb-1">{title}</h3>
          )}
          <div className="text-sm">{children}</div>
        </div>
        {closable && (
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
