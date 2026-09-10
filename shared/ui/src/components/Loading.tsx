/**
 * Loading 组件
 */

export interface LoadingProps {
  /** 大小 */
  size?: 'sm' | 'md' | 'lg'
  /** 加载文本 */
  text?: string
  /** 是否全屏 */
  fullscreen?: boolean
  /** 自定义类名 */
  className?: string
}

const sizeStyles: Record<string, string> = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
}

export function Loading({
  size = 'md',
  text,
  fullscreen = false,
  className = '',
}: LoadingProps) {
  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <svg
        className={`animate-spin text-blue-600 ${sizeStyles[size]}`}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {text && (
        <span className="text-sm text-gray-500">{text}</span>
      )}
    </div>
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-75">
        {spinner}
      </div>
    )
  }

  return spinner
}
