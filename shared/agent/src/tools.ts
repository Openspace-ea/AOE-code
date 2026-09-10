/**
 * 工具注册表 + 内置工具
 *
 * 对应 docs/设计-前端AgentLoop架构.md §3.5 / §4。
 * - ToolRegistry：注册工具、生成 OpenAI tools 参数、按名执行
 * - 内置工具：知识库搜索（GET /v1/knowledge/search）
 * - 第三方工具：GET /v1/tools/available 拉取定义，POST /v1/tools/call 执行
 */

import { getAgentRuntime } from './config'
import type { OpenAITool, ToolDefinition, ToolResult } from './types'

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
  }

  registerAll(tools: ToolDefinition[]): void {
    for (const t of tools) this.register(t)
  }

  /** 获取 OpenAI function calling 格式的 tools 参数 */
  getToolsParam(): OpenAITool[] {
    return Array.from(this.tools.values()).map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { success: false, content: `未知工具: ${name}`, error: `未知工具: ${name}` }
    }
    return tool.execute(args)
  }

  /** 按名取工具定义（并行分组与结果截断用） */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  unregister(name: string): void {
    this.tools.delete(name)
  }

  clear(): void {
    this.tools.clear()
  }
}

// ============ 内置工具：知识库搜索 ============

interface KnowledgeSearchResultItem {
  kb_name: string
  filename: string
  excerpt: string
  score: number
}

/**
 * 知识库搜索工具（source: knowledge，走后端 SQL 模糊匹配，当前免费）。
 * 返回简洁摘要给 LLM，结构化结果放 data 供 UI 展示。
 */
export function createKnowledgeSearchTool(): ToolDefinition {
  return {
    name: 'search_knowledge',
    description:
      '搜索知识库中的资料。当用户的问题可能涉及专业知识、内部文档或知识库内容时主动使用。返回匹配文件的摘要片段与来源。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词，用简洁的短语，如「TLE 格式」' },
        limit: { type: 'number', description: '返回数量，默认 5，最大 20' },
      },
      required: ['query'],
    },
    source: 'knowledge',
    parallelSafe: true, // 只读查询，可与其他查询并行
    maxResultChars: 8000, // 摘要片段是回答依据，放宽截断
    execute: async (args): Promise<ToolResult> => {
      const { apiBase, getToken } = getAgentRuntime()
      const query = String(args.query ?? '').trim()
      if (!query) {
        return { success: false, content: '缺少搜索关键词', error: 'query 为空' }
      }
      const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 20)
      const token = getToken()
      const res = await fetch(
        `${apiBase}/v1/knowledge/search?q=${encodeURIComponent(query)}&limit=${limit}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string }
        return {
          success: false,
          content: `知识库搜索失败: ${data.detail || res.status}`,
          error: data.detail || `HTTP ${res.status}`,
        }
      }
      const data = (await res.json()) as {
        results: KnowledgeSearchResultItem[]
        total: number
      }
      if (!data.results || data.results.length === 0) {
        return { success: true, content: `没有找到与「${query}」相关的知识库内容。`, data: { results: [] } }
      }
      const lines = data.results.map(
        (r, i) => `${i + 1}. [${r.kb_name}/${r.filename}] ${r.excerpt}`,
      )
      return {
        success: true,
        content: `找到 ${data.results.length} 条相关结果：\n${lines.join('\n')}`,
        data: { results: data.results },
      }
    },
  }
}

// ============ 第三方工具（后端 /v1/tools/*） ============

/** 后端返回的可用工具定义（OpenAI 格式） */
export interface AvailableTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/** 拉取后端可用第三方工具列表（GET /v1/tools/available） */
export async function fetchAvailableTools(): Promise<AvailableTool[]> {
  const { apiBase, getToken } = getAgentRuntime()
  const token = getToken()
  const res = await fetch(`${apiBase}/v1/tools/available`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) return []
  return (await res.json()) as AvailableTool[]
}

/**
 * 把一个后端第三方工具包装成 ToolDefinition（source: api）。
 * 执行时走 POST /v1/tools/call，计费由后端按 per_call_price 处理。
 */
export function createThirdPartyTool(available: AvailableTool): ToolDefinition {
  const fn = available.function
  return {
    name: fn.name,
    description: fn.description,
    parameters: fn.parameters,
    source: 'api',
    parallelSafe: true, // 远端 API 查询，默认可并行
    execute: async (args): Promise<ToolResult> => {
      const { apiBase, getToken } = getAgentRuntime()
      const token = getToken()
      const res = await fetch(`${apiBase}/v1/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ function_name: fn.name, arguments: args }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string }
        return {
          success: false,
          content: `工具调用失败: ${data.detail || res.status}`,
          error: data.detail || `HTTP ${res.status}`,
        }
      }
      const data = (await res.json()) as {
        success: boolean
        data?: unknown
        error?: string
        cost?: number
      }
      if (!data.success) {
        return {
          success: false,
          content: `工具返回失败: ${data.error || '未知原因'}`,
          error: data.error,
        }
      }
      // 结果序列化（回灌 LLM 前的截断由 loop 按 maxResultChars 统一处理）
      const text = JSON.stringify(data.data ?? null, null, 1)
      return { success: true, content: text, data: data.data }
    },
  }
}
