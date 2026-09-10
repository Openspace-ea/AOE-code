/**
 * 消息输入框
 *
 * Enter 发送、Shift+Enter 换行；中文输入法组合中（isComposing）的 Enter 不触发发送。
 * 控制栏左侧为插槽（模型选择器等工具按钮），右侧为发送按钮（Kimi 风格）。
 * disabled 控制整体（含输入区），sendDisabled 仅控制发送按钮
 * （如未选择模型时输入仍可编辑、发送不可点击）。
 */

import type { KeyboardEvent, ReactNode } from 'react'

interface MessageInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  /** 仅禁用发送按钮（缺省跟随 disabled） */
  sendDisabled?: boolean
  /** 有附件时允许空文本发送 */
  allowEmptySend?: boolean
  placeholder?: string
  /** 控制栏左侧插槽（如模型选择器） */
  leftControls?: ReactNode
  /** 输入框顶部插槽（附件/引用文件 chips） */
  topSlot?: ReactNode
}

export default function MessageInput({
  value,
  onChange,
  onSend,
  disabled = false,
  sendDisabled,
  allowEmptySend = false,
  placeholder = '输入消息…',
  leftControls,
  topSlot,
}: MessageInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      onSend()
    }
  }

  // 发送按钮禁用：整体禁用 / 仅发送禁用（如未选模型），且无文本无附件时不可发
  const isSendDisabled = (sendDisabled ?? disabled) || (!allowEmptySend && !value.trim())

  return (
    <div className="msg-input">
      {topSlot}
      <textarea
        className="msg-input__textarea"
        rows={3}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="msg-input__bar">
        <div className="msg-input__left">{leftControls}</div>
        <button
          className="btn btn--primary msg-input__send"
          disabled={isSendDisabled}
          onClick={onSend}
        >
          发送
        </button>
      </div>
    </div>
  )
}
