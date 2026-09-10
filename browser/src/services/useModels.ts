/**
 * 模型列表 Hook：进入对话工作区时拉取一次可用模型
 */

import { useEffect, useState } from 'react'
import { listModels } from './resources'
import type { ModelInfo } from './types'

export function useModels() {
  const [models, setModels] = useState<ModelInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listModels()
      .then(setModels)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '模型列表加载失败')
      })
  }, [])

  return { models, modelsError: error }
}
