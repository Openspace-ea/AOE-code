/**
 * Modal 组件
 */

import React, { useEffect } from 'react'

export interface ModalProps {
  /** 是否显示 */
  open: boolean
  /** 标题 */
  title?: string
  /** 内容 */
  children: React.ReactNode
  /** 宽度 */
  width?: 'sm' | 'md' | 'lg' | 'xl'
  /** 关闭事件 */
  onClose: () => void
  /** 是否显示关闭按钮 */
  closable?: boolean
  /** 是否点击遮罩关闭 */
  maskClosable?: boolean
  /** 自定义类名 */
  className?: string
}

const widthStyles: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

export function Modal({
  open,
  title,
  children,
  width = 'md',
  onClose,
  closable = true,
  maskClosable = true,
  className = '',
}: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={maskClosable ? onClose : undefined}
      />

      {/* 弹窗 */}
      <div className={`relative bg-white rounded-lg shadow-xl ${widthStyles[width]} w-full mx-4 ${className}`}>
        {/* 头部 */}
        {(title || closable) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            {title && (
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            )}
            {closable && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* 内容 */}
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
