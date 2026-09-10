/**
 * OpenAI/vLLM 兼容适配器
 *
 * 将 Anthropic SDK 接口转换为 OpenAI Chat Completions API 格式，
 * 使 AOE Code 可以直接连接 vLLM 等 OpenAI 兼容服务。
 *
 * 类型转换使用 `as unknown as` 断言，与 Bedrock/Vertex/Foundry provider 模式一致。
 */

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

// ============================================================
// 类型定义
// ============================================================

export interface OpenAIAdapterConfig {
  apiKey: string
  baseURL: string
  modelName: string
  defaultHeaders?: Record<string, string>
  maxRetries?: number
  timeout?: number
}

// ============================================================
// 请求转换：Anthropic → OpenAI
// ============================================================

function convertSystemPrompt(
  system: string | Anthropic.Beta.BetaTextBlockParam[] | undefined,
): OpenAI.ChatCompletionMessageParam[] {
  if (!system) return []
  if (typeof system === 'string') {
    return [{ role: 'system', content: system }]
  }
  const text = system
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
  return text ? [{ role: 'system', content: text }] : []
}

function convertContentBlocks(
  content: string | Anthropic.Beta.BetaContentBlockParam[],
): string | OpenAI.ChatCompletionContentPart[] {
  if (typeof content === 'string') return content

  const parts: OpenAI.ChatCompletionContentPart[] = []
  for (const block of content) {
    if (block.type === 'text') {
      parts.push({ type: 'text', text: block.text })
    } else if (block.type === 'image') {
      const source = (block as unknown as { source: Record<string, unknown> }).source
      if (source.type === 'base64') {
        parts.push({
          type: 'image_url',
          image_url: {
            url: `data:${source.media_type};base64,${source.data}`,
          },
        })
      } else if (source.type === 'url') {
        parts.push({
          type: 'image_url',
          image_url: { url: source.url as string },
        })
      }
    }
  }
  return parts.length === 1 && parts[0]!.type === 'text'
    ? parts[0]!.text
    : parts
}

function convertMessages(
  messages: Record<string, unknown>[],
): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = []

  for (const msg of messages) {
    if (msg.role === 'user') {
      if (Array.isArray(msg.content)) {
        const toolResults = msg.content.filter(
          (b: Record<string, unknown>) => b.type === 'tool_result',
        )
        const nonToolResults = msg.content.filter(
          (b: Record<string, unknown>) => b.type !== 'tool_result',
        )

        for (const tr of toolResults) {
          let content = ''
          if (typeof tr.content === 'string') {
            content = tr.content
          } else if (Array.isArray(tr.content)) {
            content = tr.content
              .filter((b: Record<string, unknown>) => b.type === 'text')
              .map((b: Record<string, unknown>) => b.text)
              .join('\n')
          }
          result.push({
            role: 'tool',
            tool_call_id: tr.tool_use_id as string,
            content,
          })
        }

        if (nonToolResults.length > 0) {
          const converted = convertContentBlocks(
            nonToolResults as Anthropic.Beta.BetaContentBlockParam[],
          )
          if (converted) {
            result.push({ role: 'user', content: converted })
          }
        }
      } else {
        result.push({ role: 'user', content: msg.content as string })
      }
    } else if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        result.push({ role: 'assistant', content: msg.content })
      } else if (Array.isArray(msg.content)) {
        let textContent = ''
        const toolCalls: { id: string; type: 'function'; function: { name: string; arguments: string } }[] = []

        for (const block of msg.content) {
          const b = block as Record<string, unknown>
          if (b.type === 'text') {
            textContent += b.text as string
          } else if (b.type === 'tool_use') {
            toolCalls.push({
              id: b.id as string,
              type: 'function',
              function: {
                name: b.name as string,
                arguments:
                  typeof b.input === 'string'
                    ? b.input
                    : JSON.stringify(b.input),
              },
            })
          }
        }

        const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: textContent || null,
        }
        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls
        }
        result.push(assistantMsg)
      }
    }
  }

  return result
}

function convertTools(
  tools: Record<string, unknown>[] | undefined,
): OpenAI.ChatCompletionTool[] | undefined {
  if (!tools || tools.length === 0) return undefined

  return tools
    .filter(t => 'name' in t && 'input_schema' in t)
    .map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name as string,
        description: (tool.description as string) || '',
        parameters: tool.input_schema as Record<string, unknown>,
      },
    })) as unknown as OpenAI.ChatCompletionTool[]
}

function convertToolChoice(
  toolChoice: Record<string, unknown> | undefined,
): OpenAI.ChatCompletionToolChoiceOption | undefined {
  if (!toolChoice) return undefined
  if (toolChoice.type === 'auto') return 'auto'
  if (toolChoice.type === 'any') return 'required'
  if (toolChoice.type === 'tool') {
    return {
      type: 'function' as const,
      function: { name: toolChoice.name as string },
    }
  }
  return 'auto'
}

// ============================================================
// 响应转换：OpenAI → Anthropic
// ============================================================

function convertStopReason(
  finishReason: string | null,
): Anthropic.Beta.BetaStopReason {
  switch (finishReason) {
    case 'stop':
      return 'end_turn'
    case 'length':
      return 'max_tokens'
    case 'tool_calls':
      return 'tool_use'
    default:
      return 'end_turn'
  }
}

function makeUsage(
  inputTokens: number,
  outputTokens: number,
): Anthropic.Beta.BetaUsage {
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  } as unknown as Anthropic.Beta.BetaUsage
}

function convertResponse(
  response: OpenAI.ChatCompletion,
  model: string,
): Anthropic.Beta.BetaMessage {
  const choice = response.choices[0]
  const message = choice?.message as unknown as Record<string, unknown> | undefined

  const content: Anthropic.Beta.BetaContentBlock[] = []

  if (message?.content) {
    content.push({
      type: 'text',
      text: message.content as string,
      citations: [],
    })
  }

  if (message?.tool_calls) {
    for (const tc of message.tool_calls as Record<string, unknown>[]) {
      const fn = tc.function as Record<string, unknown>
      content.push({
        type: 'tool_use',
        id: tc.id as string,
        name: fn.name as string,
        input: JSON.parse(fn.arguments as string),
      })
    }
  }

  const usage = response.usage as unknown as Record<string, number> | undefined

  return {
    id: response.id || `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content,
    model,
    stop_reason: convertStopReason((choice?.finish_reason as string) ?? null),
    stop_sequence: null,
    usage: makeUsage(
      usage?.prompt_tokens ?? 0,
      usage?.completion_tokens ?? 0,
    ),
    container: null,
    context_management: null,
  } as unknown as Anthropic.Beta.BetaMessage
}

// ============================================================
// 流式响应转换
// ============================================================

async function* convertStreamToAnthropicEvents(
  stream: AsyncIterable<OpenAI.ChatCompletionChunk>,
  model: string,
): AsyncGenerator<Anthropic.Beta.BetaRawMessageStreamEvent> {
  let messageId = `msg_${Date.now()}`
  let inputTokens = 0
  let outputTokens = 0
  let blockIndex = 0
  let currentBlockStarted = false
  let currentBlockType: 'text' | 'tool_use' = 'text'
  let currentToolId = ''
  let currentToolName = ''
  let currentToolArgs = ''
  let lastFinishReason: string | null = null
  let textBlockOpen = false

  for await (const chunk of stream) {
    const c = chunk as unknown as Record<string, unknown>
    if (c.id) messageId = c.id as string
    const chunkUsage = c.usage as Record<string, number> | undefined
    if (chunkUsage) {
      inputTokens = chunkUsage.prompt_tokens ?? inputTokens
      outputTokens = chunkUsage.completion_tokens ?? outputTokens
    }

    const choices = c.choices as Record<string, unknown>[] | undefined
    const choice = choices?.[0]
    if (!choice) continue

    const delta = choice.delta as Record<string, unknown> | undefined
    if (choice.finish_reason) {
      lastFinishReason = choice.finish_reason as string
    }

    // 第一个 chunk：发送 message_start
    if (blockIndex === 0 && !currentBlockStarted) {
      yield {
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model,
          stop_reason: null,
          stop_sequence: null,
          usage: makeUsage(inputTokens, 0),
        },
      } as unknown as Anthropic.Beta.BetaRawMessageStreamEvent
    }

    // 处理 tool_calls delta
    const toolCallsDelta = delta?.tool_calls as
      | Record<string, unknown>[]
      | undefined
    if (toolCallsDelta) {
      for (const tc of toolCallsDelta) {
        const fn = tc.function as Record<string, unknown> | undefined
        if (fn?.name) {
          if (textBlockOpen) {
            yield {
              type: 'content_block_stop',
              index: blockIndex,
            } as unknown as Anthropic.Beta.BetaRawMessageStreamEvent
            blockIndex++
            textBlockOpen = false
          }

          if (currentBlockType === 'tool_use' && currentToolName) {
            yield {
              type: 'content_block_stop',
              index: blockIndex,
            } as unknown as Anthropic.Beta.BetaRawMessageStreamEvent
            blockIndex++
          }

          currentBlockType = 'tool_use'
          currentToolId = (tc.id as string) || `toolu_${Date.now()}`
          currentToolName = fn.name as string
          currentToolArgs = ''

          yield {
            type: 'content_block_start',
            index: blockIndex,
            content_block: {
              type: 'tool_use',
              id: currentToolId,
              name: currentToolName,
              input: '',
            },
          } as unknown as Anthropic.Beta.BetaRawMessageStreamEvent
          currentBlockStarted = true
        }

        if (fn?.arguments) {
          currentToolArgs += fn.arguments as string
          yield {
            type: 'content_block_delta',
            index: blockIndex,
            delta: {
              type: 'input_json_delta',
              partial_json: fn.arguments as string,
            },
          } as unknown as Anthropic.Beta.BetaRawMessageStreamEvent
        }
      }
    }

    // 处理文本 content delta
    const contentDelta = delta?.content as string | undefined
    if (contentDelta) {
      if (currentBlockType === 'tool_use' && currentToolName) {
        yield {
          type: 'content_block_stop',
          index: blockIndex,
        } as unknown as Anthropic.Beta.BetaRawMessageStreamEvent
        blockIndex++
        currentToolName = ''
        currentBlockType = 'text'
      }

      if (!textBlockOpen) {
        yield {
          type: 'content_block_start',
          index: blockIndex,
          content_block: {
            type: 'text',
            text: '',
            citations: [],
          },
        } as unknown as Anthropic.Beta.BetaRawMessageStreamEvent
        textBlockOpen = true
        currentBlockStarted = true
      }

      yield {
        type: 'content_block_delta',
        index: blockIndex,
        delta: {
          type: 'text_delta',
          text: contentDelta,
        },
      } as unknown as Anthropic.Beta.BetaRawMessageStreamEvent
    }
  }

  // 关闭最后打开的 block
  if (textBlockOpen) {
    yield {
      type: 'content_block_stop',
      index: blockIndex,
    } as unknown as Anthropic.Beta.BetaRawMessageStreamEvent
    blockIndex++
  } else if (currentBlockType === 'tool_use' && currentToolName) {
    yield {
      type: 'content_block_stop',
      index: blockIndex,
    } as unknown as Anthropic.Beta.BetaRawMessageStreamEvent
    blockIndex++
  }

  // 发送 message_delta
  yield {
    type: 'message_delta',
    delta: {
      stop_reason: convertStopReason(lastFinishReason),
      stop_sequence: null,
    },
    usage: { output_tokens: outputTokens },
  } as unknown as Anthropic.Beta.BetaRawMessageStreamEvent

  // 发送 message_stop
  yield {
    type: 'message_stop',
  } as unknown as Anthropic.Beta.BetaRawMessageStreamEvent
}

// ============================================================
// 创建 OpenAI 适配器客户端
// ============================================================

export function createOpenAIClient(config: OpenAIAdapterConfig): Anthropic {
  const openai = new OpenAI({
    apiKey: config.apiKey || 'not-needed',
    baseURL: config.baseURL,
    defaultHeaders: config.defaultHeaders,
    maxRetries: config.maxRetries ?? 0,
    timeout: config.timeout ?? 600_000,
  })

  const modelName = config.modelName

  // 构建代理对象，模拟 Anthropic SDK 接口
  // 使用 as unknown as Anthropic 断言，与 Bedrock/Vertex/Foundry 模式一致
  const adapter = {
    beta: {
      messages: {
        create: (
          params: Record<string, unknown>,
          options?: { signal?: AbortSignal; headers?: Record<string, string> },
        ) => {
          const openaiMessages = [
            ...convertSystemPrompt(
              params.system as
                | string
                | Anthropic.Beta.BetaTextBlockParam[]
                | undefined,
            ),
            ...convertMessages(
              params.messages as Record<string, unknown>[],
            ),
          ]
          const openaiTools = convertTools(
            params.tools as Record<string, unknown>[] | undefined,
          )
          const toolChoice = convertToolChoice(
            params.tool_choice as Record<string, unknown> | undefined,
          )

          const requestParams: OpenAI.ChatCompletionCreateParams = {
            model: modelName || (params.model as string),
            messages: openaiMessages,
            max_tokens: params.max_tokens as number | undefined,
            stream: (params.stream as boolean) ?? false,
          }

          if (openaiTools && openaiTools.length > 0) {
            requestParams.tools = openaiTools
          }
          if (toolChoice) {
            requestParams.tool_choice = toolChoice
          }
          if (
            params.temperature !== undefined &&
            params.temperature !== null
          ) {
            requestParams.temperature = params.temperature as number
          }

          // 流式请求
          // Anthropic SDK 的 create({stream:true}) 返回一个 thenable 对象，
          // 代码链式调用 .create(...).withResponse()，
          // 所以 create() 返回的对象必须有 then() 和 withResponse() 方法。
          if (params.stream) {
            const streamPromise = openai.chat.completions.create(
              requestParams,
              { signal: options?.signal },
            )

            const streamData = {
              [Symbol.asyncIterator]: () => {
                const gen = (async function* () {
                  try {
                    const stream = await streamPromise
                    yield* convertStreamToAnthropicEvents(
                      stream as AsyncIterable<OpenAI.ChatCompletionChunk>,
                      modelName || (params.model as string),
                    )
                  } catch (e) {
                    const err = e as Error & { status?: number; error?: unknown }
                    throw new Error(
                      `OpenAI API Error (${err.status ?? 'unknown'}): ${err.message || JSON.stringify(err.error || err)}`,
                    )
                  }
                })()
                return gen[Symbol.asyncIterator]()
              },
            }

            // 返回 thenable 对象，支持 .create(...).withResponse() 链式调用
            // streamData 和 streamResult 分离，避免 then() 中 resolve(streamResult) 触发无限递归
            const streamResult = {
              ...streamData,
              withResponse: async () => ({
                data: streamData,
                response: new Response(),
              }),
              then: (resolve: (v: unknown) => void, reject?: (e: Error) => void) => {
                try {
                  resolve(Promise.resolve(streamData))
                } catch (e) {
                  if (reject) reject(e as Error)
                }
              },
            }

            return streamResult as unknown as Anthropic.Beta.BetaMessage
          }

          // 非流式请求
          return (async () => {
            try {
              const response = await openai.chat.completions.create(
                requestParams,
                { signal: options?.signal },
              )
              return convertResponse(
                response as OpenAI.ChatCompletion,
                modelName || (params.model as string),
              )
            } catch (e) {
              const err = e as Error & { status?: number; error?: unknown }
              throw new Error(
                `OpenAI API Error (${err.status ?? 'unknown'}): ${err.message || JSON.stringify(err.error || err)}`,
              )
            }
          })() as unknown as Promise<Anthropic.Beta.BetaMessage>
        },

        countTokens: async (params: { messages: unknown[]; model?: string }) => {
          const text = JSON.stringify(params.messages)
          return {
            input_tokens: Math.ceil(text.length / 4),
          }
        },
      },
    },

    models: {
      list: async function* () {
        yield* []
      },
    },
  }

  return adapter as unknown as Anthropic
}
