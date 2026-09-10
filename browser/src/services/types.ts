/**
 * 后端接口类型定义
 *
 * 字段与 server/docs/API 接口文档.md（v2.3）对齐。
 */

/** 会话（6.1/6.2，v2.3 新增 conversation_type + scenario 字段） */
export interface Conversation {
  id: string
  title: string
  model_id: string | null
  status: 'active' | 'deleted'
  message_count: number
  /** general（通用对话，默认）/ professional（专业模式） */
  conversation_type?: string
  /** 专业模式场景 key（orbit/coordinate/visibility/remote_sensing 等） */
  scenario?: string
  created_at: string
  updated_at: string
}

export interface ConversationListResponse {
  conversations: Conversation[]
  total: number
}

/** 消息引用来源（6.6 references 单条） */
export interface MessageReference {
  kb_name: string
  filename: string
}

/** 消息（6.3 详情内嵌 / 6.6 响应） */
export interface ChatMessage {
  id: number
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  model?: string
  input_tokens?: number
  output_tokens?: number
  cost?: string // 点数，2 位小数字符串
  references?: MessageReference[]
  created_at: string
}

/** 会话详情（6.3） */
export interface ConversationDetail extends Conversation {
  messages: ChatMessage[]
  knowledge_ids: string[]
  skill_ids: string[]
}

/** 可用模型（7.1，用户侧接口） */
export interface ModelInfo {
  model_id: string
  display_name: string
  description?: string
  provider_name: string
  max_tokens: number
  max_output_tokens: number
  input_price: number // 点/1K tokens
  output_price: number
  supports_stream: boolean
  supports_vision: boolean
  supports_function: boolean
  /** 默认模型标记：Auto 选项不传 model_id 时后端使用默认模型 */
  is_default?: boolean
}

/** 可用知识库（7.1） */
export interface KnowledgeBaseInfo {
  id: string
  name: string
  display_name: string
  description: string
  kb_type: string
  file_count: number
}

/** 可用技能（7.2） */
export interface SkillInfo {
  id: string
  name: string
  display_name: string
  description: string
  skill_type: string
}

/** 可用场景（6.0，专业模式创建对话时选择） */
export interface ScenarioInfo {
  key: string
  name: string
  description: string
}

/** 知识库文件项（9.6 目录索引内嵌） */
export interface KnowledgeFileItem {
  id: number
  filename: string
  summary: string
  tags: string[]
  file_size: number
}

/** 知识库目录索引（9.6） */
export interface KnowledgeIndex {
  kb_name: string
  display_name: string
  files: KnowledgeFileItem[]
  total: number
}

/**
 * 过滤掉工具调用相关消息，只保留用户可见的消息。
 * 后端在调用技能/知识库等 tool 时会插入 role='tool' 的消息，
 * 这些不应展示给用户。
 */
export function filterDisplayMessages<T extends ChatMessage>(messages: T[]): T[] {
  return messages.filter(
    (m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system',
  )
}

/** 一次工具调用记录（Agent Loop 产生，UI 展示 + 本地持久化用） */
export interface ToolCallRecord {
  name: string
  args: Record<string, unknown>
  /** 所属轮次（多轮循环时分组展示） */
  turn?: number
  /** 执行结果是否成功（undefined 表示还在执行中） */
  success?: boolean
  /** 结果摘要（截断后的 content 前 120 字符） */
  summary?: string
  /** 结果内容（截断 2000 字符，展开卡片时展示） */
  result?: string
  /** 失败原因 */
  error?: string
}

/** 聊天区展示用消息（服务端消息 + 客户端附加的展示字段） */
export interface DisplayMessage extends ChatMessage {
  /** 用户上传的附件文件名（本地展示用） */
  attachmentNames?: string[]
  /** 引用的知识库文件名（本地展示用） */
  refFileNames?: string[]
  /** 本轮回复中使用过的工具调用记录 */
  toolCalls?: ToolCallRecord[]
}

/** 点数余额（4.1） */
export interface Balance {
  points: string // 总余额，2 位小数，直接展示
  points_raw: number // 千分点整数
  daily_points: string
  recharge_points: string
  daily_limit: string
  reset_at: string // UTC 朴素串
  role: string
}
