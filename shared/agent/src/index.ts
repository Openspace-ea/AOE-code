/**
 * @aoe/agent — AOE Code Agent 核心逻辑（三端共享）
 *
 * 用法：
 *   1. 应用启动时 initAgentRuntime({ apiBase, getToken, onUnauthorized })
 *   2. 组装 system prompt：buildSystemPrompt({ ... })
 *   3. 准备工具：[createKnowledgeSearchTool(), ...场景工具]
 *   4. runAgent(config, tools, onEvent, { userInput, signal })
 */

export * from './types'
export * from './config'
export * from './llm'
export * from './tools'
export * from './context'
export * from './compress'
export * from './prompt'
export * from './loop'
