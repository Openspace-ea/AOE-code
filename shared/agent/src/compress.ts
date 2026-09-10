/**
 * 上下文自动压缩：估算 token 超限时，用 LLM 把早期消息摘要成一条
 *
 * 对应 docs/设计-前端AgentLoop架构.md §3.7。
 * 触发场景：
 * 1. 对话增长，估算 token 超过模型上下文预算的 80%；
 * 2. 用户从大上下文模型切换到小上下文模型（预算变小，下次发送自动触发）。
 *
 * 策略：保留 system + 最近 KEEP_RECENT 条（当前交互与工具调用链完整），
 * 其余早期消息序列化为对话记录后让同一个模型生成摘要，替换为一条摘要消息。
 * 摘要失败时返回原列表，由 ContextManager 的硬裁剪兜底。
 */

import type { LLMMessage } from './types'
import { estimateMessagesTokens } from './context'

/** 摘要消息的内容前缀（识别与持久化用） */
export const SUMMARY_PREFIX = '【早期对话摘要】'

/** 触发压缩的阈值（占预算比例） */
const TRIGGER_RATIO = 0.8
/** 压缩时保留的最近消息数（保证当前交互与 tool_calls ↔ tool 配对完整） */
const KEEP_RECENT = 6

export interface CompressionOutcome {
  /** 压缩后的消息列表（未压缩时为原列表） */
  messages: LLMMessage[]
  compressed: boolean
  /** 被摘要折叠的非 system 消息数 */
  foldedCount: number
  /** 生成的摘要文本（compressed 时存在） */
  summary?: string
}

/**
 * 找切分点：尾部保留 KEEP_RECENT 条，切口落在 user 消息边界上。
 * 落在 user 边界可保证不会拆散 assistant tool_calls 与其 tool 结果的配对。
 * 返回 -1 表示无法切分（消息太少）。
 */
function findSplitIndex(messages: LLMMessage[]): number {
  const firstNonSystem = messages.findIndex((m) => m.role !== 'system')
  const start = firstNonSystem < 0 ? 0 : firstNonSystem
  let cut = messages.length - KEEP_RECENT
  while (cut > start && messages[cut].role !== 'user') cut--
  return cut > start ? cut : -1
}

/** 把待摘要的消息序列化为可读对话记录（单条截断，控制摘要请求本身的体量） */
function toTranscript(messages: LLMMessage[]): string {
  const ROLE_LABELS: Record<string, string> = {
    user: '用户',
    assistant: '助手',
    tool: '工具结果',
    system: '系统',
  }
  return messages
    .map((m) => {
      const label = ROLE_LABELS[m.role] ?? m.role
      let text = m.content ?? ''
      if (m.tool_calls?.length) {
        const names = m.tool_calls.map((t) => t.function.name).join(', ')
        text += `${text ? '\n' : ''}[调用工具: ${names}]`
      }
      if (text.length > 2000) text = `${text.slice(0, 2000)}…(截断)`
      return `${label}: ${text || '(空)'}`
    })
    .join('\n\n')
}

/** 摘要请求的 prompt（给同一个模型做压缩，不引入额外模型依赖） */
export function buildSummaryPrompt(transcript: string): string {
  return `以下是一段多轮对话的早期记录。请将其压缩为一份摘要，供后续对话作为上下文使用。要求：
- 保留用户目标、关键事实、已得出的结论与重要数据（含关键工具调用结果）
- 保留未完成的待办与双方约定
- 删除寒暄、重复与过程性内容
- 用简洁中文分点输出，控制在 1200 字以内

对话记录：
${transcript}`
}

/**
 * 若估算 token 超过 maxTokens 的 80%，调用 summarize 把早期消息摘要成一条。
 * summarize 失败时返回原列表（不抛错），由调用方退化为硬裁剪。
 */
export async function compressIfNeeded(
  messages: LLMMessage[],
  maxTokens: number,
  summarize: (prompt: string) => Promise<string>,
): Promise<CompressionOutcome> {
  if (estimateMessagesTokens(messages) <= maxTokens * TRIGGER_RATIO) {
    return { messages, compressed: false, foldedCount: 0 }
  }
  const cut = findSplitIndex(messages)
  if (cut < 0) return { messages, compressed: false, foldedCount: 0 }

  const head = messages.slice(0, cut)
  const tail = messages.slice(cut)
  const systemMsgs = head.filter((m) => m.role === 'system')
  const toSummarize = head.filter((m) => m.role !== 'system')

  try {
    const summary = await summarize(buildSummaryPrompt(toTranscript(toSummarize)))
    if (!summary.trim()) throw new Error('摘要为空')
    const summaryMessage: LLMMessage = {
      role: 'user',
      content: `${SUMMARY_PREFIX}\n${summary}`,
    }
    return {
      messages: [...systemMsgs, summaryMessage, ...tail],
      compressed: true,
      foldedCount: toSummarize.length,
      summary,
    }
  } catch {
    // 摘要失败不阻塞主流程，硬裁剪兜底
    return { messages, compressed: false, foldedCount: 0 }
  }
}
