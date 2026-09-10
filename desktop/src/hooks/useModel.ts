/**
 * AI 模型 Hook
 */

import { useState, useCallback } from 'react'
import modelService, {
  ModelConfig,
  ChatMessage,
  ChatCompletionResponse,
  Tool
} from '../services/model'

interface ModelState {
  models: ModelConfig[]
  loading: boolean
  error: string | null
}

export function useModels() {
  const [state, setState] = useState<ModelState>({
    models: [],
    loading: false,
    error: null
  })

  const loadModels = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const models = await modelService.listModels()
      setState({ models, loading: false, error: null })
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: String(err)
      }))
    }
  }, [])

  return {
    ...state,
    loadModels
  }
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cost, setCost] = useState(0)

  const sendMessage = useCallback(async (
    model: string,
    content: string,
    tools?: Tool[]
  ): Promise<ChatCompletionResponse | null> => {
    // 添加用户消息
    const userMessage: ChatMessage = { role: 'user', content }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setLoading(true)
    setError(null)

    try {
      const response = await modelService.chatCompletion({
        model,
        messages: newMessages,
        tools
      })

      // 添加助手消息
      const assistantMessage = response.choices[0]?.message
      if (assistantMessage) {
        setMessages([...newMessages, assistantMessage])
      }

      // 累计费用
      if (response.cost) {
        setCost(prev => prev + response.cost!)
      }

      return response
    } catch (err) {
      setError(String(err))
      return null
    } finally {
      setLoading(false)
    }
  }, [messages])

  const addToolResult = useCallback(async (
    model: string,
    toolCallId: string,
    toolName: string,
    result: string,
    tools?: Tool[]
  ): Promise<ChatCompletionResponse | null> => {
    // 添加工具结果消息
    const toolMessage: ChatMessage = {
      role: 'tool',
      content: result,
      tool_call_id: toolCallId
    }
    const newMessages = [...messages, toolMessage]
    setMessages(newMessages)
    setLoading(true)

    try {
      const response = await modelService.chatCompletion({
        model,
        messages: newMessages,
        tools
      })

      const assistantMessage = response.choices[0]?.message
      if (assistantMessage) {
        setMessages([...newMessages, assistantMessage])
      }

      if (response.cost) {
        setCost(prev => prev + response.cost!)
      }

      return response
    } catch (err) {
      setError(String(err))
      return null
    } finally {
      setLoading(false)
    }
  }, [messages])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    loading,
    error,
    cost,
    sendMessage,
    addToolResult,
    clearMessages
  }
}

export default useModels