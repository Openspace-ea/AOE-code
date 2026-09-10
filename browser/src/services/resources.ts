/**
 * 资源服务：可用模型 / 知识库 / 技能（API 文档 v2.3 §七）
 *
 * 模型列表：GET /v1/resources/models（用户侧接口，v2.3 恢复）。
 * 列表按 is_default 降序，默认模型排第一；前端「Auto」选项 = 不传 model_id，
 * 后端自动使用默认模型（is_default: true）。
 */

import { apiFetch } from '../lib/api'
import type { KnowledgeBaseInfo, KnowledgeIndex, ModelInfo, ScenarioInfo, SkillInfo } from './types'

/** 可用模型列表（7.1） */
export async function listModels(): Promise<ModelInfo[]> {
  const list = await apiFetch<ModelInfo[]>('/v1/resources/models')
  // 文档约定按 is_default 降序，防御性再排一次
  return [...list].sort(
    (a, b) => Number(b.is_default ?? false) - Number(a.is_default ?? false),
  )
}

/** 可用知识库列表（7.2，创建对话时选择） */
export function listKnowledgeBases(): Promise<KnowledgeBaseInfo[]> {
  return apiFetch('/v1/resources/knowledge-bases')
}

/** 可用技能列表（7.3，创建对话时选择） */
export function listSkills(): Promise<SkillInfo[]> {
  return apiFetch('/v1/resources/skills')
}

/** 知识库目录索引（9.6，file_refs 选择器用） */
export function getKnowledgeIndex(kbId: string): Promise<KnowledgeIndex> {
  return apiFetch(`/v1/knowledge/bases/${kbId}/index`)
}

/** 可用场景列表（6.0，专业模式创建对话时选择） */
export async function listScenarios(): Promise<ScenarioInfo[]> {
  const res = await apiFetch<{ scenarios: ScenarioInfo[] }>('/v1/conversations/scenarios')
  return res.scenarios
}
