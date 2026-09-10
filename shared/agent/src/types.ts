/**
 * @aoe/agent 共享类型定义
 *
 * 对应 docs/设计-前端AgentLoop架构.md §3.3。
 * 本包不含任何 UI 逻辑，由三端（browser/cli/desktop）注入运行时配置后使用。
 */

/** LLM 消息（OpenAI 兼容格式） */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  /** assistant 发起工具调用时可为 null */
  content: string | null
  /** assistant 消息携带的工具调用列表 */
  tool_calls?: ToolCall[]
  /** role=tool 时必须，对应 ToolCall.id */
  tool_call_id?: string
}

/** OpenAI function calling 的工具调用 */
export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    /** JSON 字符串（流式中分片到达，需累积后 parse） */
    arguments: string
  }
}

/** 传给 LLM 的 tools 参数项（OpenAI 格式） */
export interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/** Agent Loop 配置 */
export interface AgentConfig {
  /** 模型 ID（必填，由调用方解析 Auto 规则后传入） */
  modelId: string
  /** system prompt（由调用方组装，含场景注入） */
  systemPrompt: string
  /** 历史消息（不含本轮用户输入——用户输入通过 run 的 userInput 传入） */
  history: LLMMessage[]
  /** 上次压缩留下的早期对话摘要（注入到 system 之后、history 之前） */
  priorSummary?: string
  /** 最大循环轮次（默认 20，防死循环安全阀，不是智能上限） */
  maxTurns?: number
  /** 温度等模型参数 */
  temperature?: number
  /**
   * 上下文 token 预算（默认 120000）。
   * 调用方应按所选模型的上下文窗口推导（窗口 - 输出预留），
   * 超过 80% 时自动 LLM 摘要压缩，超过 90% 硬裁剪兜底。
   */
  maxContextTokens?: number
}

/** 工具来源标识（UI 展示区分用） */
export type ToolSource = 'knowledge' | 'skill' | 'scene' | 'api' | 'custom'

/** 工具定义（注册到 ToolRegistry） */
export interface ToolDefinition {
  /** 工具名称（OpenAI function calling 格式） */
  name: string
  /** 工具描述（注入 LLM，告诉模型什么时候用、怎么用） */
  description: string
  /** 参数 JSON Schema */
  parameters: Record<string, unknown>
  /** 执行函数 */
  execute: (args: Record<string, unknown>) => Promise<ToolResult>
  /** 工具来源标识 */
  source: ToolSource
  /**
   * 是否可与其他并行安全工具并发执行（默认 false 串行）。
   * 只读类工具（搜索/查询）标 true；有顺序依赖或改场景状态的保持串行。
   */
  parallelSafe?: boolean
  /** 结果回灌给 LLM 前的最大字符数（默认 4000，超出截断） */
  maxResultChars?: number
}

/** 工具执行结果 */
export interface ToolResult {
  /** 是否成功 */
  success: boolean
  /** 结果内容（回灌给 LLM 的文本，要简洁有用） */
  content: string
  /** 结构化数据（供 UI 展示用，不回灌 LLM） */
  data?: unknown
  /** 错误信息 */
  error?: string
}

/** Agent Loop 事件（推送到 UI） */
export type AgentEvent =
  | { type: 'thinking' } // 等待 LLM 首 token
  | { type: 'text_delta'; text: string } // 流式文本增量
  | { type: 'tool_call_start'; name: string; args: Record<string, unknown> } // 工具调用开始
  | { type: 'tool_call_result'; name: string; result: ToolResult } // 工具调用结果
  | { type: 'context_compressing' } // 上下文超限，正在生成摘要
  | { type: 'context_compressed'; foldedCount: number; summary: string } // 压缩完成
  | { type: 'retrying'; reason: string } // LLM 请求失败/超时，自动降级重试
  | { type: 'turn_end'; turn: number } // 一轮结束
  | { type: 'done'; reply: AgentReply } // 最终回复
  | { type: 'error'; error: string } // 错误

/** Agent 最终回复 */
export interface AgentReply {
  role: 'assistant'
  content: string
  /** 实际运行的轮次 */
  turns: number
  /**
   * 本轮发生过的最后一次上下文压缩（若有）。
   * coveredHistoryCount 表示有多少条调用方传入的 history 被折叠进摘要，
   * 调用方据此持久化摘要并在下次发送时跳过已覆盖的历史。
   */
  compression?: { summary: string; coveredHistoryCount: number }
}
