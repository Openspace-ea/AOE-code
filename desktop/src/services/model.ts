/**
 * AI 模型服务
 */

import api from './api'

export interface ModelProvider {
  id: number
  name: string
  display_name: string
  base_url: string
  is_enabled: boolean
}

export interface ModelConfig {
  id: number
  provider_id: number
  model_id: string
  display_name: string
  description?: string
  max_tokens: number
  input_price: number
  output_price: number
  supports_stream: boolean
  supports_vision: boolean
  supports_function: boolean
  is_enabled: boolean
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface Tool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: Record<string, any>
  }
}

export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  top_p?: number
  max_tokens?: number
  stream?: boolean
  stop?: string[]
  tools?: Tool[]
  tool_choice?: string | { type: string, function?: { name: string } }
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    message: ChatMessage
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  cost?: number
}

export const modelService = {
  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<ModelConfig[]> {
    const result = await api.getModels()
    if (result.success) {
      return (result.data as any).models || []
    }
    throw new Error(result.error)
  },

  /**
   * 调用模型（聊天完成）
   */
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const result = await api.chatCompletion(request.model, request.messages, request.tools)
    if (result.success) {
      return result.data as ChatCompletionResponse
    }
    throw new Error(result.error)
  },

  /**
   * 简单对话（无工具）
   */
  async chat(model: string, message: string, systemPrompt?: string): Promise<string> {
    const messages: ChatMessage[] = []
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: message })

    const response = await this.chatCompletion({ model, messages })
    return response.choices[0]?.message?.content || ''
  },

  /**
   * 带工具调用的对话
   */
  async chatWithTools(
    model: string,
    messages: ChatMessage[],
    tools: Tool[]
  ): Promise<ChatCompletionResponse> {
    return this.chatCompletion({ model, messages, tools })
  },

  /**
   * 计算预估费用
   */
  estimateCost(model: ModelConfig, inputTokens: number, outputTokens: number): number {
    return (inputTokens * model.input_price + outputTokens * model.output_price) / 1000
  }
}

export default modelService