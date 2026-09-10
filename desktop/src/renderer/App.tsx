/**
 * AOE Code Desktop - 太空数据分析平台
 * 专业级 UI 布局
 */

import React, { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import './App.css'

// ============================================
// 开发者模式配置
// ============================================

const DEV_MODE = true  // 开发者模式，不需要后端和登录

const DEV_USER: User = {
  id: 'dev-001',
  email: 'dev@aoecode.cn',
  phone: '13800000000',
  role: 'admin'
}

// ============================================
// 类型定义
// ============================================

interface User {
  id: string
  email: string
  phone: string
  role: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
}

// ============================================
// 主应用
// ============================================

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'chat' | 'space' | 'data'>('chat')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    // 开发者模式：直接登录
    if (DEV_MODE) {
      document.title = 'AOE Code Desktop [开发者模式]'
      setUser(DEV_USER)
      setLoading(false)
      return
    }

    // 正常模式：检查 token
    const token = api.getToken()
    if (token) {
      api.getMe()
        .then(result => {
          if (result.success) setUser(result.data as User)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  if (loading) return <LoadingScreen />
  if (!user) return <LoginPage onLogin={setUser} />

  return (
    <div className="app">
      {/* 左侧导航栏 */}
      <NavigationRail
        activeView={activeView}
        onViewChange={setActiveView}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* 主内容区 */}
      <div className="main-area">
        {activeView === 'chat' && <ChatWorkspace />}
        {activeView === 'space' && <SpaceWorkspace />}
        {activeView === 'data' && <DataWorkspace />}
      </div>
    </div>
  )
}

// ============================================
// 导航栏
// ============================================

function NavigationRail({
  activeView,
  onViewChange,
  collapsed,
  onToggle
}: {
  activeView: string
  onViewChange: (view: 'chat' | 'space' | 'data') => void
  collapsed: boolean
  onToggle: () => void
}) {
  const navItems = [
    { id: 'chat', icon: '💬', label: 'AI 助手', shortcut: 'Ctrl+1' },
    { id: 'space', icon: '🛰️', label: '太空分析', shortcut: 'Ctrl+2' },
    { id: 'data', icon: '📊', label: '数据管理', shortcut: 'Ctrl+3' },
  ]

  return (
    <nav className={`nav-rail ${collapsed ? 'collapsed' : ''}`}>
      <div className="nav-header">
        <div className="logo">
          <span className="logo-icon">🔧</span>
          {!collapsed && (
            <span className="logo-text">
              <span className="aoe">AOE</span>{' '}
              <span className="code">Code</span>
            </span>
          )}
        </div>
        <button className="toggle-btn" onClick={onToggle}>
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <div className="nav-items">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id as any)}
            title={`${item.label} (${item.shortcut})`}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </div>

      <div className="nav-footer">
        <button className="nav-item" title="设置">
          <span className="nav-icon">⚙️</span>
          {!collapsed && <span className="nav-label">设置</span>}
        </button>
      </div>
    </nav>
  )
}

// ============================================
// AI 助手工作区
// ============================================

// 模拟 AI 响应
function getMockAIResponse(input: string): string {
  if (input.includes('快速排序') || input.includes('排序')) {
    return `好的，这是一个 Python 快速排序实现：

\`\`\`python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

# 测试
arr = [3, 6, 8, 10, 1, 2, 1]
print(quicksort(arr))  # [1, 1, 2, 3, 6, 8, 10]
\`\`\`

时间复杂度：平均 O(n log n)，最坏 O(n²)
空间复杂度：O(log n)`
  }

  if (input.includes('ISS') || input.includes('国际空间站')) {
    return `ISS（国际空间站）基本信息：

- **NORAD ID**: 25544
- **轨道类型**: LEO（低地球轨道）
- **轨道高度**: 约 415 km
- **轨道倾角**: 51.64°
- **轨道周期**: 约 92.68 分钟
- **发射日期**: 1998-11-20
- **运营方**: NASA/Roscosmos

ISS 是目前最大的人造卫星，每天绕地球约 15.5 圈。`
  }

  return `收到你的消息："${input}"

这是 AOE Code 开发者模式的模拟响应。在正式版本中，这里会连接 AI 模型服务，提供真正的智能对话能力。

你可以尝试：
- 问关于卫星的问题（如 "ISS 的轨道参数"）
- 请求写代码（如 "写一个快速排序"）
- 请求数据分析`
}

function ChatWorkspace() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gpt-4')
  const [showFilePanel, setShowFilePanel] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      // 开发模式：使用模拟响应
      if (DEV_MODE) {
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: getMockAIResponse(input),
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMsg])
        setLoading(false)
        return
      }

      const result = await api.chatCompletion(selectedModel, [
        { role: 'user', content: input }
      ])

      if (result.success) {
        const data = result.data as any
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.choices?.[0]?.message?.content || '无响应',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMsg])
      }
    } catch (err) {
      console.error('Chat error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="workspace chat-workspace">
      {/* 工具栏 */}
      <div className="toolbar">
        <div className="toolbar-left">
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            className="model-select"
          >
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            <option value="claude-3-opus">Claude 3 Opus</option>
            <option value="deepseek-chat">DeepSeek</option>
          </select>
        </div>
        <div className="toolbar-right">
          <button
            className={`tool-btn ${showFilePanel ? 'active' : ''}`}
            onClick={() => setShowFilePanel(!showFilePanel)}
          >
            📁 文件
          </button>
          <button className="tool-btn">📝 文档</button>
          <button className="tool-btn">💻 代码</button>
        </div>
      </div>

      <div className="chat-content">
        {/* 文件面板 */}
        {showFilePanel && <FilePanel />}

        {/* 聊天区 */}
        <div className="chat-panel">
          <div className="messages">
            {messages.length === 0 && (
              <div className="empty-state">
                <h2><span className="aoe">AOE</span> <span className="code">Code</span> AI 助手</h2>
                <p>我可以帮你写代码、分析数据、生成报告...</p>
                <div className="suggestions">
                  <button onClick={() => setInput('帮我写一个 Python 快速排序')}>写代码</button>
                  <button onClick={() => setInput('分析 ISS 卫星的轨道数据')}>分析数据</button>
                  <button onClick={() => setInput('生成一份卫星分析报告')}>生成报告</button>
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <div className="message-text">{msg.content}</div>
                  <div className="message-time">
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="message assistant">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="输入消息... (Shift+Enter 换行)"
              rows={1}
            />
            <button className="send-btn" onClick={handleSend} disabled={loading}>
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// 文件面板
// ============================================

function FilePanel() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [currentPath, setCurrentPath] = useState('.')

  return (
    <div className="file-panel">
      <div className="file-header">
        <span>📁 文件浏览器</span>
        <span className="file-path">{currentPath}</span>
      </div>
      <div className="file-list">
        <div className="file-item directory">
          <span className="file-icon">📁</span>
          <span className="file-name">..</span>
        </div>
        {files.map(file => (
          <div key={file.path} className={`file-item ${file.type}`}>
            <span className="file-icon">
              {file.type === 'directory' ? '📁' : '📄'}
            </span>
            <span className="file-name">{file.name}</span>
            {file.size && <span className="file-size">{formatSize(file.size)}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// 太空分析工作区
// ============================================

function SpaceWorkspace() {
  const [activeTab, setActiveTab] = useState<'orbit' | '3d' | 'stk' | 'analysis'>('orbit')

  return (
    <div className="workspace space-workspace">
      <div className="toolbar">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'orbit' ? 'active' : ''}`}
            onClick={() => setActiveTab('orbit')}
          >
            🛰️ 轨道数据
          </button>
          <button
            className={`tab ${activeTab === '3d' ? 'active' : ''}`}
            onClick={() => setActiveTab('3d')}
          >
            🌍 3D 可视化
          </button>
          <button
            className={`tab ${activeTab === 'stk' ? 'active' : ''}`}
            onClick={() => setActiveTab('stk')}
          >
            🔧 STK 集成
          </button>
          <button
            className={`tab ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            📈 分析工具
          </button>
        </div>
      </div>

      <div className="space-content">
        {activeTab === 'orbit' && <OrbitPanel />}
        {activeTab === '3d' && <Visualization3DPanel />}
        {activeTab === 'stk' && <STKPanel />}
        {activeTab === 'analysis' && <AnalysisPanel />}
      </div>
    </div>
  )
}

// 轨道数据面板
// 模拟卫星数据
const MOCK_SATELLITES = [
  { id: '25544', name: 'ISS (国际空间站)', orbit_type: 'LEO', country: '国际' },
  { id: '48274', name: '天宫空间站', orbit_type: 'LEO', country: '中国' },
  { id: '43013', name: 'STARLINK-1007', orbit_type: 'LEO', country: '美国' },
  { id: '36508', name: 'BEIDOU-3 M1', orbit_type: 'MEO', country: '中国' },
  { id: '28654', name: 'GPS IIR-10', orbit_type: 'MEO', country: '美国' },
  { id: '48859', name: 'ONEWEB-0123', orbit_type: 'LEO', country: '英国' },
]

const MOCK_ORBIT_DATA = Array.from({ length: 30 }, (_, i) => ({
  timestamp: new Date(Date.now() - i * 86400000).toISOString(),
  mean_motion: 15.49 + Math.random() * 0.02,
  eccentricity: 0.0001 + Math.random() * 0.0001,
  inclination: 51.64 + Math.random() * 0.1,
  ra_of_asc_node: (i * 0.9856) % 360,
}))

function OrbitPanel() {
  const [satellites, setSatellites] = useState<any[]>([])
  const [selectedSat, setSelectedSat] = useState<string | null>(null)
  const [orbitData, setOrbitData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSatellites()
  }, [])

  async function loadSatellites() {
    if (DEV_MODE) {
      setSatellites(MOCK_SATELLITES)
      setLoading(false)
      return
    }

    const result = await api.getSatellites({ limit: '50' })
    if (result.success) {
      setSatellites((result.data as any)?.satellites || [])
    }
    setLoading(false)
  }

  async function loadOrbitData(satId: string) {
    setSelectedSat(satId)

    if (DEV_MODE) {
      setOrbitData(MOCK_ORBIT_DATA)
      return
    }

    const result = await api.getSatelliteOrbits(satId, { limit: '100' })
    if (result.success) {
      setOrbitData((result.data as any)?.orbits || [])
    }
  }

  return (
    <div className="orbit-panel">
      <div className="orbit-sidebar">
        <div className="search-box">
          <input type="text" placeholder="搜索卫星..." />
        </div>
        <div className="satellite-list">
          {satellites.map(sat => (
            <div
              key={sat.id}
              className={`sat-item ${selectedSat === sat.id ? 'active' : ''}`}
              onClick={() => loadOrbitData(sat.id)}
            >
              <div className="sat-name">{sat.name}</div>
              <div className="sat-info">
                <span className="sat-orbit">{sat.orbit_type}</span>
                <span className="sat-country">{sat.country}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="orbit-detail">
        {selectedSat ? (
          <>
            <div className="orbit-header">
              <h3>卫星详情</h3>
            </div>
            <div className="orbit-chart">
              {/* 轨道图表区域 */}
              <div className="chart-placeholder">
                轨道参数时间序列图表
              </div>
            </div>
            <div className="orbit-table">
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>平均运动</th>
                    <th>偏心率</th>
                    <th>倾角</th>
                    <th>升交点</th>
                  </tr>
                </thead>
                <tbody>
                  {orbitData.slice(0, 20).map((data, i) => (
                    <tr key={i}>
                      <td>{new Date(data.timestamp).toLocaleString()}</td>
                      <td>{data.mean_motion?.toFixed(6)}</td>
                      <td>{data.eccentricity?.toFixed(6)}</td>
                      <td>{data.inclination?.toFixed(4)}°</td>
                      <td>{data.ra_of_asc_node?.toFixed(4)}°</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>选择一颗卫星查看轨道数据</p>
          </div>
        )}
      </div>
    </div>
  )
}

// 3D 可视化面板
function Visualization3DPanel() {
  return (
    <div className="viz3d-panel">
      <div className="viz3d-container">
        <div className="viz3d-placeholder">
          <h3>🌍 3D 轨道可视化</h3>
          <p>集成 Three.js / Cesium.js 实现</p>
          <div className="viz3d-features">
            <div className="feature">✓ 地球 3D 模型</div>
            <div className="feature">✓ 卫星轨道渲染</div>
            <div className="feature">✓ 实时位置追踪</div>
            <div className="feature">✓ 轨道预测</div>
          </div>
        </div>
      </div>
      <div className="viz3d-controls">
        <h4>控制面板</h4>
        <div className="control-group">
          <label>时间速度</label>
          <input type="range" min="1" max="100" defaultValue="1" />
        </div>
        <div className="control-group">
          <label>显示选项</label>
          <div className="checkbox-group">
            <label><input type="checkbox" defaultChecked /> 卫星标签</label>
            <label><input type="checkbox" defaultChecked /> 轨道线</label>
            <label><input type="checkbox" /> 覆盖区域</label>
          </div>
        </div>
      </div>
    </div>
  )
}

// STK 集成面板
function STKPanel() {
  return (
    <div className="stk-panel">
      <div className="stk-header">
        <h3>🔧 STK 集成</h3>
        <span className="stk-status">未连接</span>
      </div>

      <div className="stk-content">
        <div className="stk-connect">
          <h4>连接 STK</h4>
          <div className="form-group">
            <label>STK 服务器地址</label>
            <input type="text" placeholder="localhost" />
          </div>
          <div className="form-group">
            <label>端口</label>
            <input type="text" placeholder="5001" />
          </div>
          <button className="btn-primary">连接</button>
        </div>

        <div className="stk-features">
          <h4>可用功能</h4>
          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-icon">📡</span>
              <div>
                <h5>场景管理</h5>
                <p>创建和管理 STK 场景</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🛰️</span>
              <div>
                <h5>卫星对象</h5>
                <p>导入/导出卫星对象</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📊</span>
              <div>
                <h5>报告生成</h5>
                <p>生成 STK 分析报告</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🎬</span>
              <div>
                <h5>动画导出</h5>
                <p>导出轨道动画</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 分析工具面板
function AnalysisPanel() {
  return (
    <div className="analysis-panel">
      <h3>📈 分析工具</h3>

      <div className="analysis-tools">
        <div className="tool-card">
          <h4>🔄 轨道预报</h4>
          <p>基于 SGP4/SDP4 模型预测卫星轨道</p>
          <button className="btn-secondary">打开</button>
        </div>

        <div className="tool-card">
          <h4>💥 碰撞分析</h4>
          <p>分析卫星碰撞风险</p>
          <button className="btn-secondary">打开</button>
        </div>

        <div className="tool-card">
          <h4>🔥 再入分析</h4>
          <p>预测卫星再入大气层时间</p>
          <button className="btn-secondary">打开</button>
        </div>

        <div className="tool-card">
          <h4>📡 覆盖分析</h4>
          <p>分析卫星覆盖区域</p>
          <button className="btn-secondary">打开</button>
        </div>

        <div className="tool-card">
          <h4>🔗 链路分析</h4>
          <p>分析卫星通信链路</p>
          <button className="btn-secondary">打开</button>
        </div>

        <div className="tool-card">
          <h4>🌙 光照分析</h4>
          <p>分析卫星光照条件</p>
          <button className="btn-secondary">打开</button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// 数据管理工作区
// ============================================

function DataWorkspace() {
  return (
    <div className="workspace data-workspace">
      <div className="toolbar">
        <div className="tabs">
          <button className="tab active">📊 数据看板</button>
          <button className="tab">📚 知识库</button>
          <button className="tab">📈 报告</button>
          <button className="tab">💰 计费</button>
        </div>
      </div>
      <div className="data-content">
        <div className="dashboard">
          <div className="stat-cards">
            <div className="stat-card">
              <div className="stat-icon">🛰️</div>
              <div className="stat-info">
                <div className="stat-value">27,000+</div>
                <div className="stat-label">卫星总数</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📡</div>
              <div className="stat-info">
                <div className="stat-value">10,000+</div>
                <div className="stat-label">活跃卫星</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📚</div>
              <div className="stat-info">
                <div className="stat-value">3</div>
                <div className="stat-label">知识库</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🤖</div>
              <div className="stat-info">
                <div className="stat-value">4</div>
                <div className="stat-label">AI 模型</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// 登录页面
// ============================================

function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await api.login(email, password)
    if (result.success) {
      api.setToken(result.data!.token)
      const meResult = await api.getMe()
      if (meResult.success) {
        onLogin(meResult.data as User)
      }
    } else {
      setError(result.error || '登录失败')
    }

    setLoading(false)
  }

  const handleDevLogin = () => {
    onLogin(DEV_USER)
  }

  return (
    <div className="login-page">
      <form onSubmit={handleSubmit}>
        <div className="login-logo">
          <span className="aoe">AOE</span>{' '}
          <span className="code">Code</span>
        </div>
        <h1>太空数据分析平台</h1>
        {error && <div className="error">{error}</div>}
        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? '登录中...' : '登录'}
        </button>

        <div className="login-divider">
          <span>或</span>
        </div>

        <button type="button" className="dev-login-btn" onClick={handleDevLogin}>
          🛠️ 开发者模式（无需登录）
        </button>
      </form>
    </div>
  )
}

// ============================================
// 工具函数
// ============================================

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-logo">🔧</div>
      <div className="loading-text">
        <span className="aoe">AOE</span>{' '}
        <span className="code">Code</span> Desktop
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

export default App