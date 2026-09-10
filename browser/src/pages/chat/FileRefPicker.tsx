/**
 * 引用文件选择器（file_refs）
 *
 * 列出会话已关联知识库中的文件（9.6 目录索引，按需懒加载），
 * 勾选后随消息发送（6.6 file_refs），后端加载文件全文注入上下文。
 * 样式复用 model-selector。
 */

import { useEffect, useRef, useState } from 'react'
import { getKnowledgeIndex } from '../../services/resources'
import type { KnowledgeBaseInfo, KnowledgeIndex } from '../../services/types'

interface FileRefPickerProps {
  /** 会话关联的知识库 id 列表 */
  kbIds: string[]
  /** 知识库列表（解析显示名用） */
  knowledgeBases: KnowledgeBaseInfo[] | null
  selectedFiles: string[]
  onToggle: (filename: string) => void
  disabled?: boolean
}

export default function FileRefPicker({
  kbIds,
  knowledgeBases,
  selectedFiles,
  onToggle,
  disabled = false,
}: FileRefPickerProps) {
  const [open, setOpen] = useState(false)
  const [indexes, setIndexes] = useState<Record<string, KnowledgeIndex | 'error'>>({})
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

  // 首次打开时懒加载各知识库目录索引
  useEffect(() => {
    if (!open) return
    for (const kbId of kbIds) {
      if (indexes[kbId]) continue
      getKnowledgeIndex(kbId)
        .then((index) => setIndexes((prev) => ({ ...prev, [kbId]: index })))
        .catch(() => setIndexes((prev) => ({ ...prev, [kbId]: 'error' })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kbIds])

  if (kbIds.length === 0) return null

  const kbName = (id: string) =>
    knowledgeBases?.find((kb) => kb.id === id)?.display_name ?? id

  return (
    <div className="model-selector" ref={rootRef}>
      <button
        type="button"
        className="model-selector__trigger"
        disabled={disabled}
        title="引用知识库文件（全文注入上下文）"
        onClick={() => setOpen((v) => !v)}
      >
        📚 引用文件{selectedFiles.length > 0 && ` ×${selectedFiles.length}`}
      </button>
      {open && (
        <div className="model-selector__dropdown model-selector__dropdown--wide">
          {kbIds.map((kbId) => {
            const index = indexes[kbId]
            return (
              <div key={kbId} className="file-ref__group">
                <div className="file-ref__group-title">{kbName(kbId)}</div>
                {!index && <div className="file-ref__hint">目录加载中…</div>}
                {index === 'error' && <div className="file-ref__hint">目录加载失败</div>}
                {index && index !== 'error' && index.files.length === 0 && (
                  <div className="file-ref__hint">知识库为空</div>
                )}
                {index &&
                  index !== 'error' &&
                  index.files.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      className={`model-selector__option${
                        selectedFiles.includes(file.filename)
                          ? ' model-selector__option--active'
                          : ''
                      }`}
                      title={file.summary}
                      onClick={() => onToggle(file.filename)}
                    >
                      <span className="model-selector__option-name">
                        {selectedFiles.includes(file.filename) ? '☑' : '☐'} {file.filename}
                      </span>
                      <span className="model-selector__option-provider">
                        {(file.file_size / 1024).toFixed(1)}KB
                      </span>
                    </button>
                  ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
