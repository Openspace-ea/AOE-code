/**
 * LLM Client：调后端 POST /v1/chat/completions（OpenAI 兼容，SSE 流式）
 *
 * 后端该接口是纯 LLM 代理：tools/tool_choice 透传、tool_calls 返回、
 * 流式输出。本模块负责 SSE 解析与 tool_calls 分片累积。
 */

import { getAgentRuntime } from './config'
import type { LLMMessage, OpenAITool, ToolCall } from './types'

export interface LLMChatOptions {
  model: string
  messages: LLMMessage[]
  tools?: OpenAITool[]
  stream?: boolean
  temperature?: number
  signal?: AbortSignal
  /** 流式文本增量回调 */
  onDelta?: (text: string) => void
}

export interface LLMResponse {
  content: string
  tool_calls: ToolCall[]
}

export async function llmChat(options: LLMChatOptions): Promise<LLMResponse> {
  const { apiBase, getToken, onUnauthorized } = getAgentRuntime()
  const token = getToken()

  const res = await fetch(`${apiBase}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      tools: options.tools && options.tools.length > 0 ? options.tools : undefined,
      stream: options.stream ?? true,
      temperature: options.temperature,
    }),
    signal: options.signal,
  })

  if (res.status === 401) {
    onUnauthorized?.()
    throw new Error('登录已过期')
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: string }
    // 始终附带状态码：调用方据此分类（402 充值、5xx 可重试等）
    throw new Error(`${data.detail || 'LLM 请求失败'} (${res.status})`)
  }

  // 非流式降级：后端返回 JSON 而非 SSE
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) {
    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[]
    }
    const message = data.choices?.[0]?.message
    const content = message?.content ?? ''
    if (content) options.onDelta?.(content)
    return { content, tool_calls: message?.tool_calls ?? [] }
  }

  // SSE 流式解析
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  const toolCalls: ToolCall[] = []

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()!

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data) as {
            choices?: { delta?: Record<string, unknown> }[]
          }
          const delta = parsed.choices?.[0]?.delta
          if (!delta) continue

          if (typeof delta.content === 'string' && delta.content) {
            content += delta.content
            options.onDelta?.(delta.content)
          }

          // 累积 tool_calls（流式中按 index 分片到达）
          const deltaToolCalls = delta.tool_calls as
            | {
                index?: number
                id?: string
                function?: { name?: string; arguments?: string }
              }[]
            | undefined
          if (deltaToolCalls) {
            for (const tc of deltaToolCalls) {
              const index = tc.index ?? 0
              const existing = toolCalls[index]
              if (existing) {
                existing.function.name += tc.function?.name ?? ''
                existing.function.arguments += tc.function?.arguments ?? ''
              } else {
                toolCalls[index] = {
                  id: tc.id ?? `call_${index}`,
                  type: 'function',
                  function: {
                    name: tc.function?.name ?? '',
                    arguments: tc.function?.arguments ?? '',
                  },
                }
              }
            }
          }
        } catch {
          /* 非 JSON 行，忽略 */
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return { content, tool_calls: toolCalls.filter(Boolean) }
}
