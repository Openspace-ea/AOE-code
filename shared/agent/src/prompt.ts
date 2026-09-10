/**
 * System Prompt 组装
 *
 * 对应 docs/设计-前端AgentLoop架构.md §五。
 * 前端接管 Agent Loop 后，由调用方提供各层内容，本模块负责拼装。
 */

/** 身份与规则层（固定） */
export const IDENTITY_PROMPT = `你是 AOE Code Agent，一个专业的航天分析助手。

## 工具使用规则
- 你可以使用工具来获取信息和执行操作
- 当用户的问题需要查阅资料时，主动使用 search_knowledge 搜索
- 当用户要求操作场景时，使用对应的场景操作工具
- 工具执行结果会自动提供给你，基于结果继续分析
- 如果一次工具调用的信息不够，可以继续调用其他工具
- 当你有足够信息回答用户时，直接给出最终回答，不要再调用工具

## 回答风格
- 使用简体中文
- 回答要专业、准确、简洁
- 引用知识库内容时标注来源（知识库名/文件名）`

export interface PromptLayers {
  /** 身份与规则（默认 IDENTITY_PROMPT） */
  identity?: string
  /** 场景指令（专业模式时注入） */
  scenario?: string
  /** 知识库目录索引（创建会话时关联的知识库，文件名 + 摘要） */
  knowledgeIndex?: string
  /** 技能描述（创建会话时关联的技能） */
  skillDescriptions?: string
  /** file_refs 全文（用户引用的文件） */
  fileRefs?: string
  /** 场景状态（专业模式实时状态摘要） */
  sceneContext?: string
}

/** 拼装 system prompt：各层之间用分隔线隔开 */
export function buildSystemPrompt(layers: PromptLayers): string {
  const parts = [layers.identity ?? IDENTITY_PROMPT]
  if (layers.scenario) parts.push(layers.scenario)
  if (layers.knowledgeIndex) parts.push(layers.knowledgeIndex)
  if (layers.skillDescriptions) parts.push(layers.skillDescriptions)
  if (layers.fileRefs) parts.push(layers.fileRefs)
  if (layers.sceneContext) parts.push(layers.sceneContext)
  return parts.join('\n\n---\n\n')
}
