import React, { useState } from 'react';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { Box, Text } from '../ink.js';
import { updateSettingsForSource } from '../utils/settings/settings.js';
import { Select } from './CustomSelect/select.js';
import TextInput from './TextInput.js';

type Props = {
  onDone(): void;
};

type SetupStep = 'choose-provider' | 'enter-url' | 'enter-apikey' | 'enter-model' | 'saving';

export function ProviderSetup({ onDone }: Props): React.ReactNode {
  const [step, setStep] = useState<SetupStep>('choose-provider');
  const [baseURL, setBaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [urlCursorOffset, setUrlCursorOffset] = useState(0);
  const [apiKeyCursorOffset, setApiKeyCursorOffset] = useState(0);
  const [modelCursorOffset, setModelCursorOffset] = useState(0);
  const { columns } = useTerminalSize();

  function handleProviderSelect(value: string) {
    if (value === 'anthropic') {
      onDone();
      return;
    }
    setStep('enter-url');
  }

  function handleURLSubmit() {
    if (baseURL.trim()) {
      setStep('enter-apikey');
    }
  }

  function handleApiKeySubmit() {
    setStep('enter-model');
  }

  function handleModelSubmit() {
    if (modelName.trim()) {
      setStep('saving');
      updateSettingsForSource('userSettings', {
        provider: 'openai',
        openai: {
          baseURL: baseURL.trim(),
          apiKey: apiKey.trim() || 'dummy',
          model: modelName.trim(),
        },
      });
      onDone();
    }
  }

  if (step === 'choose-provider') {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text bold>选择 API 提供商</Text>
        <Box flexDirection="column" width={70}>
          <Text>
            选择你想要使用的 AI 模型服务：
          </Text>
        </Box>
        <Select
          options={[
            {
              label: 'Creatunion (AOE Code)',
              description: '使用 AOE Code 账号登录（需要订阅或 API Key）',
              value: 'anthropic',
            },
            {
              label: 'OpenAI 兼容服务',
              description: '连接 vLLM、DeepSeek、本地模型等 OpenAI 格式服务',
              value: 'openai',
            },
          ]}
          onChange={handleProviderSelect}
          onCancel={() => onDone()}
        />
        <Text dimColor>
          Enter 确认 · Esc 取消
        </Text>
      </Box>
    );
  }

  if (step === 'enter-url') {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text bold>配置 API 服务地址</Text>
        <Box flexDirection="column" width={70}>
          <Text>
            输入 OpenAI 兼容服务的地址：
          </Text>
          <Text dimColor>
            例如：http://localhost:8000/v1
          </Text>
        </Box>
        <TextInput
          value={baseURL}
          onChange={setBaseURL}
          onSubmit={handleURLSubmit}
          placeholder="http://localhost:8000/v1"
          cursorOffset={urlCursorOffset}
          onChangeCursorOffset={setUrlCursorOffset}
          columns={columns}
          showCursor={true}
        />
        <Text dimColor>
          Enter 确认
        </Text>
      </Box>
    );
  }

  if (step === 'enter-apikey') {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text bold>配置 API Key</Text>
        <Box flexDirection="column" width={70}>
          <Text>
            输入 API Key（如果服务不需要，可直接按 Enter 跳过）：
          </Text>
        </Box>
        <TextInput
          value={apiKey}
          onChange={setApiKey}
          onSubmit={handleApiKeySubmit}
          placeholder="留空则使用 dummy"
          cursorOffset={apiKeyCursorOffset}
          onChangeCursorOffset={setApiKeyCursorOffset}
          columns={columns}
          showCursor={true}
        />
        <Text dimColor>
          Enter 确认 · 直接 Enter 跳过
        </Text>
      </Box>
    );
  }

  if (step === 'enter-model') {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text bold>配置模型名称</Text>
        <Box flexDirection="column" width={70}>
          <Text>
            输入服务中注册的模型名称：
          </Text>
          <Text dimColor>
            例如：Qwen/Qwen2.5-7B-Instruct
          </Text>
        </Box>
        <TextInput
          value={modelName}
          onChange={setModelName}
          onSubmit={handleModelSubmit}
          placeholder="Qwen/Qwen2.5-7B-Instruct"
          cursorOffset={modelCursorOffset}
          onChangeCursorOffset={setModelCursorOffset}
          columns={columns}
          showCursor={true}
        />
        <Text dimColor>
          Enter 确认
        </Text>
      </Box>
    );
  }

  if (step === 'saving') {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text>正在保存配置...</Text>
      </Box>
    );
  }

  return null;
}
