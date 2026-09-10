/**
 * 模型选择器（Kimi 风格：对话框内的胶囊按钮 + 上拉列表）
 *
 * 选项首位固定为「Auto」：表示默认模型（即列表中的第一个模型）。
 * 列表为空或加载中时为禁用态，此时发送按钮也不可点击（由父组件控制）。
 */

import { useEffect, useRef, useState } from 'react'
import type { ModelInfo } from '../../services/types'

/** Auto 伪选项的取值（与真实 model_id 不会冲突） */
export const AUTO_MODEL_VALUE = '__auto__'

interface ModelSelectorProps {
  models: ModelInfo[] | null
  /** AUTO_MODEL_VALUE 或具体 model_id */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

/**
 * 发送用模型 id（API 文档 v2.3 §7.1）：
 * - Auto → 返回列表中标记 is_default 的模型 id；若无默认模型则用列表第一个
 *   （前端始终发送具体 model_id，不依赖后端 is_default 兜底逻辑）
 * - 具体模型 → 在列表中则返回，否则 undefined（调用方禁用发送）
 * - 列表空 → undefined
 */
export function resolveModelId(value: string, models: ModelInfo[] | null): string | undefined {
  if (!models || models.length === 0) return undefined
  if (value === AUTO_MODEL_VALUE) {
    const defaultModel = models.find((m) => m.is_default)
    return defaultModel?.model_id ?? models[0].model_id
  }
  return models.some((m) => m.model_id === value) ? value : undefined
}

export default function ModelSelector({
  models,
  value,
  onChange,
  disabled = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // 点击外部收起
  useEffect(() => {
    if (!open) return
    const onClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const unavailable = models === null || models.length === 0
  const selected = models?.find((m) => m.model_id === value)
  const label =
    models === null
      ? '模型加载中…'
      : models.length === 0
        ? '无可用模型'
        : value === AUTO_MODEL_VALUE || !selected
          ? 'Auto'
          : selected.display_name

  return (
    <div className="model-selector" ref={rootRef}>
      <button
        type="button"
        className="model-selector__trigger"
        disabled={disabled || unavailable}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="model-selector__label">{label}</span>
        <span className="model-selector__caret">{open ? '▴' : '▾'}</span>
      </button>
      {open && models && models.length > 0 && (
        <div className="model-selector__dropdown">
          <button
            type="button"
            className={`model-selector__option${
              value === AUTO_MODEL_VALUE ? ' model-selector__option--active' : ''
            }`}
            onClick={() => {
              onChange(AUTO_MODEL_VALUE)
              setOpen(false)
            }}
          >
            <span className="model-selector__option-name">Auto</span>
            <span className="model-selector__option-provider">默认</span>
          </button>
          {models.map((model) => (
            <button
              key={model.model_id}
              type="button"
              className={`model-selector__option${
                model.model_id === value ? ' model-selector__option--active' : ''
              }`}
              onClick={() => {
                onChange(model.model_id)
                setOpen(false)
              }}
            >
              <span className="model-selector__option-name">{model.display_name}</span>
              <span className="model-selector__option-provider">{model.provider_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
