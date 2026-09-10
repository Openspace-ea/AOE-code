import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text } from '../../ink.js';
import { Spinner } from '../../components/Spinner.js';
import { isLoggedIn, loadToken } from '../../auth/client.js';
import { getApiConfig } from '../../config/aoeConfig.js';
import { debug, debugObject } from '../../utils/debugLog.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';

interface Model {
  id: string;
  name: string;
  provider?: string;
  description?: string;
  max_tokens?: number;
  pricing?: {
    input: number;
    output: number;
  };
}

type Props = {
  onDone: LocalJSXCommandOnDone;
};

type Status =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'success'; models: Model[] };

export function call(onDone: LocalJSXCommandOnDone): Promise<React.ReactNode> {
  return Promise.resolve(<ModelsList onDone={onDone} />);
}

function ModelsList({ onDone }: Props): React.ReactNode {
  const [status, setStatus] = useState<Status>({ state: 'loading' });

  const loadModels = useCallback(async () => {
    if (!isLoggedIn()) {
      setStatus({ state: 'error', message: '❌ 未登录，请先执行 /login' });
      return;
    }

    const token = loadToken();
    const apiConfig = getApiConfig();

    try {
      debug('models', `请求模型列表: ${apiConfig.baseUrl}/v1/models/`);
      const response = await fetch(`${apiConfig.baseUrl}/v1/models/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      debug('models', `模型列表响应状态: ${response.status}`);

      if (!response.ok) {
        if (response.status === 401) {
          setStatus({ state: 'error', message: '❌ 登录已过期，请重新执行 /login' });
          return;
        }
        throw new Error(`请求失败 (${response.status})`);
      }

      const models = await response.json();
      debugObject('models', { count: models.length, models });
      setStatus({ state: 'success', models });
    } catch (err: any) {
      debug('models', `获取模型列表失败: ${err.message}`);
      setStatus({ state: 'error', message: `❌ 获取模型列表失败：${err.message}` });
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  return (
    <Box flexDirection="column" padding={1}>
      {status.state === 'loading' && (
        <Box>
          <Spinner />
          <Text> 正在加载模型列表...</Text>
        </Box>
      )}

      {status.state === 'error' && (
        <Text color="red">{status.message}</Text>
      )}

      {status.state === 'success' && (
        <Box flexDirection="column">
          <Text bold>## 可用模型</Text>
          <Text> </Text>

          {status.models.length === 0 ? (
            <Text dimColor>暂无可用模型</Text>
          ) : (
            <Box flexDirection="column">
              <Box>
                <Text bold>模型</Text>
                <Text>  </Text>
                <Text bold>提供商</Text>
                <Text>  </Text>
                <Text bold>说明</Text>
              </Box>
              <Text>─────────────────────────────────────────────</Text>
              {status.models.map((model) => (
                <Box key={model.id}>
                  <Text>{model.name || model.id}</Text>
                  <Text>  </Text>
                  <Text>{model.provider || '-'}</Text>
                  <Text>  </Text>
                  <Text>{model.description || '-'}</Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
