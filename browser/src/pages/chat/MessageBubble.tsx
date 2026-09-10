/**
 * 单条消息气泡
 *
 * 用户消息：纯文本，右对齐渐变气泡；hover 气泡下方浮出操作条
 * （✎ 修改并重发 / 🗑 删除本组对话 / ⟲ 回滚到此处，均由调用方注入）。
 * 助手消息：Markdown 渲染（marked + xss 消毒），左对齐玻璃拟态气泡，
 * 底部展示引用来源与 tokens/费用。
 */

import { useState } from 'react'
import { marked } from 'marked'
import xss from 'xss'
import type { DisplayMessage } from '../../services/types'
import ToolCallList from './ToolCallList'

/** 供 ChatView 流式气泡复用 */
export function renderMarkdown(content: string): string {
  return xss(marked.parse(content, { async: false }))
}

interface MessageBubbleProps {
  message: DisplayMessage
  /** 修改并重发（传入即显示入口）；保存后由调用方截断并重发 */
  onEditSave?: (newText: string) => void
  /** 删除本组对话（这条用户消息 + 其助手回复） */
  onDelete?: () => void
  /** 回滚到该消息（删除该消息及其后所有消息） */
  onRollback?: () => void
}

export default function MessageBubble({ message, onEditSave, onDelete, onRollback }: MessageBubbleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (message.role === 'user') {
    if (editing) {
      return (
        <div className="msg msg--user">
          <div className="msg__bubble msg__bubble--editing">
            <textarea
              className="msg__edit-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              rows={Math.min(8, Math.max(2, draft.split('\n').length))}
            />
            <div className="msg__edit-actions">
              <button className="btn btn--ghost" onClick={() => setEditing(false)}>
                取消
              </button>
              <button
                className="btn"
                disabled={!draft.trim()}
                onClick={() => {
                  setEditing(false)
                  onEditSave?.(draft)
                }}
              >
                保存并重发
              </button>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="msg msg--user">
        <div className="msg__main">
          <div className="msg__bubble">
            {message.content}
            {((message.attachmentNames?.length ?? 0) > 0 ||
              (message.refFileNames?.length ?? 0) > 0) && (
              <div className="msg__attach">
                {message.attachmentNames?.map((name) => (
                  <span key={`up-${name}`} className="msg__attach-chip">
                    📄 {name}
                  </span>
                ))}
                {message.refFileNames?.map((name) => (
                  <span key={`ref-${name}`} className="msg__attach-chip">
                    📚 {name}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* hover 气泡下方浮出的操作条 */}
          {(onEditSave || onDelete || onRollback) && (
            <div className="msg__actions">
              {onEditSave && (
                <button
                  className="msg__action"
                  title="修改并重发"
                  onClick={() => {
                    setDraft(message.content)
                    setEditing(true)
                  }}
                >
                  ✎ 修改
                </button>
              )}
              {onDelete && (
                <button className="msg__action" title="删除这条消息及其回复" onClick={onDelete}>
                  🗑 删除
                </button>
              )}
              {onRollback && (
                <button className="msg__action" title="回滚到此处" onClick={onRollback}>
                  ⟲ 回滚
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // 元信息：{时间}  点数消耗:{金额}  {模型名称}（不显示 tokens）
  const metaTime = new Date(message.created_at).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const costDisplay = message.cost != null
    ? Number(message.cost).toFixed(2)
    : null

  return (
    <div className="msg msg--assistant">
      <div className="msg__bubble">
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallList records={message.toolCalls} />
        )}
        <div
          className="msg__markdown"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
        />
        {message.references && message.references.length > 0 && (
          <div className="msg__refs">
            {message.references.map((ref, index) => (
              <span key={index} className="msg__ref" title={ref.kb_name}>
                📎 {ref.kb_name}/{ref.filename}
              </span>
            ))}
          </div>
        )}
        {(costDisplay || message.model) && (
          <div className="msg__meta">
            <span>{metaTime}</span>
            {costDisplay && <span>点数消耗:{costDisplay}</span>}
            {message.model && <span>{message.model}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
