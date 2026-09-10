/**
 * 新会话视图（草稿态）
 *
 * 模型选择器在输入框控制栏（Kimi 风格）：默认选中 Auto（即列表第一个模型）；
 * 列表加载中或为空时发送按钮禁用。首条消息发出时创建会话（惰性创建），
 * 随后立即跳转到 /chat/:id——首条消息的发送由 ChatView 用 Agent Loop 流式执行
 * （经 navigation state 交接 pendingMessage），本页不等待模型回复，不阻塞 UI。
 * 首条消息发送失败时 ChatView 删除空会话并跳回本页展示错误（state.sendError）。
 */

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../lib/auth'
import { RECHARGE_URL } from '../../lib/constants'
import { useBilling } from '../../components/layout/BillingContext'
import { createConversation } from '../../services/conversation'
import { useModels } from '../../services/useModels'
import { useResources } from '../../services/useResources'
import MessageInput from './MessageInput'
import ModelSelector, { AUTO_MODEL_VALUE, resolveModelId } from './ModelSelector'
import ContextPicker from './ContextPicker'
import FileRefPicker from './FileRefPicker'
import UploadButton, { buildContentWithAttachments, type ChatAttachment } from './UploadButton'

interface NewChatViewProps {
  onActivity: () => void
}

/** 跳转会话页时交接的待发送首条消息（ChatView 消费） */
export interface PendingFirstMessage {
  /** 用户可见文本 */
  text: string
  /** 实际发给 Agent 的内容（附件已内联） */
  content: string
  attachmentNames?: string[]
  refFileNames?: string[]
}

interface SendError {
  text: string
  recharge?: boolean
}

export default function NewChatView({ onActivity }: NewChatViewProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { refresh: refreshBilling } = useBilling()
  const { models, modelsError } = useModels()
  const { knowledgeBases, skills, kbError, skillsError } = useResources()
  const [selection, setSelection] = useState<string>(AUTO_MODEL_VALUE)
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([])
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([])
  const [refFiles, setRefFiles] = useState<string[]>([])
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<SendError | null>(null)

  // 首条消息在会话页发送失败后跳回本页：取回错误信息展示一次
  useEffect(() => {
    const failed = (location.state as { sendError?: string } | null)?.sendError
    if (failed) {
      setSendError({ text: failed })
      window.history.replaceState(null, '')
    }
  }, [location.state])

  // 实际发送用的模型：Auto 解析为列表第一个；列表为空则不可发送
  const sendModelId = resolveModelId(selection, models)
  const canSend = selection === AUTO_MODEL_VALUE || sendModelId !== undefined

  const toggleId = (ids: string[], id: string): string[] =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]

  const handleSend = async () => {
    const text = input.trim()
    if ((!text && attachments.length === 0) || sending || !canSend) return

    setSending(true)
    setSendError(null)
    try {
      const conversation = await createConversation(
        sendModelId,
        selectedKbIds.length > 0 ? selectedKbIds : undefined,
        selectedSkillIds.length > 0 ? selectedSkillIds : undefined,
      )
      // 立即跳转，首条消息交给 ChatView 流式发送（不阻塞本页）
      const pendingMessage: PendingFirstMessage = {
        text,
        content: buildContentWithAttachments(text, attachments),
        attachmentNames: attachments.length > 0 ? attachments.map((a) => a.name) : undefined,
        refFileNames: refFiles.length > 0 ? refFiles : undefined,
      }
      onActivity()
      refreshBilling()
      navigate(`/chat/${conversation.id}`, { replace: true, state: { pendingMessage } })
    } catch (error) {
      if (error instanceof ApiError && error.status === 402) {
        setSendError({ text: error.message, recharge: true })
      } else {
        setSendError({ text: error instanceof Error ? error.message : '发送失败，请稍后重试' })
      }
      setSending(false)
    }
  }

  return (
    <section className="chat-view chat-view--center">
      <div className="new-chat">
        <h2 className="new-chat__title">开始新对话</h2>

        {modelsError && <p className="chat-view__error">{modelsError}</p>}
        {kbError && <p className="chat-view__error">知识库：{kbError}</p>}
        {skillsError && <p className="chat-view__error">技能：{skillsError}</p>}

        {sendError && (
          <div className="chat-view__send-error">
            <span>{sendError.text}</span>
            {sendError.recharge && (
              <a href={RECHARGE_URL} target="_blank" rel="noreferrer">
                去充值
              </a>
            )}
          </div>
        )}

        <MessageInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={sending}
          sendDisabled={sending || !canSend}
          placeholder={
            sending
              ? '创建会话并发送中…'
              : canSend
                ? '输入第一条消息… Enter 发送，Shift+Enter 换行'
                : '暂无可用模型，无法发送'
          }
          leftControls={
            <>
              <ModelSelector
                models={models}
                value={selection}
                onChange={setSelection}
                disabled={sending}
              />
              <ContextPicker
                knowledgeBases={knowledgeBases}
                skills={skills}
                selectedKbIds={selectedKbIds}
                selectedSkillIds={selectedSkillIds}
                onToggleKb={(id) => setSelectedKbIds((ids) => toggleId(ids, id))}
                onToggleSkill={(id) => setSelectedSkillIds((ids) => toggleId(ids, id))}
                disabled={sending}
              />
              <FileRefPicker
                kbIds={selectedKbIds}
                knowledgeBases={knowledgeBases}
                selectedFiles={refFiles}
                onToggle={(f) =>
                  setRefFiles((prev) =>
                    prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
                  )
                }
                disabled={sending}
              />
              <UploadButton
                onAdd={(files) => setAttachments((prev) => [...prev, ...files])}
                onError={(msg) => setSendError({ text: msg })}
                disabled={sending}
              />
            </>
          }
          topSlot={
            (attachments.length > 0 || refFiles.length > 0) && (
              <div className="msg-input__chips">
                {refFiles.map((name) => (
                  <span key={`ref-${name}`} className="input-chip">
                    📚 <span className="input-chip__name">{name}</span>
                    <button
                      className="input-chip__remove"
                      onClick={() => setRefFiles((prev) => prev.filter((x) => x !== name))}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {attachments.map((a) => (
                  <span key={`up-${a.name}`} className="input-chip">
                    📄 <span className="input-chip__name">{a.name}</span>
                    <button
                      className="input-chip__remove"
                      onClick={() =>
                        setAttachments((prev) => prev.filter((x) => x.name !== a.name))
                      }
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )
          }
          allowEmptySend={attachments.length > 0}
        />
      </div>
    </section>
  )
}
