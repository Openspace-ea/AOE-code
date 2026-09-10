/**
 * 专业模式统一 Agent 对话面板（壳）
 *
 * 壳只负责 UI 与通用对话逻辑：会话按场景持久化（convScope 唯一标识，含场景
 * id，历史场景自动带出历史对话并延续上下文）、消息流、输入区组装（复用通用
 * 对话原子组件：模型选择 Auto 规则、知识库/技能关联、file_refs 引用、文本
 * 上传）。
 *
 * 发送走前端 Agent Loop（@aoe/agent 的 runAgent，与通用对话 ChatView 同方案）：
 * 1. system prompt 由 buildSystemPrompt 拼装：知识库/技能目录层 + 场景指令层
 *    （scenarioPrompt）+ 场景实时状态层（buildPromptContext → sceneContext）；
 * 2. 场景动作注册为标准 function calling 工具（sceneTools，source: 'scene'），
 *    与知识库搜索/第三方工具一起交给模型自主调用，结果回灌后继续推理；
 * 3. 流式事件实时映射到 UI（思考中/正在调用工具/正在生成 + 工具调用记录）；
 * 4. 消息本地持久化（appendAgentMessages，后端 messages/batch 接口就绪前的
 *    过渡方案），首轮对话后自动改会话标题。
 *
 * 面板默认展开，可收起为细条；左边框拖拽调节宽度（最小宽度保证输入区按钮不换行）。
 */

import { useEffect, useRef, useState } from 'react'
import { runAgent, buildSystemPrompt, type ToolDefinition } from '@aoe/agent'
import { RECHARGE_URL } from '../../../lib/constants'
import { useBilling } from '../../../components/layout/BillingContext'
import {
  createConversation,
  getConversation,
  renameConversation,
  updateConversationModel,
} from '../../../services/conversation'
import type { StreamStatus } from '../../../services/conversation'
import {
  appendAgentMessages,
  applyContextCompression,
  applyLocalFilters,
  buildChatPromptLayers,
  buildFileRefsLayer,
  clearAgentMessages,
  deleteMessages,
  fetchFirstKnowledgeIndex,
  getChatTools,
  loadAgentMessages,
  prepareAgentHistory,
  resolveContextBudget,
  truncateConversation,
} from '../../../services/agentRuntime'
import { useModels } from '../../../services/useModels'
import { useResources } from '../../../services/useResources'
import type {
  ConversationDetail,
  DisplayMessage,
  KnowledgeIndex,
  ToolCallRecord,
} from '../../../services/types'
import { filterDisplayMessages } from '../../../services/types'
import MessageBubble, { renderMarkdown } from '../../chat/MessageBubble'
import ConfirmDialog from '../../../components/ConfirmDialog'
import ThinkingBubble from '../../chat/ThinkingBubble'
import ToolCallList from '../../chat/ToolCallList'
import MessageInput from '../../chat/MessageInput'
import ModelSelector, { AUTO_MODEL_VALUE, resolveModelId } from '../../chat/ModelSelector'
import ContextPicker from '../../chat/ContextPicker'
import FileRefPicker from '../../chat/FileRefPicker'
import UploadButton, {
  buildContentWithAttachments,
  type ChatAttachment,
} from '../../chat/UploadButton'
import CollapseRail from './CollapseRail'
import '../../chat/chat.css'

interface AgentPanelProps {
  /** 会话标识（如 orbit_<sceneId>），决定会话的存取与历史加载 */
  convScope: string
  /** 场景指令文本（注入 system prompt 的 scenario 层：角色与操作规则） */
  scenarioPrompt: string
  /** 生成场景实时状态摘要（注入 system prompt 的 sceneContext 层），每次发送时调用 */
  buildPromptContext: () => string
  /** 场景操作工具集（source: 'scene'），execute 直接调用场景页的动作执行回调 */
  sceneTools: ToolDefinition[]
  /** professional 会话的场景标识（如 orbit）；不传则后端按无场景配置处理 */
  scenario?: string
  /** 空会话引导语 */
  emptyHint?: string
  /** 空会话建议指令列表（点击直接填入输入框并发送） */
  suggestions?: string[]
  /** Agent 回复完成后回调 */
  onAgentReply?: () => void
}

const CONV_KEY_PREFIX = 'aoe_pro_conv_'

/** 场景删除时调用：清理该场景会话的本地消息缓存与会话 id 映射 */
export function clearSceneAgentMessages(convScope: string): void {
  const convId = localStorage.getItem(CONV_KEY_PREFIX + convScope)
  if (convId) clearAgentMessages(convId)
  localStorage.removeItem(CONV_KEY_PREFIX + convScope)
}

/** 面板宽度约束：最小宽度保证「模型选择 + 更多 + 发送」不折叠换行 */
const MIN_WIDTH = 280
const MAX_WIDTH = 640
/** 达到该宽度时，输入区全部工具按钮内联展示；否则折叠进「更多」 */
const CONTROLS_FULL_WIDTH = 520
const WIDTH_STORAGE_KEY = 'aoe_agent_width'

/** 发送失败的展示状态；recharge 为 true 时附带充值入口 */
interface SendError {
  text: string
  recharge?: boolean
}

export default function AgentPanel({
  convScope,
  scenarioPrompt,
  buildPromptContext,
  sceneTools,
  scenario,
  emptyHint,
  suggestions,
  onAgentReply,
}: AgentPanelProps) {
  const { refresh: refreshBilling } = useBilling()
  const { models } = useModels()
  const { knowledgeBases, skills } = useResources()
  const [conversationId, setConversationId] = useState<string | null>(null)
  // 会话已有的标题/模型/关联（创建后只读展示/发送沿用）
  const [convTitle, setConvTitle] = useState<string>('新对话')
  const [convModelId, setConvModelId] = useState<string | null>(null)
  const [convKbIds, setConvKbIds] = useState<string[]>([])
  const [convSkillIds, setConvSkillIds] = useState<string[]>([])
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  /** 流式输出的累积内容（sending 期间实时更新） */
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null)
  // Agent Loop 运行中已产生的工具调用记录（流式区域展示）
  const [toolRecords, setToolRecords] = useState<ToolCallRecord[]>([])
  const [error, setError] = useState<SendError | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  // 输入区状态（与通用对话一致）
  const [selection, setSelection] = useState<string | null>(null)
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([])
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([])
  const [refFiles, setRefFiles] = useState<string[]>([])
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [toolsOpen, setToolsOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const toolsRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  // 每个会话准备一次的 Agent 上下文：system prompt 各层 + 通用工具集 + 知识库索引
  const promptLayersRef = useRef<{ knowledgeIndex?: string; skillDescriptions?: string }>({})
  const chatToolsRef = useRef<ToolDefinition[]>([])
  const kbIndexRef = useRef<KnowledgeIndex | undefined>(undefined)
  // 场景工具集随场景页每次渲染更新（闭包读取最新场景状态），用 ref 供发送时取最新值
  const sceneToolsRef = useRef<ToolDefinition[]>(sceneTools)
  sceneToolsRef.current = sceneTools

  // 面板宽度：左边框拖拽调节（持久化），最小宽度保证输入区按钮不折叠换行
  const [width, setWidth] = useState(() => {
    const stored = Number(localStorage.getItem(WIDTH_STORAGE_KEY))
    return stored >= MIN_WIDTH && stored <= MAX_WIDTH ? stored : 320
  })
  const widthRef = useRef(width)
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null)

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    dragState.current = { startX: e.clientX, startWidth: widthRef.current }
    console.log('[Agent] resize start', { x: e.clientX, width: widthRef.current })
    const onMove = (ev: MouseEvent) => {
      if (!dragState.current) return
      const delta = dragState.current.startX - ev.clientX
      const next = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, dragState.current.startWidth + delta),
      )
      console.log('[Agent] resize move', { x: ev.clientX, delta, next })
      widthRef.current = next
      setWidth(next)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      localStorage.setItem(WIDTH_STORAGE_KEY, String(widthRef.current))
      dragState.current = null
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // 「更多」菜单：点击外部收起
  useEffect(() => {
    if (!toolsOpen) return
    const onClickOutside = (event: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
        setToolsOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [toolsOpen])

  /** 宽度不足时，知识库/技能/引用/上传折叠进「更多」菜单 */
  const compactControls = width < CONTROLS_FULL_WIDTH

  // 选择器当前值：显式选择 > 会话已有模型（在列表中）> Auto
  const selectorValue =
    selection ??
    (convModelId && models?.some((m) => m.model_id === convModelId)
      ? convModelId
      : AUTO_MODEL_VALUE)
  const sendModelId = resolveModelId(selectorValue, models)
  const canSend = selectorValue === AUTO_MODEL_VALUE || sendModelId !== undefined

  // file_refs 可用的知识库：会话已关联 > 创建前勾选
  const refKbIds = conversationId ? convKbIds : selectedKbIds

  /** 会话就绪后准备 Agent 上下文（知识库/技能目录层、通用工具集、知识库索引） */
  const prepareAgentContext = (detail: ConversationDetail) => {
    buildChatPromptLayers(detail).then((layers) => {
      promptLayersRef.current = layers
    })
    getChatTools().then((tools) => {
      chatToolsRef.current = tools
    })
    fetchFirstKnowledgeIndex(detail.knowledge_ids).then((idx) => {
      kbIndexRef.current = idx
    })
  }

  // 加载该场景的历史会话（localStorage 中的 id；失效则静默重建）
  useEffect(() => {
    setConversationId(null)
    setConvTitle('新对话')
    setConvModelId(null)
    setConvKbIds([])
    setConvSkillIds([])
    setMessages([])
    setError(null)
    setSelection(null)
    setRefFiles([])
    setAttachments([])
    setToolRecords([])
    promptLayersRef.current = {}
    chatToolsRef.current = []
    kbIndexRef.current = undefined
    const storedId = localStorage.getItem(CONV_KEY_PREFIX + convScope)
    if (!storedId) return
    getConversation(storedId)
      .then((detail) => {
        setConversationId(detail.id)
        setConvTitle(detail.title)
        setConvModelId(detail.model_id)
        setConvKbIds(detail.knowledge_ids)
        setConvSkillIds(detail.skill_ids)
        // 用户消息剥离早期注入的场景上下文，只显示实际输入内容
        const cleaned = detail.messages.map((m) => {
          if (m.role !== 'user') return m
          const marker = '[用户消息]\n'
          const idx = m.content.indexOf(marker)
          if (idx >= 0) return { ...m, content: m.content.slice(idx + marker.length) }
          return m
        })
        // 后端历史 + 本地缓存的 Agent 消息，按时间合并排序（同刻按 id 次序兜底）；
        // 再按本地截断标记过滤（编辑重发/回滚的过渡方案，见 agentRuntime.ts）
        const merged = [...cleaned, ...loadAgentMessages(detail.id)].sort(
          (a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id,
        )
        setMessages(applyLocalFilters(detail.id, merged))
        prepareAgentContext(detail)
      })
      .catch(() => {
        localStorage.removeItem(CONV_KEY_PREFIX + convScope)
      })
    // 切换场景（组件卸载）时取消未完成的发送请求
    return () => abortRef.current?.abort()
  }, [convScope])

  // 新消息、流式内容或发送状态变化时滚动到底部
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, sending, streamingContent])

  const toggleId = (ids: string[], id: string): string[] =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]

  /** 切换模型：具体模型持久化到后端；Auto 仅本地生效 */
  const handleModelChange = async (value: string) => {
    const prev = selection
    setSelection(value)
    if (value === AUTO_MODEL_VALUE || !conversationId) return
    try {
      await updateConversationModel(conversationId, value)
      setConvModelId(value)
    } catch (err) {
      setSelection(prev)
      setError({ text: `切换模型失败：${err instanceof Error ? err.message : '未知错误'}` })
    }
  }

  /**
   * 发送核心。historySource：编辑重发时传入截断后的消息序列
   * （setMessages 异步，直接读 state 会拿到截断前的旧值）。
   */
  const send = async (text: string, historySource?: DisplayMessage[]) => {
    if ((!text && attachments.length === 0) || sending || !canSend || !sendModelId) return

    setInput('')
    setSending(true)
    setStreamingContent('')
    setStreamStatus({ phase: 'thinking' })
    setError(null)
    setToolRecords([])

    const userMessage: DisplayMessage = {
      id: Date.now(),
      role: 'user',
      content: text || '（上传文件）',
      created_at: new Date().toISOString(),
      attachmentNames: attachments.map((a) => a.name),
      refFileNames: refFiles,
    }
    setMessages((prev) => [...prev, userMessage])
    const content = buildContentWithAttachments(text, attachments)
    setAttachments([])
    setRefFiles([])

    abortRef.current = new AbortController()

    try {
      // 惰性创建会话（带模型与知识库/技能关联）并持久化 id
      let convId = conversationId
      if (!convId) {
        const conversation = await createConversation(
          sendModelId,
          selectedKbIds.length > 0 ? selectedKbIds : undefined,
          selectedSkillIds.length > 0 ? selectedSkillIds : undefined,
          'professional',
          scenario,
        )
        convId = conversation.id
        setConversationId(convId)
        setConvTitle(conversation.title)
        setConvModelId(conversation.model_id)
        setConvKbIds(selectedKbIds)
        setConvSkillIds(selectedSkillIds)
        localStorage.setItem(CONV_KEY_PREFIX + convScope, convId)
        // 首次发送前同步准备 Agent 上下文（等工具集就绪再进入循环）
        const detail: ConversationDetail = {
          ...conversation,
          messages: [],
          knowledge_ids: selectedKbIds,
          skill_ids: selectedSkillIds,
        }
        const [layers, chatTools, kbIndex] = await Promise.all([
          buildChatPromptLayers(detail),
          getChatTools(),
          fetchFirstKnowledgeIndex(selectedKbIds),
        ])
        promptLayersRef.current = layers
        chatToolsRef.current = chatTools
        kbIndexRef.current = kbIndex
      }

      // system prompt：知识库/技能目录 + 场景指令 + file_refs + 场景实时状态
      const systemPrompt = buildSystemPrompt({
        ...promptLayersRef.current,
        scenario: scenarioPrompt,
        fileRefs: buildFileRefsLayer(refFiles, kbIndexRef.current),
        sceneContext: buildPromptContext(),
      })
      // 历史：经 prepareAgentHistory 组装（有压缩摘要时注入摘要 + 未覆盖消息）；
      // 上下文预算按所选模型窗口推导（切到小窗口模型后自动触发压缩）
      const prepared = prepareAgentHistory(historySource ?? messages, convId)
      const contextBudget = resolveContextBudget(
        models?.find((m) => m.model_id === sendModelId),
      )

      // 场景工具在前（操作场景是专业模式主诉求），通用工具在后
      const tools = [...sceneToolsRef.current, ...chatToolsRef.current]
      const records: ToolCallRecord[] = []
      let turnHasText = false
      let currentTurn = 1

      const reply = await runAgent(
        {
          modelId: sendModelId,
          systemPrompt,
          history: prepared.history,
          priorSummary: prepared.priorSummary,
          maxContextTokens: contextBudget,
        },
        tools,
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
            convId,
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
      appendAgentMessages(convId, [userMessage, assistantMessage])
      // 首轮对话后把占位标题改为首条消息前 20 字
      if (convTitle === '新对话' && text) {
        renameConversation(convId, text.slice(0, 20))
          .then((updated) => setConvTitle(updated.title))
          .catch(() => {})
      }
      onAgentReply?.()
      refreshBilling()
    } catch (err) {
      setStreamingContent(null)
      const message = err instanceof Error ? err.message : '发送失败，请稍后重试'
      if (message.includes('402') || message.includes('点数不足')) {
        setError({ text: message, recharge: true })
      } else {
        setError({ text: message })
        setInput(text)
      }
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
    if (conversationId) truncateConversation(conversationId, target)
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
    if (conversationId) deleteMessages(conversationId, removed)
    setMessages(messages.filter((m) => !removed.some((r) => r.id === m.id)))
    setDeleteTarget(null)
  }

  /** 编辑用户消息并重发：截断到该消息后用新内容重新走一遍 Agent（附件/引用不保留） */
  const handleEditSave = (target: DisplayMessage, newText: string) => {
    const text = newText.trim()
    if (!text) return
    const remaining = truncateAt(target)
    void send(text, remaining)
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  // 收起态：仅一个展开按钮
  if (collapsed) {
    return (
      <CollapseRail side="right" title="展开 Agent 对话" onExpand={() => setCollapsed(false)} />
    )
  }

  // 工具按钮组（宽度不足时折叠进「更多」菜单）
  const toolButtons = (
    <>
      {/* 知识库/技能关联：仅会话创建前可勾选，创建后只读（见头部 chips） */}
      {!conversationId && (
        <ContextPicker
          knowledgeBases={knowledgeBases}
          skills={skills}
          selectedKbIds={selectedKbIds}
          selectedSkillIds={selectedSkillIds}
          onToggleKb={(id) => setSelectedKbIds((ids) => toggleId(ids, id))}
          onToggleSkill={(id) => setSelectedSkillIds((ids) => toggleId(ids, id))}
          disabled={sending}
        />
      )}
      <FileRefPicker
        kbIds={refKbIds}
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
        onError={(msg) => setError({ text: msg })}
        disabled={sending}
      />
    </>
  )

  return (
    <aside className="pro-shell__agent" style={{ width }}>
      {/* 左边框拖拽调节宽度 */}
      <div
        className="pro-shell__agent-resizer"
        onMouseDown={handleResizeStart}
        title="拖动调节宽度"
      />
      <header className="pro-shell__agent-header">
        <span className="pro-shell__agent-title">AOE Code Agent</span>
        <button
          className="pro-shell__agent-close"
          onClick={() => setCollapsed(true)}
          title="收起"
        >
          »
        </button>
      </header>

      {/* 会话已关联的知识库/技能（只读展示） */}
      {(convKbIds.length > 0 || convSkillIds.length > 0) && (
        <div className="pro-shell__agent-chips">
          {convKbIds.map((id) => (
            <span key={`kb-${id}`} className="chat-view__context-chip" title="关联知识库">
              🌐 {knowledgeBases?.find((kb) => kb.id === id)?.display_name ?? id}
            </span>
          ))}
          {convSkillIds.map((id) => (
            <span key={`skill-${id}`} className="chat-view__context-chip" title="关联技能">
              🛠 {skills?.find((s) => s.id === id)?.display_name ?? id}
            </span>
          ))}
        </div>
      )}

      <div className="pro-shell__agent-messages" ref={listRef}>
        {filterDisplayMessages(messages).length === 0 && (
          <div className="pro-shell__agent-empty">
            <p className="pro-shell__agent-empty-hint">
              {emptyHint ?? '我是 AOE Code Agent，可以回答问题和操作场景。'}
            </p>
            {suggestions && suggestions.length > 0 && (
              <div className="pro-shell__agent-suggestions">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="pro-shell__agent-suggestion"
                    onClick={() => void send(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
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

      {error && (
        <div className="pro-shell__agent-error">
          <span>{error.text}</span>
          {error.recharge && (
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

      <footer className="pro-shell__agent-footer">
        <MessageInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={sending}
          sendDisabled={sending || !canSend}
          allowEmptySend={attachments.length > 0}
          placeholder={canSend ? '输入指令或问题，如「分析北京站对北斗的可见性」' : '暂无可用模型'}
          leftControls={
            <>
              <ModelSelector
                models={models}
                value={selectorValue}
                onChange={handleModelChange}
                disabled={sending}
              />
              {/* 宽度不足时折叠进「更多」菜单，避免按钮换行/折叠 */}
              {compactControls ? (
                <div className="model-selector" ref={toolsRef}>
                  <button
                    type="button"
                    className="model-selector__trigger"
                    onClick={() => setToolsOpen((v) => !v)}
                  >
                    ⋯ 更多
                  </button>
                  {toolsOpen && (
                    <div className="model-selector__dropdown pro-shell__agent-tools-menu">
                      {toolButtons}
                    </div>
                  )}
                </div>
              ) : (
                toolButtons
              )}
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
    </aside>
  )
}
