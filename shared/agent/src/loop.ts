/**
 * Agent 循环引擎
 *
 * 对应 docs/设计-前端AgentLoop架构.md §3.4。
 * 核心就是一个 while 循环：LLM → 检测 tool_calls → 执行工具 → 结果回灌 → 再来。
 * 模型自己决定何时停止（不再返回 tool_calls），maxTurns 仅作防死循环安全阀。
 *
 * 阶段四增强：
 * - 并行执行：连续的 parallelSafe 工具并发执行，场景工具保持串行
 * - 工具韧性：单工具 30s 超时；网络类错误自动重试一次
 * - LLM 韧性：单次调用 60s 超时；流式失败（未产出内容时）自动降级非流式重试一次
 * - 结果截断：按工具 maxResultChars 截断回灌内容，防上下文爆炸
 *
 * 上下文管理：每轮调 LLM 前检查估算 token，超过预算 80% 时先做一次
 * LLM 摘要压缩（见 compress.ts）；压缩结果通过 reply.compression 带回，
 * 调用方持久化后下次发送传入 priorSummary，避免重复压缩。
 */

import { compressIfNeeded, SUMMARY_PREFIX } from './compress'
import { ContextManager } from './context'
import { llmChat, type LLMResponse } from './llm'
import { ToolRegistry } from './tools'
import type {
  AgentConfig,
  AgentEvent,
  AgentReply,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from './types'

export interface RunAgentOptions {
  /** 本轮用户输入（追加到 history 之后） */
  userInput: string
  /** 中断信号（UI 停止按钮） */
  signal?: AbortSignal
}

/** 触发压缩的阈值比例（与 compress.ts 内部一致，用于预判是否要发事件） */
const COMPRESS_TRIGGER = 0.8
/** 单工具执行超时 */
const TOOL_TIMEOUT_MS = 30000
/** 单次 LLM 调用超时 */
const LLM_TIMEOUT_MS = 60000
/** 重试前等待 */
const RETRY_DELAY_MS = 800
/** 工具结果回灌的默认最大字符数 */
const DEFAULT_MAX_RESULT_CHARS = 4000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 网络类错误（fetch 失败 / 5xx / 超时）可重试；4xx 业务错误不重试 */
function isRetriableError(err: unknown): boolean {
  if (err instanceof TypeError) return true // fetch 网络失败
  const msg = err instanceof Error ? err.message : String(err)
  if (/\(5\d\d\)/.test(msg)) return true // llmChat 抛错会附带状态码
  return /failed to fetch|network|超时/i.test(msg)
}

/** 组合信号：用户中断或超时都会 abort；didTimeout 区分是哪种 */
function combinedSignal(
  outer: AbortSignal | undefined,
  ms: number,
): { signal: AbortSignal; didTimeout: () => boolean; clear: () => void } {
  const ctrl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ctrl.abort()
  }, ms)
  const onOuterAbort = () => ctrl.abort()
  if (outer?.aborted) ctrl.abort()
  else outer?.addEventListener('abort', onOuterAbort)
  return {
    signal: ctrl.signal,
    didTimeout: () => timedOut,
    clear: () => {
      clearTimeout(timer)
      outer?.removeEventListener('abort', onOuterAbort)
    },
  }
}

/**
 * 运行 Agent Loop，返回最终回复。
 * 全过程通过 onEvent 推送事件给 UI（thinking / text_delta / tool_call_* / done / error）。
 */
export async function runAgent(
  config: AgentConfig,
  tools: ToolDefinition[],
  onEvent: (event: AgentEvent) => void,
  options: RunAgentOptions,
): Promise<AgentReply> {
  const maxTurns = config.maxTurns ?? 20
  const maxContextTokens = config.maxContextTokens ?? 120000
  const registry = new ToolRegistry()
  registry.registerAll(tools)
  const toolsParam = registry.getToolsParam()

  // 组装消息列表：system + 上轮摘要 + 历史 + 本轮用户输入；ContextManager 负责兜底裁剪
  const context = new ContextManager(maxContextTokens)
  context.push({ role: 'system', content: config.systemPrompt })
  if (config.priorSummary) {
    context.push({ role: 'user', content: `${SUMMARY_PREFIX}\n${config.priorSummary}` })
  }
  context.pushAll(config.history)
  context.push({ role: 'user', content: options.userInput })

  // 摘要压缩：用同一个模型做压缩（非流式一次性调用）
  const summarize = async (prompt: string): Promise<string> => {
    const res = await llmChat({
      model: config.modelId,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      signal: options.signal,
    })
    return res.content
  }

  // 压缩记账：coveredHistoryCount 统计有多少条 config.history 被折叠进摘要，
  // 供调用方持久化摘要并跳过已覆盖历史；loop 内部产生的消息不计入。
  let summaryPresent = Boolean(config.priorSummary)
  let historyRemaining = config.history.length
  let coveredHistoryCount = 0
  let lastSummary: string | undefined

  /** 每轮 LLM 调用前检查并执行压缩；压缩后仍超 90% 时硬裁剪兜底 */
  const compressContextIfNeeded = async (): Promise<void> => {
    if (context.estimateTokens() > maxContextTokens * COMPRESS_TRIGGER) {
      onEvent({ type: 'context_compressing' })
      const outcome = await compressIfNeeded(
        context.getMessages(),
        maxContextTokens,
        summarize,
      )
      if (outcome.compressed) {
        // 折叠从头部开始：先吃掉旧摘要消息，再依次覆盖 history 条目
        const foldedHistory = Math.min(
          Math.max(outcome.foldedCount - (summaryPresent ? 1 : 0), 0),
          historyRemaining,
        )
        coveredHistoryCount += foldedHistory
        historyRemaining -= foldedHistory
        summaryPresent = true
        lastSummary = outcome.summary
        context.replaceAll(outcome.messages)
        onEvent({
          type: 'context_compressed',
          foldedCount: outcome.foldedCount,
          summary: outcome.summary!,
        })
      }
    }
    // 压缩未触发/失败/仍超限 → 硬裁剪兜底
    context.trimNow()
  }

  let fullContent = ''

  /**
   * 调 LLM：60s 超时；流式失败且尚未产出内容时，降级为非流式重试一次。
   * 用户中断（AbortError 且外层 signal 已 abort）直接抛出。
   */
  const chatWithFallback = async (): Promise<LLMResponse> => {
    const onDelta = (text: string) => {
      fullContent += text
      onEvent({ type: 'text_delta', text })
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const stream = attempt === 0
      const combined = combinedSignal(options.signal, LLM_TIMEOUT_MS)
      const contentBefore = fullContent.length
      try {
        return await llmChat({
          model: config.modelId,
          messages: context.getMessages(),
          tools: toolsParam,
          stream,
          temperature: config.temperature,
          signal: combined.signal,
          onDelta,
        })
      } catch (err) {
        // 用户手动停止：不重试，直接抛出
        if (options.signal?.aborted) throw err
        const timedOut =
          err instanceof DOMException && err.name === 'AbortError' && combined.didTimeout()
        // 超时 / 网络 / 5xx 且本次未产出内容 → 降级重试一次
        const nothingStreamed = fullContent.length === contentBefore
        if (attempt === 0 && nothingStreamed && (timedOut || isRetriableError(err))) {
          onEvent({
            type: 'retrying',
            reason: timedOut ? '响应超时，正在重试' : '请求失败，正在重试',
          })
          await sleep(RETRY_DELAY_MS)
          continue
        }
        if (timedOut) throw new Error('LLM 响应超时（60 秒），请稍后重试')
        throw err
      } finally {
        combined.clear()
      }
    }
    throw new Error('LLM 请求失败')
  }

  /** 执行单个工具：30s 超时 + 网络类错误重试一次 + 结果按 maxResultChars 截断 */
  const executeTool = async (name: string, args: Record<string, unknown>): Promise<ToolResult> => {
    const maxChars = registry.get(name)?.maxResultChars ?? DEFAULT_MAX_RESULT_CHARS
    const attempt = (): Promise<ToolResult> =>
      Promise.race([
        registry.execute(name, args),
        sleep(TOOL_TIMEOUT_MS).then((): ToolResult => {
          throw new Error('TOOL_TIMEOUT')
        }),
      ])
    let result: ToolResult
    try {
      result = await attempt()
    } catch (err) {
      if (err instanceof Error && err.message === 'TOOL_TIMEOUT') {
        result = {
          success: false,
          content: `工具执行超时（${TOOL_TIMEOUT_MS / 1000} 秒）`,
          error: 'timeout',
        }
      } else if (isRetriableError(err)) {
        // 网络类错误重试一次
        await sleep(RETRY_DELAY_MS)
        try {
          result = await attempt()
        } catch (retryErr) {
          result = {
            success: false,
            content: `工具执行失败: ${retryErr instanceof Error ? retryErr.message : '未知错误'}`,
            error: String(retryErr),
          }
        }
      } else {
        result = {
          success: false,
          content: `工具执行失败: ${err instanceof Error ? err.message : '未知错误'}`,
          error: String(err),
        }
      }
    }
    // 回灌前截断，防上下文爆炸
    if (result.content.length > maxChars) {
      result = {
        ...result,
        content: `${result.content.slice(0, maxChars)}\n...（结果过长已截断）`,
      }
    }
    return result
  }

  /** 解析工具参数（JSON 损坏时按空参数执行，让工具返回有意义的错误） */
  const parseArgs = (call: ToolCall): Record<string, unknown> => {
    try {
      return JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
    } catch {
      return {}
    }
  }

  /**
   * 执行一轮 tool_calls：连续的 parallelSafe 工具并发执行（查询类），
   * 其余保持声明顺序串行（场景操作有顺序依赖）。
   */
  const executeToolCalls = async (calls: ToolCall[]): Promise<void> => {
    let i = 0
    while (i < calls.length) {
      const call = calls[i]
      const argsList = [parseArgs(call)]
      onEvent({ type: 'tool_call_start', name: call.function.name, args: argsList[0] })

      if (registry.get(call.function.name)?.parallelSafe) {
        // 收集连续的并行安全调用，一起并发
        const group: ToolCall[] = [call]
        while (
          i + 1 < calls.length &&
          registry.get(calls[i + 1].function.name)?.parallelSafe
        ) {
          const next = calls[++i]
          const args = parseArgs(next)
          group.push(next)
          argsList.push(args)
          onEvent({ type: 'tool_call_start', name: next.function.name, args })
        }
        const results = await Promise.all(
          group.map((c, k) => executeTool(c.function.name, argsList[k])),
        )
        for (let k = 0; k < group.length; k++) {
          onEvent({ type: 'tool_call_result', name: group[k].function.name, result: results[k] })
          context.push({
            role: 'tool',
            tool_call_id: group[k].id,
            content: results[k].content,
          })
        }
      } else {
        // 串行执行（场景操作等）
        const result = await executeTool(call.function.name, argsList[0])
        onEvent({ type: 'tool_call_result', name: call.function.name, result })
        context.push({ role: 'tool', tool_call_id: call.id, content: result.content })
      }
      i++
    }
  }

  const buildReply = (content: string, turns: number): AgentReply => ({
    role: 'assistant',
    content,
    turns,
    compression:
      coveredHistoryCount > 0 || lastSummary
        ? { summary: lastSummary!, coveredHistoryCount }
        : undefined,
  })

  let turn = 0

  try {
    for (; turn < maxTurns; turn++) {
      // 上下文超限 → 先摘要压缩（含工具结果回灌后的增长）
      await compressContextIfNeeded()

      onEvent({ type: 'thinking' })

      // 调 LLM（流式，失败自动降级重试）
      const response = await chatWithFallback()

      // 没有 tool_calls → 模型自己判断完成了
      if (!response.tool_calls || response.tool_calls.length === 0) {
        const reply = buildReply(fullContent || response.content, turn + 1)
        onEvent({ type: 'done', reply })
        return reply
      }

      // 有 tool_calls → 先把 assistant 的 tool_calls 消息加入历史
      context.push({
        role: 'assistant',
        content: response.content || null,
        tool_calls: response.tool_calls,
      })

      // 执行工具（并行安全分组并发，其余串行），结果回灌
      await executeToolCalls(response.tool_calls)

      onEvent({ type: 'turn_end', turn: turn + 1 })
      fullContent = '' // 重置，下一轮的文本是新的
    }

    // 达到最大轮次（安全阀触发）
    const reply = buildReply(
      fullContent || '（已达到最大推理轮次，请尝试简化问题或换个问法）',
      maxTurns,
    )
    onEvent({ type: 'done', reply })
    return reply
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // 用户手动停止：已有内容照常返回
      const reply = buildReply(fullContent, turn + 1)
      onEvent({ type: 'done', reply })
      return reply
    }
    const message = err instanceof Error ? err.message : '未知错误'
    onEvent({ type: 'error', error: message })
    throw err
  }
}
