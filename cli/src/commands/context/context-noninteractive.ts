import { feature } from 'bun:bundle'
import { microcompactMessages } from '../../services/compact/microCompact.js'
import type { AppState } from '../../state/AppStateStore.js'
import type { Tools, ToolUseContext } from '../../Tool.js'
import type { AgentDefinitionsResult } from '../../tools/AgentTool/loadAgentsDir.js'
import type { Message } from '../../types/message.js'
import {
  analyzeContextUsage,
  type ContextData,
} from '../../utils/analyzeContext.js'
import { formatTokens } from '../../utils/format.js'
import { getMessagesAfterCompactBoundary } from '../../utils/messages.js'
import { getSourceDisplayName } from '../../utils/settings/constants.js'
import { plural } from '../../utils/stringUtils.js'

/**
 * Shared data-collection path for `/context` (slash command) and the SDK
 * `get_context_usage` control request. Mirrors query.ts's pre-API transforms
 * (compact boundary, projectView, microcompact) so the token count reflects
 * what the model actually sees.
 */
type CollectContextDataInput = {
  messages: Message[]
  getAppState: () => AppState
  options: {
    mainLoopModel: string
    tools: Tools
    agentDefinitions: AgentDefinitionsResult
    customSystemPrompt?: string
    appendSystemPrompt?: string
  }
}

export async function collectContextData(
  context: CollectContextDataInput,
): Promise<ContextData> {
  const {
    messages,
    getAppState,
    options: {
      mainLoopModel,
      tools,
      agentDefinitions,
      customSystemPrompt,
      appendSystemPrompt,
    },
  } = context

  let apiView = getMessagesAfterCompactBoundary(messages)
  if (feature('CONTEXT_COLLAPSE')) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { projectView } =
      require('../../services/contextCollapse/operations.js') as typeof import('../../services/contextCollapse/operations.js')
    /* eslint-enable @typescript-eslint/no-require-imports */
    apiView = projectView(apiView)
  }

  const { messages: compactedMessages } = await microcompactMessages(apiView)
  const appState = getAppState()

  return analyzeContextUsage(
    compactedMessages,
    mainLoopModel,
    async () => appState.toolPermissionContext,
    tools,
    agentDefinitions,
    undefined, // terminalWidth
    // analyzeContextUsage only reads options.{customSystemPrompt,appendSystemPrompt}
    // but its signature declares the full Pick<ToolUseContext, 'options'>.
    { options: { customSystemPrompt, appendSystemPrompt } } as Pick<
      ToolUseContext,
      'options'
    >,
    undefined, // mainThreadAgentDefinition
    apiView, // original messages for API usage extraction
  )
}

export async function call(
  _args: string,
  context: ToolUseContext,
): Promise<{ type: 'text'; value: string }> {
  const data = await collectContextData(context)
  return {
    type: 'text' as const,
    value: formatContextAsMarkdownTable(data),
  }
}

function formatContextAsMarkdownTable(data: ContextData): string {
  const {
    categories,
    totalTokens,
    rawMaxTokens,
    percentage,
    model,
    memoryFiles,
    mcpTools,
    agents,
    skills,
    messageBreakdown,
    systemTools,
    systemPromptSections,
  } = data

  let output = `## 上下文用量\n\n`
  output += `**模型：** ${model}  \n`
  output += `**Token 数：** ${formatTokens(totalTokens)} / ${formatTokens(rawMaxTokens)} (${percentage}%)\n`

  // Context-collapse status. Always show when the runtime gate is on —
  // the user needs to know which strategy is managing their context
  // even before anything has fired.
  if (feature('CONTEXT_COLLAPSE')) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { getStats, isContextCollapseEnabled } =
      require('../../services/contextCollapse/index.js') as typeof import('../../services/contextCollapse/index.js')
    /* eslint-enable @typescript-eslint/no-require-imports */
    if (isContextCollapseEnabled()) {
      const s = getStats()
      const { health: h } = s

      const parts = []
      if (s.collapsedSpans > 0) {
        parts.push(
          `${s.collapsedSpans} 个跨度已总结（${s.collapsedMessages} 条消息）`,
        )
      }
      if (s.stagedSpans > 0) parts.push(`${s.stagedSpans} 个已暂存`)
      const summary =
        parts.length > 0
          ? parts.join('，')
          : h.totalSpawns > 0
            ? `${h.totalSpawns} 次生成，暂无暂存`
            : '等待首次触发'
      output += `**上下文策略：** 折叠（${summary}）\n`

      if (h.totalErrors > 0) {
        output += `**折叠错误：** ${h.totalErrors}/${h.totalSpawns} 次生成失败`
        if (h.lastError) {
          output += `（最近：${h.lastError.slice(0, 80)}）`
        }
        output += '\n'
      } else if (h.emptySpawnWarningEmitted) {
        output += `**折叠空闲：** ${h.totalEmptySpawns} 次连续空运行\n`
      }
    }
  }
  output += '\n'

  // Main categories table
  const visibleCategories = categories.filter(
    cat =>
      cat.tokens > 0 &&
      cat.name !== 'Free space' &&
      cat.name !== 'Autocompact buffer',
  )

  if (visibleCategories.length > 0) {
    output += `### 按类别估算用量\n\n`
    output += `| 类别 | Token 数 | 百分比 |\n`
    output += `|----------|--------|------------|\n`

    for (const cat of visibleCategories) {
      const percentDisplay = ((cat.tokens / rawMaxTokens) * 100).toFixed(1)
      output += `| ${cat.name} | ${formatTokens(cat.tokens)} | ${percentDisplay}% |\n`
    }

    const freeSpaceCategory = categories.find(c => c.name === 'Free space')
    if (freeSpaceCategory && freeSpaceCategory.tokens > 0) {
      const percentDisplay = (
        (freeSpaceCategory.tokens / rawMaxTokens) *
        100
      ).toFixed(1)
      output += `| 剩余空间 | ${formatTokens(freeSpaceCategory.tokens)} | ${percentDisplay}% |\n`
    }

    const autocompactCategory = categories.find(
      c => c.name === 'Autocompact buffer',
    )
    if (autocompactCategory && autocompactCategory.tokens > 0) {
      const percentDisplay = (
        (autocompactCategory.tokens / rawMaxTokens) *
        100
      ).toFixed(1)
      output += `| 自动压缩缓冲 | ${formatTokens(autocompactCategory.tokens)} | ${percentDisplay}% |\n`
    }

    output += `\n`
  }

  // MCP 工具
  if (mcpTools.length > 0) {
    output += `### MCP 工具\n\n`
    output += `| 工具 | 服务器 | Token 数 |\n`
    output += `|------|--------|--------|\n`
    for (const tool of mcpTools) {
      output += `| ${tool.name} | ${tool.serverName} | ${formatTokens(tool.tokens)} |\n`
    }
    output += `\n`
  }

  // 系统工具（仅限 ant）
  if (
    systemTools &&
    systemTools.length > 0 &&
    process.env.USER_TYPE === 'ant'
  ) {
    output += `### [仅限 ant] 系统工具\n\n`
    output += `| 工具 | Token 数 |\n`
    output += `|------|--------|\n`
    for (const tool of systemTools) {
      output += `| ${tool.name} | ${formatTokens(tool.tokens)} |\n`
    }
    output += `\n`
  }

  // 系统提示部分（仅限 ant）
  if (
    systemPromptSections &&
    systemPromptSections.length > 0 &&
    process.env.USER_TYPE === 'ant'
  ) {
    output += `### [仅限 ant] 系统提示部分\n\n`
    output += `| 部分 | Token 数 |\n`
    output += `|---------|--------|\n`
    for (const section of systemPromptSections) {
      output += `| ${section.name} | ${formatTokens(section.tokens)} |\n`
    }
    output += `\n`
  }

  // 自定义代理
  if (agents.length > 0) {
    output += `### 自定义代理\n\n`
    output += `| 代理类型 | 来源 | Token 数 |\n`
    output += `|------------|--------|--------|\n`
    for (const agent of agents) {
      let sourceDisplay: string
      switch (agent.source) {
        case 'projectSettings':
          sourceDisplay = '项目'
          break
        case 'userSettings':
          sourceDisplay = '用户'
          break
        case 'localSettings':
          sourceDisplay = '本地'
          break
        case 'flagSettings':
          sourceDisplay = '标志'
          break
        case 'policySettings':
          sourceDisplay = '策略'
          break
        case 'plugin':
          sourceDisplay = '插件'
          break
        case 'built-in':
          sourceDisplay = '内置'
          break
        default:
          sourceDisplay = String(agent.source)
      }
      output += `| ${agent.agentType} | ${sourceDisplay} | ${formatTokens(agent.tokens)} |\n`
    }
    output += `\n`
  }

  // 记忆文件
  if (memoryFiles.length > 0) {
    output += `### 记忆文件\n\n`
    output += `| 类型 | 路径 | Token 数 |\n`
    output += `|------|------|--------|\n`
    for (const file of memoryFiles) {
      output += `| ${file.type} | ${file.path} | ${formatTokens(file.tokens)} |\n`
    }
    output += `\n`
  }

  // 技能
  if (skills && skills.tokens > 0 && skills.skillFrontmatter.length > 0) {
    output += `### 技能\n\n`
    output += `| 技能 | 来源 | Token 数 |\n`
    output += `|-------|--------|--------|\n`
    for (const skill of skills.skillFrontmatter) {
      output += `| ${skill.name} | ${getSourceDisplayName(skill.source)} | ${formatTokens(skill.tokens)} |\n`
    }
    output += `\n`
  }

  // 消息分解（仅限 ant）
  if (messageBreakdown && process.env.USER_TYPE === 'ant') {
    output += `### [仅限 ant] 消息分解\n\n`
    output += `| 类别 | Token 数 |\n`
    output += `|----------|--------|\n`
    output += `| 工具调用 | ${formatTokens(messageBreakdown.toolCallTokens)} |\n`
    output += `| 工具结果 | ${formatTokens(messageBreakdown.toolResultTokens)} |\n`
    output += `| 附件 | ${formatTokens(messageBreakdown.attachmentTokens)} |\n`
    output += `| 助手消息（非工具） | ${formatTokens(messageBreakdown.assistantMessageTokens)} |\n`
    output += `| 用户消息（非工具结果） | ${formatTokens(messageBreakdown.userMessageTokens)} |\n`
    output += `\n`

    if (messageBreakdown.toolCallsByType.length > 0) {
      output += `#### 常用工具\n\n`
      output += `| 工具 | 调用 Token 数 | 结果 Token 数 |\n`
      output += `|------|-------------|---------------|\n`
      for (const tool of messageBreakdown.toolCallsByType) {
        output += `| ${tool.name} | ${formatTokens(tool.callTokens)} | ${formatTokens(tool.resultTokens)} |\n`
      }
      output += `\n`
    }

    if (messageBreakdown.attachmentsByType.length > 0) {
      output += `#### 常用附件\n\n`
      output += `| 附件 | Token 数 |\n`
      output += `|------------|--------|\n`
      for (const attachment of messageBreakdown.attachmentsByType) {
        output += `| ${attachment.name} | ${formatTokens(attachment.tokens)} |\n`
      }
      output += `\n`
    }
  }

  return output
}
