/**
 * 对话服务（API 文档 §六）
 */

import { apiFetch } from '../lib/api'
import { API_BASE, ApiError, getToken, logout } from '../lib/auth'
import type {
  ChatMessage,
  Conversation,
  ConversationDetail,
  ConversationListResponse,
} from './types'

/**
 * 流式输出过程中的阶段状态，用于 UI 展示正在做什么。
 * - thinking: 正在等待模型首个 token
 * - tool_call: 正在调用工具（技能/知识库/场景动作），附带工具名称
 * - generating: 正在生成回复内容
 * - compressing: 上下文超限，正在压缩早期对话为摘要
 * - retrying: 请求失败/超时，正在自动重试
 */
export type StreamStatus =
  | { phase: 'thinking' }
  | { phase: 'tool_call'; name: string }
  | { phase: 'generating' }
  | { phase: 'compressing' }
  | { phase: 'retrying'; reason?: string }

/** 会话列表（仅 active） */
export function listConversations(limit = 50, offset = 0): Promise<ConversationListResponse> {
  return apiFetch('/v1/conversations', { params: { status: 'active', limit, offset } })
}

/**
 * 创建会话。后端会在首条消息时自动取前 20 字作为标题，
 * 这里先给占位标题「新对话」。
 * model_id 可选：不传时后端按对话配置自动选择模型（API 文档 v2.3 §七）。
 * knowledge_ids / skill_ids：创建时关联知识库/技能（6.1），
 * 后端会把目录索引（摘要）与技能描述注入 system prompt。
 * conversationType：general（默认）/ professional（专业模式，后端自动注入场景提示+工具列表）。
 * scenario：专业模式场景 key（6.0 场景列表，如 orbit/coordinate/visibility/remote_sensing）。
 */
export function createConversation(
  modelId?: string,
  knowledgeIds?: string[],
  skillIds?: string[],
  conversationType?: string,
  scenario?: string,
): Promise<Conversation> {
  return apiFetch('/v1/conversations', {
    method: 'POST',
    body: JSON.stringify({
      title: '新对话',
      model_id: modelId,
      knowledge_ids: knowledgeIds,
      skill_ids: skillIds,
      conversation_type: conversationType,
      scenario,
    }),
  })
}

/** 会话详情（含全部消息与关联的知识库/技能） */
export function getConversation(id: string): Promise<ConversationDetail> {
  return apiFetch(`/v1/conversations/${id}`)
}

/** 重命名会话 */
export function renameConversation(id: string, title: string): Promise<Conversation> {
  return apiFetch(`/v1/conversations/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  })
}

/** 删除会话（软删除） */
export function deleteConversation(id: string): Promise<{ message: string }> {
  return apiFetch(`/v1/conversations/${id}`, { method: 'DELETE' })
}

/** 切换会话模型（6.4：PUT 支持 model_id 字段） */
export function updateConversationModel(id: string, modelId: string): Promise<Conversation> {
  return apiFetch(`/v1/conversations/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ model_id: modelId }),
  })
}

/**
 * 发送消息（非流式），整包返回助手回复；也作为流式降级路径。
 * 错误码：400 未指定模型 / 402 点数不足 / 502 上游模型失败。
 */
export async function sendMessage(
  conversationId: string,
  content: string,
  modelId?: string,
  signal?: AbortSignal,
  fileRefs?: string[],
): Promise<ChatMessage> {
  return apiFetch(`/v1/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      model_id: modelId,
      stream: false,
      file_refs: fileRefs && fileRefs.length > 0 ? fileRefs : undefined,
    }),
    signal,
  })
}

/**
 * 发送消息（流式 SSE），逐块回调累积内容，完成后返回最终 ChatMessage。
 *
 * 降级策略：若后端不支持流式（返回 JSON 而非 text/event-stream），
 * 或发生连接错误，调用方可捕获异常并 fallback 到 sendMessage。
 *
 * SSE 格式（OpenAI 兼容）：
 *   data: {"choices":[{"delta":{"content":"部分文本"}}]}
 *   data: [DONE]
 *   data: {"id":123,"role":"assistant","cost":"0.03",...}  — 最终完整响应
 */
export async function sendMessageStream(
  conversationId: string,
  content: string,
  modelId: string | undefined,
  signal: AbortSignal | undefined,
  fileRefs: string[] | undefined,
  onDelta: (cumulative: string) => void,
  onStatus?: (status: StreamStatus) => void,
): Promise<ChatMessage> {
  const token = getToken()
  const res = await fetch(`${API_BASE}/v1/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      content,
      model_id: modelId,
      stream: true,
      file_refs: fileRefs && fileRefs.length > 0 ? fileRefs : undefined,
    }),
    signal,
  })

  if (res.status === 401) {
    logout()
    throw new ApiError(401, '登录已过期')
  }

  // 非流式降级：后端返回 JSON 而非 SSE
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) {
    if (!res.ok) {
      const data = await res.json().catch(() => ({} as { detail?: string }))
      throw new ApiError(res.status, (data as { detail?: string }).detail || `请求失败 (${res.status})`)
    }
    return (await res.json()) as ChatMessage
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  let finalResult: ChatMessage | null = null
  let hasContent = false
  let hasToolCall = false
  let lastToolName = ''

  // 初始状态：思考中
  onStatus?.({ phase: 'thinking' })

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
          const parsed = JSON.parse(data) as Record<string, unknown>
          const choices = parsed.choices as { delta?: Record<string, unknown> }[] | undefined
          const delta = choices?.[0]?.delta

          if (delta) {
            // 检测 tool_calls（OpenAI 兼容格式）
            const toolCalls = delta.tool_calls as { function?: { name?: string } }[] | undefined
            if (toolCalls && toolCalls.length > 0) {
              const name = toolCalls[0]?.function?.name
              if (name && name !== lastToolName) {
                lastToolName = name
                hasToolCall = true
                onStatus?.({ phase: 'tool_call', name })
              }
            }

            // 检测内容 delta
            const deltaContent = delta.content as string | undefined
            if (deltaContent) {
              if (!hasContent && !hasToolCall) {
                // 首次收到内容，切换到生成阶段
                hasContent = true
                onStatus?.({ phase: 'generating' })
              } else if (!hasContent && hasToolCall) {
                // 工具调用后开始生成内容
                hasContent = true
                onStatus?.({ phase: 'generating' })
              }
              fullContent += deltaContent
              onDelta(fullContent)
            }
          }

          // 最终完整响应（含 id / cost / references）
          if (parsed.id !== undefined && typeof parsed.role === 'string') {
            finalResult = parsed as unknown as ChatMessage
          }
        } catch {
          /* 非 JSON 行，忽略 */
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (finalResult) {
    if (fullContent.length > (finalResult.content?.length ?? 0)) {
      finalResult.content = fullContent
    }
    return finalResult
  }

  return { id: Date.now(), role: 'assistant' as const, content: fullContent, created_at: new Date().toISOString() }
}
