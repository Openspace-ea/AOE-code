/**
 * 知识库 / 技能列表 Hook：进入对话工作区时各拉取一次
 *
 * 两个接口独立拉取、互不影响：一个失败只禁用对应的选择按钮，
 * 不会拖垮另一个（例如后端 skills 接口故障时知识库仍可用）。
 */

import { useEffect, useState } from 'react'
import { listKnowledgeBases, listSkills } from './resources'
import type { KnowledgeBaseInfo, SkillInfo } from './types'

export function useResources() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseInfo[] | null>(null)
  const [skills, setSkills] = useState<SkillInfo[] | null>(null)
  const [kbError, setKbError] = useState<string | null>(null)
  const [skillsError, setSkillsError] = useState<string | null>(null)

  useEffect(() => {
    listKnowledgeBases()
      .then(setKnowledgeBases)
      .catch((err: unknown) => {
        setKbError(err instanceof Error ? err.message : '知识库列表加载失败')
      })
    listSkills()
      .then(setSkills)
      .catch((err: unknown) => {
        setSkillsError(err instanceof Error ? err.message : '技能列表加载失败')
      })
  }, [])

  return { knowledgeBases, skills, kbError, skillsError }
}
