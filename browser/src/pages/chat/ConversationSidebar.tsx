/**
 * 会话列表侧边栏
 *
 * 新建 / 重命名（行内编辑）/ 删除（二次确认）。
 */

import { useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { deleteConversation, renameConversation } from '../../services/conversation'
import type { Conversation } from '../../services/types'
import { relativeTime } from '../../lib/time'

interface ConversationSidebarProps {
  conversations: Conversation[]
  listState: 'loading' | 'ready' | 'error'
  onRefresh: () => void
}

export default function ConversationSidebar({
  conversations,
  listState,
  onRefresh,
}: ConversationSidebarProps) {
  const { id: activeId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const startRename = (conv: Conversation) => {
    setEditingId(conv.id)
    setEditingTitle(conv.title)
  }

  const commitRename = async () => {
    const title = editingTitle.trim()
    const id = editingId
    setEditingId(null)
    if (!id || !title) return
    try {
      await renameConversation(id, title)
      onRefresh()
    } catch {
      // 失败静默：下次刷新恢复原标题
    }
  }

  const handleDelete = async (conv: Conversation) => {
    if (!window.confirm(`确定删除会话「${conv.title}」吗？`)) return
    try {
      await deleteConversation(conv.id)
      onRefresh()
      if (conv.id === activeId) {
        navigate('/chat', { replace: true })
      }
    } catch {
      window.alert('删除失败，请稍后重试')
    }
  }

  return (
    <aside className="conv-sidebar">
      <div className="conv-sidebar__top">
        <NavLink to="/chat" className="btn btn--primary conv-sidebar__new">
          ＋ 新建对话
        </NavLink>
      </div>

      <div className="conv-sidebar__list">
        {listState === 'loading' && <div className="conv-sidebar__hint">加载中…</div>}
        {listState === 'error' && (
          <div className="conv-sidebar__hint">
            加载失败
            <button className="btn btn--ghost" onClick={onRefresh}>
              重试
            </button>
          </div>
        )}
        {listState === 'ready' && conversations.length === 0 && (
          <div className="conv-sidebar__hint">还没有会话，从新建开始吧</div>
        )}

        {conversations.map((conv) =>
          editingId === conv.id ? (
            <div key={conv.id} className="conv-item conv-item--editing">
              <input
                className="conv-item__edit-input"
                value={editingTitle}
                autoFocus
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setEditingId(null)
                }}
              />
            </div>
          ) : (
            <NavLink
              key={conv.id}
              to={`/chat/${conv.id}`}
              className={({ isActive }) =>
                `conv-item${isActive ? ' conv-item--active' : ''}`
              }
            >
              <span className="conv-item__title" title={conv.title}>
                {conv.title}
              </span>
              <span className="conv-item__time">{relativeTime(conv.updated_at)}</span>
              <span className="conv-item__actions">
                <button
                  className="conv-item__action"
                  title="重命名"
                  onClick={(e) => {
                    e.preventDefault()
                    startRename(conv)
                  }}
                >
                  ✎
                </button>
                <button
                  className="conv-item__action"
                  title="删除"
                  onClick={(e) => {
                    e.preventDefault()
                    handleDelete(conv)
                  }}
                >
                  ✕
                </button>
              </span>
            </NavLink>
          ),
        )}
      </div>
    </aside>
  )
}
