/**
 * 应用入口
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { extractTokenFromHash } from './lib/auth'
import { setupAgentRuntime } from './services/agentRuntime'
import './index.css'

// 每次页面加载最先执行：从登录页跳回时 hash 里带着 token，先入库再清地址栏
extractTokenFromHash()
// 注入 Agent 运行时（apiBase / token / 401 处理），供 @aoe/agent 使用
setupAgentRuntime()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
