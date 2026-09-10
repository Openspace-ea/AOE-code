/**
 * 上下文管理器：token 估算 + 历史裁剪
 *
 * 对应 docs/设计-前端AgentLoop架构.md §3.7。
 * 正常路径由 compress.ts 做 LLM 摘要压缩（runAgent 每轮调用）；
 * 本类的 trim 只作最后兜底（摘要失败或单条消息超大时硬删）。
 * 裁剪保证不破坏 tool_calls ↔ tool 配对。
 */

import type { LLMMessage } from './types'

/** 估算单条文本的 token 数：CJK 字符约 1 token/字，其余约 4 字符 1 token */
export function estimateTextTokens(text: string): number {
  let total = 0
  for (const ch of text) {
    // CJK 统一表意文字、平/片假名、谚文等常见区间
    total += /[㐀-鿿豈-﫿\uac00-\ud7af\u3040-\u30ff]/.test(ch) ? 1 : 0.25
  }
  return Math.ceil(total)
}

/** 估算一组消息的 token 数 */
export function estimateMessagesTokens(messages: LLMMessage[]): number {
  let total = 0
  for (const m of messages) {
    total += estimateTextTokens(m.content ?? '')
    if (m.tool_calls) {
      total += m.tool_calls.length * 50 // 每个 tool_call 约 50 token
      for (const tc of m.tool_calls) {
        total += estimateTextTokens(tc.function.arguments)
      }
    }
  }
  return total
}

export class ContextManager {
  private messages: LLMMessage[] = []
  private maxTokens: number

  constructor(maxTokens = 120000) {
    this.maxTokens = maxTokens
  }

  push(message: LLMMessage): void {
    this.messages.push(message)
  }

  pushAll(messages: LLMMessage[]): void {
    this.messages.push(...messages)
  }

  /** 整体替换消息列表（压缩后调用） */
  replaceAll(messages: LLMMessage[]): void {
    this.messages = [...messages]
  }

  getMessages(): LLMMessage[] {
    return this.messages
  }

  /**
   * 兜底裁剪（由 runAgent 在摘要压缩后仍超限时显式调用）：
   * 估算 token 超过上限 90% 时，从最早的非 system 消息开始删除。
   * 保护末尾 6 条（当前工具结果链 + 最新交互），并避免删出孤立的
   * tool 消息（其对应的 assistant tool_calls 已被删时一并删除）。
   */
  trimNow(): void {
    while (this.estimateTokens() > this.maxTokens * 0.9 && this.messages.length > 8) {
      const idx = this.messages.findIndex((m) => m.role !== 'system')
      if (idx < 0 || idx >= this.messages.length - 6) break
      this.messages.splice(idx, 1)
      // 若下一条是孤立的 tool 消息（其对应的 assistant tool_calls 刚被删），级联删除
      while (
        idx < this.messages.length &&
        this.messages[idx].role === 'tool' &&
        (idx === 0 || this.messages[idx - 1].role !== 'assistant')
      ) {
        this.messages.splice(idx, 1)
      }
    }
  }

  /** 估算当前消息列表的 token 数 */
  estimateTokens(): number {
    return estimateMessagesTokens(this.messages)
  }
}
