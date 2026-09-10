/**
 * Input 组件
 */

export interface InputProps {
  /** 输入框类型 */
  type?: 'text' | 'password' | 'email' | 'number'
  /** 占位符 */
  placeholder?: string
  /** 值 */
  value?: string
  /** 默认值 */
  defaultValue?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否只读 */
  readOnly?: boolean
  /** 错误信息 */
  error?: string
  /** 标签 */
  label?: string
  /** 变化事件 */
  onChange?: (value: string) => void
  /** 自定义类名 */
  className?: string
}

export function Input({
  type = 'text',
  placeholder,
  value,
  defaultValue,
  disabled = false,
  readOnly = false,
  error,
  label,
  onChange,
  className = '',
}: InputProps) {
  const baseStyle = 'w-full px-3 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const errorStyle = error ? 'border-red-500' : 'border-gray-300'
  const disabledStyle = disabled ? 'bg-gray-100 cursor-not-allowed' : ''

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        readOnly={readOnly}
        onChange={e => onChange?.(e.target.value)}
        className={`${baseStyle} ${errorStyle} ${disabledStyle}`}
      />
      {error && (
        <span className="text-sm text-red-500">{error}</span>
      )}
    </div>
  )
}
