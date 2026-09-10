/**
 * Agent 运行时接入层（browser 端）
 *
 * 职责：
 * 1. 启动时向 @aoe/agent 注入 apiBase / getToken / onUnauthorized
 * 2. 组装通用对话的 system prompt 各层（知识库目录索引、技能描述）
 * 3. 准备通用对话工具集（知识库搜索 + 后端第三方工具）
 * 4. Agent 消息的本地持久化（后端 messages/batch 接口就绪前的过渡方案）
 */

import {
  createKnowledgeSearchTool,
  createThirdPartyTool,
  fetchAvailableTools,
  initAgentRuntime,
  type LLMMessage,
  type ToolDefinition,
} from '@aoe/agent'
import { API_BASE, getToken, logout } from '../lib/auth'
import { apiFetch } from '../lib/api'
import type {
  ConversationDetail,
  DisplayMessage,
  KnowledgeIndex,
  ModelInfo,
} from './types'
import { filterDisplayMessages } from './types'

/** 应用启动时调用一次（main.tsx） */
export function setupAgentRuntime(): void {
  initAgentRuntime({ apiBase: API_BASE, getToken, onUnauthorized: logout })
}

// ============ system prompt 组装 ============

interface SkillIndex {
  skill_name: string
  files: { filename: string; summary: string }[]
}

/** 拉取知识库目录索引并格式化为提示词层 */
async function buildKnowledgeIndexLayer(kbIds: string[]): Promise<string | undefined> {
  if (kbIds.length === 0) return undefined
  const indexes = await Promise.all(
    kbIds.map((id) => apiFetch<KnowledgeIndex>(`/v1/knowledge/bases/${id}/index`).catch(() => null)),
  )
  const parts: string[] = []
  for (const idx of indexes) {
    if (!idx) continue
    const files = idx.files
      .map((f) => `- ${f.filename}${f.summary ? `：${f.summary}` : ''}`)
      .join('\n')
    parts.push(`### 知识库「${idx.display_name || idx.kb_name}」\n${files}`)
  }
  if (parts.length === 0) return undefined
  return `你可以查阅以下知识库（用 search_knowledge 工具搜索其中内容）：\n\n${parts.join('\n\n')}`
}

/** 拉取技能目录索引并格式化为提示词层 */
async function buildSkillLayer(skillIds: string[]): Promise<string | undefined> {
  if (skillIds.length === 0) return undefined
  const indexes = await Promise.all(
    skillIds.map((id) =>
      apiFetch<SkillIndex>(`/v1/resources/skills/${id}/index`).catch(() => null),
    ),
  )
  const parts: string[] = []
  for (const idx of indexes) {
    if (!idx) continue
    const files = idx.files
      .map((f) => `- ${f.filename}${f.summary ? `：${f.summary}` : ''}`)
      .join('\n')
    parts.push(`### 技能「${idx.skill_name}」\n${files}`)
  }
  if (parts.length === 0) return undefined
  return `你已掌握以下技能（技能文件描述了完成特定任务的方法与步骤，请遵循）：\n\n${parts.join('\n\n')}`
}

/** 组装通用对话 system prompt 的各层内容（不含 identity，identity 由 buildSystemPrompt 默认提供） */
export async function buildChatPromptLayers(detail: ConversationDetail): Promise<{
  knowledgeIndex?: string
  skillDescriptions?: string
}> {
  const [knowledgeIndex, skillDescriptions] = await Promise.all([
    buildKnowledgeIndexLayer(detail.knowledge_ids),
    buildSkillLayer(detail.skill_ids),
  ])
  return { knowledgeIndex, skillDescriptions }
}

/** file_refs 层：后端暂无文件全文接口，先注入所选文件的摘要并提示可搜索 */
export function buildFileRefsLayer(refFiles: string[], index?: KnowledgeIndex): string | undefined {
  if (refFiles.length === 0) return undefined
  const lines = refFiles.map((name) => {
    const file = index?.files.find((f) => f.filename === name)
    return `- ${name}${file?.summary ? `：${file.summary}` : ''}`
  })
  return `用户引用了以下知识库文件，回答时优先参考（可用 search_knowledge 检索全文片段）：\n${lines.join('\n')}`
}

/** 拉取会话首个知识库的目录索引（file_refs 层用） */
export async function fetchFirstKnowledgeIndex(
  kbIds: string[],
): Promise<KnowledgeIndex | undefined> {
  if (kbIds.length === 0) return undefined
  return apiFetch<KnowledgeIndex>(`/v1/knowledge/bases/${kbIds[0]}/index`).catch(() => undefined)
}

// ============ 工具集 ============

let thirdPartyToolsCache: ToolDefinition[] | null = null

/**
 * 通用对话工具集：知识库搜索 + 后端第三方工具（/v1/tools/available 动态注册）。
 * 第三方工具列表会话内缓存一次。
 */
export async function getChatTools(): Promise<ToolDefinition[]> {
  const tools: ToolDefinition[] = [createKnowledgeSearchTool()]
  if (thirdPartyToolsCache === null) {
    const available = await fetchAvailableTools().catch(() => [])
    thirdPartyToolsCache = available.map(createThirdPartyTool)
  }
  return [...tools, ...thirdPartyToolsCache]
}

// ============ 本地持久化（过渡方案，等后端 messages/batch 接口） ============

const storageKey = (conversationId: string) => `aoe_agent_msgs_${conversationId}`

/** 加载本地缓存的 Agent 消息（与后端历史合并展示用） */
export function loadAgentMessages(conversationId: string): DisplayMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(conversationId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as DisplayMessage[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 追加消息到本地缓存 */
export function appendAgentMessages(conversationId: string, messages: DisplayMessage[]): void {
  try {
    const existing = loadAgentMessages(conversationId)
    localStorage.setItem(storageKey(conversationId), JSON.stringify([...existing, ...messages]))
  } catch {
    /* 存储满等异常忽略，不影响对话 */
  }
}

/** 清空本地缓存（会话删除时调用，连同上下文摘要、截断标记、删除集合一起清） */
export function clearAgentMessages(conversationId: string): void {
  try {
    localStorage.removeItem(storageKey(conversationId))
    localStorage.removeItem(ctxSummaryKey(conversationId))
    localStorage.removeItem(truncKey(conversationId))
    localStorage.removeItem(deletedKey(conversationId))
  } catch {
    /* ignore */
  }
}

// ============ 消息截断 / 删除（编辑重发、回滚、删除单组的本地过渡方案） ============

/**
 * 截断点：cutoff 消息及其后的所有消息对用户隐藏。
 * 后端暂无消息删除接口，用本地标记过滤后端历史；
 * localStorage 里的 Agent 消息是前端自己的数据，截断时物理删除。
 * 后端 truncate 接口上线后切换为服务端真删（见 docs/后端需求清单.md）。
 */
interface TruncationPoint {
  cutoffCreatedAt: string
  cutoffId: number
}

const truncKey = (conversationId: string) => `aoe_agent_trunc_${conversationId}`
/** 单组删除的消息 id 集合（后端消息的本地删除标记；本地消息直接物理删除） */
const deletedKey = (conversationId: string) => `aoe_agent_deleted_${conversationId}`

export function getTruncation(conversationId: string): TruncationPoint | null {
  try {
    const raw = localStorage.getItem(truncKey(conversationId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as TruncationPoint
    return typeof parsed.cutoffCreatedAt === 'string' && typeof parsed.cutoffId === 'number'
      ? parsed
      : null
  } catch {
    return null
  }
}

function getDeletedIds(conversationId: string): Set<number> {
  try {
    const raw = localStorage.getItem(deletedKey(conversationId))
    const parsed = raw ? (JSON.parse(raw) as number[]) : []
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

/** 判断消息是否被截断点隐藏（cutoff 本身及其后） */
function isTruncated(m: DisplayMessage, cutoff: TruncationPoint): boolean {
  return (
    m.created_at > cutoff.cutoffCreatedAt ||
    (m.created_at === cutoff.cutoffCreatedAt && m.id >= cutoff.cutoffId)
  )
}

/**
 * 应用本地隐藏规则（截断点 + 单组删除集合）过滤消息列表，
 * 加载后端历史 + 本地缓存合并后调用。
 */
export function applyLocalFilters(
  conversationId: string,
  messages: DisplayMessage[],
): DisplayMessage[] {
  const cutoff = getTruncation(conversationId)
  const deleted = getDeletedIds(conversationId)
  if (!cutoff && deleted.size === 0) return messages
  return messages.filter(
    (m) => !(cutoff && isTruncated(m, cutoff)) && !deleted.has(m.id),
  )
}

/** 摘要失效判定：删改影响到摘要覆盖区（锚点消息时间之前）则清除摘要 */
function invalidateSummaryIfAffected(
  conversationId: string,
  affected: DisplayMessage[],
): void {
  const stored = loadContextSummary(conversationId)
  if (!stored) return
  if (affected.some((m) => m.created_at <= stored.lastCoveredCreatedAt)) {
    try {
      localStorage.removeItem(ctxSummaryKey(conversationId))
    } catch {
      /* ignore */
    }
  }
}

/**
 * 在 cutoff 消息处截断会话（回滚 / 编辑重发）：
 * 写截断标记 + 物理删除本地 Agent 消息 + 校验摘要
 * （截进摘要覆盖区则摘要失效，下次发送自动重新压缩）。
 */
export function truncateConversation(
  conversationId: string,
  cutoff: DisplayMessage,
): void {
  try {
    const point: TruncationPoint = { cutoffCreatedAt: cutoff.created_at, cutoffId: cutoff.id }
    localStorage.setItem(truncKey(conversationId), JSON.stringify(point))
    const locals = loadAgentMessages(conversationId).filter((m) => !isTruncated(m, point))
    localStorage.setItem(storageKey(conversationId), JSON.stringify(locals))
    invalidateSummaryIfAffected(conversationId, [cutoff])
  } catch {
    /* 存储满等异常忽略 */
  }
}

/**
 * 删除一组消息（单条用户消息 + 其助手回复）：
 * 本地 Agent 消息物理删除，后端消息记入删除集合，加载时过滤。
 * 删到摘要覆盖区则摘要失效。
 */
export function deleteMessages(conversationId: string, removed: DisplayMessage[]): void {
  try {
    const ids = new Set(removed.map((m) => m.id))
    const locals = loadAgentMessages(conversationId).filter((m) => !ids.has(m.id))
    localStorage.setItem(storageKey(conversationId), JSON.stringify(locals))
    const deleted = getDeletedIds(conversationId)
    removed.forEach((m) => deleted.add(m.id))
    localStorage.setItem(deletedKey(conversationId), JSON.stringify([...deleted]))
    invalidateSummaryIfAffected(conversationId, removed)
  } catch {
    /* 存储满等异常忽略 */
  }
}

// ============ 上下文自动压缩（摘要持久化 + 历史组装） ============

/**
 * 由所选模型的上下文窗口推导 Agent 上下文预算：
 * 窗口减去输出预留，至少 16K。模型信息缺失时返回 undefined（用引擎默认值）。
 * 用户从大窗口模型切到小窗口模型后，下次发送会自动触发压缩。
 */
export function resolveContextBudget(model: ModelInfo | undefined): number | undefined {
  if (!model || !model.max_tokens) return undefined
  return Math.max(16384, model.max_tokens - (model.max_output_tokens || 0))
}

interface ContextSummary {
  /** 格式版本：v1（covers 下标）已废弃，加载即丢弃 */
  v: 2
  /** 早期对话摘要文本 */
  summary: string
  /** 锚点：摘要覆盖到的最后一条展示消息 id。
   *  按 id 定位而非下标，删除/回滚历史后仍能正确对齐；
   *  锚点被删则摘要失效（见 truncateConversation / deleteMessages / prepareAgentHistory）。 */
  lastCoveredId: number
  /** 锚点消息的 created_at（删改是否侵入摘要覆盖区的判定依据） */
  lastCoveredCreatedAt: string
}

const ctxSummaryKey = (conversationId: string) => `aoe_agent_ctx_${conversationId}`

function loadContextSummary(conversationId: string): ContextSummary | null {
  try {
    const raw = localStorage.getItem(ctxSummaryKey(conversationId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ContextSummary>
    return parsed.v === 2 &&
      typeof parsed.summary === 'string' &&
      typeof parsed.lastCoveredId === 'number' &&
      typeof parsed.lastCoveredCreatedAt === 'string'
      ? (parsed as ContextSummary)
      : null
  } catch {
    return null
  }
}

export interface PreparedHistory {
  history: LLMMessage[]
  /** 上次压缩留下的摘要（传给 runAgent 的 priorSummary） */
  priorSummary?: string
  /** history 在 filtered 序列中的起始下标（压缩记账基线，算新锚点用） */
  prevCovers: number
  /** 过滤后的展示消息序列（调用方用于把 coveredHistoryCount 换算成锚点 id） */
  filtered: DisplayMessage[]
}

/**
 * 组装送入 Agent 的历史：
 * - 无摘要：取最近 20 条 user/assistant 消息；
 * - 有摘要：按锚点 id 定位，取锚点之后的全部消息 + 注入摘要
 *   （条数不设上限，超限时由 Agent 再次压缩）；
 * - 锚点 id 在序列中找不到（被回滚/删除）→ 摘要失效清除，退化为最近 20 条。
 */
export function prepareAgentHistory(
  messages: DisplayMessage[],
  conversationId: string,
): PreparedHistory {
  const filtered = filterDisplayMessages(messages).filter(
    (m) => (m.role === 'user' || m.role === 'assistant') && m.content,
  )
  const toLLM = (list: typeof filtered): LLMMessage[] =>
    list.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  const recentOnly = (): PreparedHistory => {
    const history = filtered.slice(-20)
    return { history: toLLM(history), prevCovers: filtered.length - history.length, filtered }
  }

  const stored = loadContextSummary(conversationId)
  if (!stored) return recentOnly()
  const anchorIdx = filtered.findIndex((m) => m.id === stored.lastCoveredId)
  if (anchorIdx < 0) {
    try {
      localStorage.removeItem(ctxSummaryKey(conversationId))
    } catch {
      /* ignore */
    }
    return recentOnly()
  }
  return {
    history: toLLM(filtered.slice(anchorIdx + 1)),
    priorSummary: stored.summary,
    prevCovers: anchorIdx + 1,
    filtered,
  }
}

/** 压缩发生后持久化新摘要，锚点为被覆盖的最后一条展示消息 */
export function applyContextCompression(
  conversationId: string,
  anchor: { id: number; created_at: string },
  compression: { summary: string },
): void {
  try {
    const next: ContextSummary = {
      v: 2,
      summary: compression.summary,
      lastCoveredId: anchor.id,
      lastCoveredCreatedAt: anchor.created_at,
    }
    localStorage.setItem(ctxSummaryKey(conversationId), JSON.stringify(next))
  } catch {
    /* 存储满等异常忽略 */
  }
}
