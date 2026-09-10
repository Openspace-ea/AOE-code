import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text } from '../../ink.js';
import { Spinner } from '../../components/Spinner.js';
import { isLoggedIn, loadToken } from '../../auth/client.js';
import { getApiConfig } from '../../config/aoeConfig.js';
import { debug, debugObject } from '../../utils/debugLog.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';

type Props = {
  onDone: LocalJSXCommandOnDone;
  args: string;
};

type Status =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'streaming'; content: string }
  | { state: 'done'; content: string };

export async function call(onDone: LocalJSXCommandOnDone, context: any, args: string): Promise<React.ReactNode> {
  return <Chat onDone={onDone} args={args} />;
}

function Chat({ onDone, args }: Props): React.ReactNode {
  const [status, setStatus] = useState<Status>({ state: 'loading' });
  const [input, setInput] = useState(args || '');

  const sendMessage = useCallback(async (message: string, model?: string) => {
    if (!isLoggedIn()) {
      setStatus({ state: 'error', message: '❌ 未登录，请先执行 /login' });
      return;
    }

    const token = loadToken();
    const apiConfig = getApiConfig();

    try {
      setStatus({ state: 'loading' });

      const requestBody = {
        model: model || 'default-model',
        messages: [
          { role: 'user', content: message },
        ],
        stream: true,
      };

      debug('chat', `请求对话: ${apiConfig.baseUrl}/v1/chat/completions`);
      debugObject('chat', { model: requestBody.model, messageLength: message.length });

      const response = await fetch(`${apiConfig.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      debug('chat', `对话响应状态: ${response.status}`);

      if (!response.ok) {
        if (response.status === 401) {
          setStatus({ state: 'error', message: '❌ 登录已过期，请重新执行 /login' });
          return;
        }
        if (response.status === 402) {
          setStatus({ state: 'error', message: '❌ 余额不足，请充值后重试' });
          return;
        }
        throw new Error(`请求失败 (${response.status})`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let content = '';

      setStatus({ state: 'streaming', content: '' });

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setStatus({ state: 'done', content });
              onDone('Chat completed', { display: 'user' });
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                content += delta;
                setStatus({ state: 'streaming', content });
              }
            } catch {
              // Ignore parsing errors for malformed chunks
              debug('chat', `无法解析的 SSE 数据块: ${data}`);
            }
          }
        }
      }

      setStatus({ state: 'done', content });
      onDone('Chat completed', { display: 'user' });
    } catch (err: any) {
      setStatus({ state: 'error', message: `❌ 调用失败：${err.message}` });
    }
  }, [onDone]);

  useEffect(() => {
    if (args) {
      // Parse args: could be "model message" or just "message"
      const parts = args.split(' ');
      if (parts.length >= 2 && parts[0].includes('-')) {
        // First part looks like a model name
        sendMessage(parts.slice(1).join(' '), parts[0]);
      } else {
        sendMessage(args);
      }
    }
  }, [args, sendMessage]);

  return (
    <Box flexDirection="column" padding={1}>
      {status.state === 'loading' && (
        <Box>
          <Spinner />
          <Text> 正在发送消息...</Text>
        </Box>
      )}

      {status.state === 'error' && (
        <Text color="red">{status.message}</Text>
      )}

      {status.state === 'streaming' && (
        <Box flexDirection="column">
          <Text bold>AI 回复：</Text>
          <Text>{status.content}</Text>
          <Spinner />
        </Box>
      )}

      {status.state === 'done' && (
        <Box flexDirection="column">
          <Text bold>AI 回复：</Text>
          <Text>{status.content}</Text>
        </Box>
      )}
    </Box>
  );
}
