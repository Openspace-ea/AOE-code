/**
 * 已有会话的聊天视图
 *
 * 进入时加载后端历史 + 本地缓存的 Agent 消息；发送走前端 Agent Loop
 * （@aoe/agent 的 runAgent：LLM 循环 + 工具调用 + 结果回灌），
 * 流式事件实时推送到 UI；发送成功刷新侧边栏与点数余额；
 * 切换会话时取消未完成的请求。
 */

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { runAgent, buildSystemPrompt, type ToolDefinition } from '@aoe/agent'
import { RECHARGE_URL } from '../../lib/constants'
import { useBilling } from '../../components/layout/BillingContext'
import { deleteConversation, getConversation, renameConversation, updateConversationModel } from '../../services/conversation'
import type { StreamStatus } from '../../services/conversation'
import {
  appendAgentMessages,
  applyContextCompression,
  applyLocalFilters,
  buildChatPromptLayers,
  buildFileRefsLayer,
  deleteMessages,
  fetchFirstKnowledgeIndex,
  getChatTools,
  loadAgentMessages,
  prepareAgentHistory,
  resolveContextBudget,
  truncateConversation,
} from '../../services/agentRuntime'
import { useModels } from '../../services/useModels'
import { useResources } from '../../services/useResources'
import type {
  ConversationDetail,
  DisplayMessage,
  KnowledgeIndex,
  ToolCallRecord,
} from '../../services/types'
import { filterDisplayMessages } from '../../services/types'
import MessageBubble, { renderMarkdown } from './MessageBubble'
import ConfirmDialog from '../../components/ConfirmDialog'
import type { PendingFirstMessage } from './NewChatView'
import ThinkingBubble from './ThinkingBubble'
import ToolCallList from './ToolCallList'
import MessageInput from './MessageInput'
import ModelSelector, { AUTO_MODEL_VALUE, resolveModelId } from './ModelSelector'
import ContextPicker from './ContextPicker'
import FileRefPicker from './FileRefPicker'
import UploadButton, { buildContentWithAttachments, type ChatAttachment } from './UploadButton'

interface ChatViewProps {
  conversationId: string
  onActivity: () => void
}

/** 发送失败的展示状态；recharge 为 true 时附带充值入口 */
interface SendError {
  text: string
  recharge?: boolean
}

export default function ChatView({ conversationId, onActivity }: ChatViewProps) {
  const { refresh: refreshBilling } = useBilling()
  const location = useLocation()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null)
  const [sendError, setSendError] = useState<SendError | null>(null)
  const [refFiles, setRefFiles] = useState<string[]>([])
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  // Agent Loop 运行中已产生的工具调用记录（流式区域展示）
  const [toolRecords, setToolRecords] = useState<ToolCallRecord[]>([])
  const { models } = useModels()
  const { knowledgeBases, skills } = useResources()
  // 用户在选择器中的显式选择；null 表示未动过（跟随会话模型或 Auto）
  const [selection, setSelection] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // 每个会话准备一次的 Agent 上下文：system prompt 各层 + 工具集 + 知识库索引
  const promptLayersRef = useRef<{ knowledgeIndex?: string; skillDescriptions?: string }>({})
  const agentToolsRef = useRef<ToolDefinition[]>([])
  const kbIndexRef = useRef<KnowledgeIndex | undefined>(undefined)
  // 新会话跳转带来的待发送首条消息（NewChatView 只创建会话，发送在这里流式执行）
  const [pendingAutoSend, setPendingAutoSend] = useState<PendingFirstMessage | null>(null)
  // Agent 上下文（prompt 层 + 工具集 + 知识库索引）是否已就绪
  const [ctxReady, setCtxReady] = useState(false)

  useEffect(() => {
    setDetail(null)
    setMessages([])
    setLoadError(null)
    setSendError(null)
    setSelection(null)
    setRefFiles([])
    setAttachments([])
    setToolRecords([])
    setPendingAutoSend(null)
    setCtxReady(false)
    promptLayersRef.current = {}
    agentToolsRef.current = []
    kbIndexRef.current = undefined
    getConversation(conversationId)
      .then((data) => {
        setDetail(data)
        // 后端历史 + 本地缓存的 Agent 消息，按时间合并排序（同刻按 id 次序兜底）；
        // 再按本地截断/删除标记过滤（编辑重发/回滚/删除的过渡方案，见 agentRuntime.ts）
        const merged = [...data.messages, ...loadAgentMessages(conversationId)].sort(
          (a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id,
        )
        setMessages(applyLocalFilters(conversationId, merged))
        // 新会话的首条消息：仅空会话消费一次，清掉 state 防止刷新重发
        const pending = (location.state as { pendingMessage?: PendingFirstMessage } | null)
          ?.pendingMessage
        if (pending && merged.length === 0) {
          window.history.replaceState(null, '')
          setPendingAutoSend(pending)
        }
        // 准备 Agent 上下文（就绪前自动发送不启动，等 ctxReady）
        Promise.all([
          buildChatPromptLayers(data).then((layers) => {
            promptLayersRef.current = layers
          }),
          getChatTools().then((tools) => {
            agentToolsRef.current = tools
          }),
          fetchFirstKnowledgeIndex(data.knowledge_ids).then((idx) => {
            kbIndexRef.current = idx
          }),
        ]).finally(() => setCtxReady(true))
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : '加载会话失败')
      })
    // 切换会话（组件卸载）时取消未完成的发送请求
    return () => abortRef.current?.abort()
  }, [conversationId])

  // 新消息、流式内容或发送状态变化时滚动到底部
  useEffect(() => {
    const list = listRef.current
    if (list) {
      list.scrollTop = list.scrollHeight
    }
  }, [messages, sending, streamingContent])

  // 选择器当前值：显式选择 > 会话已有模型（在列表中）> Auto
  const selectorValue =
    selection ??
    (detail?.model_id && models?.some((m) => m.model_id === detail.model_id)
      ? detail.model_id
      : AUTO_MODEL_VALUE)
  // 实际发送用的模型：Auto 解析为列表第一个；列表为空则无模型可发
  const sendModelId = resolveModelId(selectorValue, models)
  const canSend = selectorValue === AUTO_MODEL_VALUE || sendModelId !== undefined

  /** 切换模型：具体模型持久化到后端；Auto 仅本地生效（发送时解析为第一个模型） */
  const handleModelChange = async (value: string) => {
    const prev = selection
    setSelection(value)
    if (value === AUTO_MODEL_VALUE) return
    try {
      await updateConversationModel(conversationId, value)
    } catch (error) {
      setSelection(prev)
      setSendError({
        text: `切换模型失败：${error instanceof Error ? error.message : '未知错误'}`,
      })
    }
  }

  /** 发送附加项：编辑重发传 historySource；新会话首条消息传附件/引用与已内联内容 */
  interface SendExtras {
    historySource?: DisplayMessage[]
    attachmentNames?: string[]
    refFileNames?: string[]
    content?: string
  }

  interface SendResult {
    ok: boolean
    /** 用户主动停止（区别于失败：首条消息自动发送时不删会话） */
    aborted: boolean
    error?: string
  }

  /**
   * 发送核心。historySource：编辑重发时传入截断后的消息序列
   * （setMessages 异步，直接读 state 会拿到截断前的旧值）。
   */
  const send = async (text: string, extras?: SendExtras): Promise<SendResult> => {
    const attachNames = extras?.attachmentNames ?? attachments.map((a) => a.name)
    const refNames = extras?.refFileNames ?? refFiles
    if ((!text && attachNames.length === 0) || sending || !detail || !canSend || !sendModelId) {
      return { ok: false, aborted: false, error: '发送条件不满足' }
    }

    setInput('')
    setSending(true)
    setStreamingContent('')
    setStreamStatus({ phase: 'thinking' })
    setSendError(null)
    setAttachments([])
    setRefFiles([])

    const userMessage: DisplayMessage = {
      id: Date.now(),
      role: 'user',
      content: text || '（上传文件）',
      created_at: new Date().toISOString(),
      attachmentNames: attachNames,
      refFileNames: refNames,
    }
    setMessages((prev) => [...prev, userMessage])
    const content = extras?.content ?? buildContentWithAttachments(text, attachments)

    abortRef.current = new AbortController()

    // 组装 Agent 输入：system prompt（identity + 知识库/技能目录 + file_refs）+ 历史
    // 历史经 prepareAgentHistory 组装：有压缩摘要时注入摘要 + 未覆盖消息；
    // 上下文预算按所选模型的窗口推导（切到小窗口模型后自动触发压缩）
    const systemPrompt = buildSystemPrompt({
      ...promptLayersRef.current,
      fileRefs: buildFileRefsLayer(refNames, kbIndexRef.current),
    })
    const prepared = prepareAgentHistory(extras?.historySource ?? messages, conversationId)
    const contextBudget = resolveContextBudget(
      models?.find((m) => m.model_id === sendModelId),
    )

    const records: ToolCallRecord[] = []
    let turnHasText = false
    let currentTurn = 1

    try {
      const reply = await runAgent(
        {
          modelId: sendModelId,
          systemPrompt,
          history: prepared.history,
          priorSummary: prepared.priorSummary,
          maxContextTokens: contextBudget,
        },
        agentToolsRef.current,
        (event) => {
          switch (event.type) {
            case 'thinking':
              setStreamStatus({ phase: 'thinking' })
              turnHasText = false
              break
            case 'text_delta':
              if (!turnHasText) {
                turnHasText = true
                setStreamStatus({ phase: 'generating' })
              }
              setStreamingContent((prev) => (prev ?? '') + event.text)
              break
            case 'tool_call_start':
              setStreamStatus({ phase: 'tool_call', name: event.name })
              records.push({ name: event.name, args: event.args, turn: currentTurn })
              setToolRecords([...records])
              break
            case 'tool_call_result': {
              // 从后往前找该工具最近一条未完成记录
              for (let i = records.length - 1; i >= 0; i--) {
                if (records[i].name === event.name && records[i].success === undefined) {
                  records[i].success = event.result.success
                  records[i].summary = event.result.content.slice(0, 120)
                  records[i].result = event.result.content.slice(0, 2000)
                  records[i].error = event.result.error
                  break
                }
              }
              setToolRecords([...records])
              break
            }
            case 'turn_end':
              currentTurn = event.turn + 1
              break
            case 'context_compressing':
              setStreamStatus({ phase: 'compressing' })
              break
            case 'retrying':
              setStreamStatus({ phase: 'retrying', reason: event.reason })
              break
            default:
              break
          }
        },
        { userInput: content, signal: abortRef.current.signal },
      )

      // 本轮发生过压缩 → 持久化摘要（锚点 = 被覆盖的最后一条展示消息），后续发送复用
      if (reply.compression) {
        const anchor = prepared.filtered[prepared.prevCovers + reply.compression.coveredHistoryCount - 1]
        if (anchor) {
          applyContextCompression(
            conversationId,
            { id: anchor.id, created_at: anchor.created_at },
            reply.compression,
          )
        }
      }

      setStreamingContent(null)
      const assistantMessage: DisplayMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: reply.content,
        model: sendModelId,
        created_at: new Date().toISOString(),
        toolCalls: records.length > 0 ? [...records] : undefined,
      }
      setMessages((prev) => [...prev, assistantMessage])
      // 本地持久化（后端 messages/batch 接口就绪前的过渡方案）
      appendAgentMessages(conversationId, [userMessage, assistantMessage])
      // 首轮对话后把占位标题改为首条消息前 20 字
      if (detail.title === '新对话' && text) {
        renameConversation(conversationId, text.slice(0, 20))
          .then((updated) => setDetail((prev) => (prev ? { ...prev, title: updated.title } : prev)))
          .catch(() => {})
      }
      onActivity()
      refreshBilling()
      return { ok: true, aborted: false }
    } catch (error) {
      setStreamingContent(null)
      const aborted = abortRef.current?.signal.aborted === true
      const message = error instanceof Error ? error.message : '发送失败，请稍后重试'
      if (aborted) {
        // 用户主动停止：保留已输入内容，不算失败
        setInput(text)
      } else if (message.includes('402') || message.includes('点数不足')) {
        setSendError({ text: message, recharge: true })
      } else {
        setSendError({ text: message })
        setInput(text)
      }
      return { ok: false, aborted, error: message }
    } finally {
      setSending(false)
    }
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text && attachments.length === 0) return
    void send(text)
  }

  /** 截断到 target 消息（含），返回剩余序列并同步 state 与本地存储 */
  const truncateAt = (target: DisplayMessage): DisplayMessage[] => {
    const remaining = messages.filter(
      (m) =>
        m.created_at < target.created_at ||
        (m.created_at === target.created_at && m.id < target.id),
    )
    truncateConversation(conversationId, target)
    setMessages(remaining)
    setStreamingContent(null)
    setToolRecords([])
    return remaining
  }

  /** 回滚到某条消息：该消息及其后全部删除，不自动重发（确认弹窗二次确认） */
  const [rollbackTarget, setRollbackTarget] = useState<DisplayMessage | null>(null)

  const handleRollbackConfirm = () => {
    if (rollbackTarget) truncateAt(rollbackTarget)
    setRollbackTarget(null)
  }

  /** 删除一组对话：这条用户消息 + 紧随其后的助手回复（确认弹窗二次确认） */
  const [deleteTarget, setDeleteTarget] = useState<DisplayMessage | null>(null)

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return
    const idx = messages.findIndex((m) => m.id === deleteTarget.id)
    const removed = [deleteTarget]
    const next = messages[idx + 1]
    if (next && next.role === 'assistant') removed.push(next)
    deleteMessages(conversationId, removed)
    setMessages(messages.filter((m) => !removed.some((r) => r.id === m.id)))
    setDeleteTarget(null)
  }

  /** 编辑用户消息并重发：截断到该消息后用新内容重新走一遍 Agent（附件/引用不保留） */
  const handleEditSave = (target: DisplayMessage, newText: string) => {
    const text = newText.trim()
    if (!text) return
    const remaining = truncateAt(target)
    void send(text, { historySource: remaining })
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  // 新会话首条消息自动发送：等会话详情、Agent 上下文、模型列表全部就绪后执行一次；
  // 失败则删除空会话并跳回新会话页展示错误（不留没有助手回复的废会话）
  useEffect(() => {
    if (!pendingAutoSend || !detail || !ctxReady || sending) return
    if (!canSend || !sendModelId) return
    const pending = pendingAutoSend
    setPendingAutoSend(null)
    void send(pending.text, {
      attachmentNames: pending.attachmentNames,
      refFileNames: pending.refFileNames,
      content: pending.content,
    }).then((result) => {
      if (!result.ok && !result.aborted) {
        deleteConversation(conversationId).catch(() => {})
        navigate('/chat', { replace: true, state: { sendError: result.error } })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoSend, detail, ctxReady, sending, canSend, sendModelId])

  if (loadError) {
    return (
      <section className="chat-view chat-view--center">
        <p className="chat-view__error">{loadError}</p>
      </section>
    )
  }

  if (!detail) {
    return (
      <section className="chat-view chat-view--center">
        <p className="chat-view__hint">加载会话中…</p>
      </section>
    )
  }

  return (
    <section className="chat-view">
      <header className="chat-view__header">
        <span className="chat-view__title">{detail.title}</span>
        {/* 创建时关联的知识库/技能（只读展示；关联在创建会话时生效） */}
        {detail.knowledge_ids.map((id) => (
          <span key={`kb-${id}`} className="chat-view__context-chip" title="关联知识库">
            🌐 {knowledgeBases?.find((kb) => kb.id === id)?.display_name ?? id}
          </span>
        ))}
        {detail.skill_ids.map((id) => (
          <span key={`skill-${id}`} className="chat-view__context-chip" title="关联技能">
            🛠 {skills?.find((s) => s.id === id)?.display_name ?? id}
          </span>
        ))}
      </header>

      <div className="chat-view__messages" ref={listRef}>
        {filterDisplayMessages(messages).length === 0 && (
          <p className="chat-view__hint">开始提问吧，Enter 发送、Shift+Enter 换行</p>
        )}
        {filterDisplayMessages(messages).map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onEditSave={
              message.role === 'user' && !sending
                ? (text) => handleEditSave(message, text)
                : undefined
            }
            onDelete={
              message.role === 'user' && !sending
                ? () => setDeleteTarget(message)
                : undefined
            }
            onRollback={
              message.role === 'user' && !sending
                ? () => setRollbackTarget(message)
                : undefined
            }
          />
        ))}
        {/* 流式内容：正在输出的助手回复（尚未加入 messages），上方展示工具调用记录 */}
        {(streamingContent !== null || toolRecords.length > 0) && sending && (
          <div className="msg msg--assistant">
            <div className="msg__bubble">
              <ToolCallList records={toolRecords} />
              {streamingContent !== null && (
                <div
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(streamingContent || '…'),
                  }}
                />
              )}
            </div>
          </div>
        )}
        {/* 发送中但尚未收到第一块内容 */}
        {sending && streamingContent === null && <ThinkingBubble status={streamStatus} />}
        {/* 流式停止按钮 */}
        {sending && (
          <div className="chat-view__stop">
            <button className="btn btn--ghost" onClick={handleStop}>
              ■ 停止生成
            </button>
          </div>
        )}
      </div>

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

      {/* 回滚确认弹窗：说明后果，防止误删 */}
      <ConfirmDialog
        open={rollbackTarget !== null}
        title="回滚到这条消息？"
        description="回滚将删除这条消息及其后的所有对话内容，且无法恢复。你可以从这条消息之前的位置继续对话。"
        confirmText="回滚"
        onConfirm={handleRollbackConfirm}
        onCancel={() => setRollbackTarget(null)}
      />

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除这条消息？"
        description="将删除这条消息及其对应的助手回复，且无法恢复。其余对话内容不受影响。"
        confirmText="删除"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <footer className="chat-view__footer">
        <MessageInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={sending}
          sendDisabled={sending || !canSend}
          allowEmptySend={attachments.length > 0}
          placeholder={
            canSend ? '输入消息… Enter 发送，Shift+Enter 换行' : '暂无可用模型，无法发送'
          }
          leftControls={
            <>
              <ModelSelector
                models={models}
                value={selectorValue}
                onChange={handleModelChange}
                disabled={sending}
              />
              {/* 知识库/技能：已有会话只读展示（后端 PUT 不支持关联更新），
                  下拉列表可展开查看，但不可勾选（disabled） */}
              <ContextPicker
                knowledgeBases={knowledgeBases}
                skills={skills}
                selectedKbIds={detail.knowledge_ids}
                selectedSkillIds={detail.skill_ids}
                onToggleKb={() => {}}
                onToggleSkill={() => {}}
                disabled={true}
              />
              <FileRefPicker
                kbIds={detail.knowledge_ids}
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
        />
      </footer>
    </section>
  )
}
