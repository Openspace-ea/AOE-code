/**
 * 对话工作区
 *
 * 布局：左侧会话列表 + 右侧聊天区。
 * /chat 为新会话草稿态（选模型、发首条消息时才创建会话）；
 * /chat/:id 为已有会话。
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { listConversations } from '../../services/conversation'
import type { Conversation } from '../../services/types'
import ConversationSidebar from './ConversationSidebar'
import ChatView from './ChatView'
import NewChatView from './NewChatView'
import './chat.css'

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading')

  const refreshList = useCallback(() => {
    listConversations()
      .then((res) => {
        // 只展示通用对话；专业模式会话在各场景内独立管理
        const general = res.conversations.filter(
          (c) => !c.conversation_type || c.conversation_type === 'general',
        )
        setConversations(general)
        setListState('ready')
      })
      .catch(() => setListState('error'))
  }, [])

  useEffect(refreshList, [refreshList])

  return (
    <div className="chat-page">
      <ConversationSidebar
        conversations={conversations}
        listState={listState}
        onRefresh={refreshList}
      />
      {id ? (
        // key 保证切换会话时重置聊天区状态
        <ChatView key={id} conversationId={id} onActivity={refreshList} />
      ) : (
        <NewChatView onActivity={refreshList} />
      )}
    </div>
  )
}
