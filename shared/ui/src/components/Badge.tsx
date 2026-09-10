/**
 * Badge 组件
 */

import React from 'react'

export interface BadgeProps {
  /** 内容 */
  children: React.ReactNode
  /** 颜色 */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  /** 大小 */
  size?: 'sm' | 'md'
  /** 是否圆点 */
  dot?: boolean
  /** 自定义类名 */
  className?: string
}

const variantStyles: Record<string, string> = {
  default: 'bg-gray-100 text-gray-800',
  primary: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
}

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  className = '',
}: BadgeProps) {
  if (dot) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className={`w-2 h-2 rounded-full ${variantStyles[variant].split(' ')[0]}`} />
        {children}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  )
}
