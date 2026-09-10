import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text, useInput } from '../ink.js';
import { Spinner } from './Spinner.js';
import { getAvailablePort, createCallbackServer, openBrowser, sleep } from '../auth/client.js';
import { getApiConfig } from '../config/aoeConfig.js';
import { isDebugEnabled, debugLog, debugObject } from '../utils/debugLog.js';

type Props = {
  onDone: (success: boolean, token?: string) => void;
};

type LoginStatus =
  | { state: 'starting' }
  | { state: 'waiting_for_callback'; port: number }
  | { state: 'verifying'; token: string }
  | { state: 'success'; token: string }
  | { state: 'error'; message: string }
  | { state: 'done' };

export function BrowserLoginFlow({ onDone }: Props): React.ReactNode {
  const [status, setStatus] = useState<LoginStatus>({ state: 'starting' });
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    console.log(msg);
    setDebugLogs(prev => [...prev, msg]);
    // 调试模式下写入日志文件
    if (isDebugEnabled()) {
      debugLog('login:flow', msg);
    }
  }, []);

  // 按任意键关闭
  useInput((input, key) => {
    if (status.state === 'success' || status.state === 'error') {
      onDone(status.state === 'success', status.state === 'success' ? status.token : undefined);
    }
  });

  const startLogin = useCallback(async () => {
    try {
      // 1. 获取可用端口
      const port = await getAvailablePort();

      // 2. 启动本地服务器
      const { server, tokenPromise } = createCallbackServer(port);

      // 3. 打开浏览器
      const callbackUrl = encodeURIComponent(`http://127.0.0.1:${port}/auth/callback`);
      // 使用环境变量配置登录页面地址，默认为生产环境
      const loginPageUrl = process.env.AOE_LOGIN_PAGE_URL || 'https://www.aoecode.cn';
      addLog(`[DEBUG] AOE_LOGIN_PAGE_URL: ${process.env.AOE_LOGIN_PAGE_URL}`);
      addLog(`[DEBUG] loginPageUrl: ${loginPageUrl}`);
      const loginUrl = `${loginPageUrl}/login?callback=${callbackUrl}`;

      setStatus({ state: 'waiting_for_callback', port });
      openBrowser(loginUrl);

      // 4. 等待回调（5 分钟超时）
      addLog('[DEBUG] 等待回调中...');
      const token = await Promise.race([
        tokenPromise,
        sleep(5 * 60 * 1000).then(() => {
          throw new Error('登录超时（5 分钟），请重试');
        }),
      ]);

      addLog('[DEBUG] 收到 token，开始验证...');
      // 5. 验证 token
      setStatus({ state: 'verifying', token });
      const apiConfig = getApiConfig();
      debugObject('login:flow', { apiBaseUrl: apiConfig.baseUrl, verifyPath: '/auth/me' });
      const response = await fetch(`${apiConfig.baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        debugObject('login:flow', { verifyStatus: response.status, verifyStatusText: response.statusText });
        throw new Error(`Token 验证失败 (${response.status})`);
      }

      // 6. 成功
      addLog('[DEBUG] Token 验证成功，登录完成');
      setStatus({ state: 'success', token });
      // 不立即调用 onDone，等待用户按键
    } catch (err: any) {
      addLog(`[DEBUG] 登录失败: ${err.message}`);
      setStatus({ state: 'error', message: err.message });
      // 不立即调用 onDone，等待用户按键
    }
  }, [onDone]);

  useEffect(() => {
    startLogin();
  }, [startLogin]);

  return (
    <Box flexDirection="column" padding={1}>
      {status.state === 'starting' && (
        <Text>正在启动浏览器登录...</Text>
      )}

      {status.state === 'waiting_for_callback' && (
        <Box flexDirection="column">
          <Text>🌐 浏览器已打开，请在浏览器中完成登录</Text>
          <Text>   等待回调中... (端口: {status.port})</Text>
          <Spinner />
          <Text dimColor>   5 分钟内未完成将自动取消</Text>
        </Box>
      )}

      {status.state === 'verifying' && (
        <Box flexDirection="column">
          <Text>✅ 已收到 token，正在验证...</Text>
          <Spinner />
        </Box>
      )}

      {status.state === 'success' && (
        <Box flexDirection="column">
          <Text color="green">✅ 登录成功！</Text>
          <Text dimColor>按任意键继续...</Text>
        </Box>
      )}

      {status.state === 'error' && (
        <Box flexDirection="column">
          <Text color="red">❌ 登录失败：{status.message}</Text>
          <Text dimColor>按任意键继续...</Text>
        </Box>
      )}

      {/* 调试日志 */}
      {debugLogs.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>--- 调试日志 ---</Text>
          {debugLogs.map((log, i) => (
            <Text key={i} dimColor>{log}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
