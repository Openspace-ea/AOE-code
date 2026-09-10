/**
 * STK 设置组件
 * 用于配置 STK 连接
 */

import React, { useState, useEffect } from 'react'
import { loadSTKConfig, saveSTKConfig, STKConfig, defaultSTKConfig, STK_VERSIONS } from '../../services/stk/config'

interface STKSetupProps {
  onConnect: (config: STKConfig) => void
}

export function STKSetup({ onConnect }: STKSetupProps) {
  const [config, setConfig] = useState<STKConfig>(defaultSTKConfig)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    const saved = loadSTKConfig()
    setConfig(saved)
  }, [])

  const handleSave = () => {
    saveSTKConfig(config)
    onConnect(config)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      // 测试连接
      if (config.connectionType === 'com') {
        // 通过 Electron IPC 测试 COM 连接
        const result = await window.electronAPI.invoke('stk:test-com', config.comProgId)
        setTestResult(result.success ? '连接成功！' : `连接失败: ${result.error}`)
      } else if (config.connectionType === 'rest') {
        // 测试 REST API
        const response = await fetch(`http://${config.host}:${config.port}/api/health`)
        setTestResult(response.ok ? '连接成功！' : '连接失败: 服务不可用')
      } else {
        setTestResult('Mock 模式 - 无需测试')
      }
    } catch (err) {
      setTestResult(`测试失败: ${err}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="stk-setup">
      <h3>🔧 STK 连接设置</h3>

      <div className="form-section">
        <h4>连接类型</h4>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              value="com"
              checked={config.connectionType === 'com'}
              onChange={() => setConfig({ ...config, connectionType: 'com' })}
            />
            <span>COM API (Windows 本地)</span>
          </label>
          <label>
            <input
              type="radio"
              value="rest"
              checked={config.connectionType === 'rest'}
              onChange={() => setConfig({ ...config, connectionType: 'rest' })}
            />
            <span>REST API (远程/跨平台)</span>
          </label>
          <label>
            <input
              type="radio"
              value="mock"
              checked={config.connectionType === 'mock'}
              onChange={() => setConfig({ ...config, connectionType: 'mock' })}
            />
            <span>Mock 模式 (开发测试)</span>
          </label>
        </div>
      </div>

      {config.connectionType === 'com' && (
        <div className="form-section">
          <h4>COM 配置</h4>
          <div className="form-group">
            <label>STK 版本</label>
            <select
              value={config.comProgId}
              onChange={e => setConfig({ ...config, comProgId: e.target.value })}
            >
              {Object.entries(STK_VERSIONS).map(([name, progId]) => (
                <option key={progId} value={progId}>{name}</option>
              ))}
            </select>
          </div>
          <p className="help-text">
            确保 STK 已安装并启用 COM API
          </p>
        </div>
      )}

      {config.connectionType === 'rest' && (
        <div className="form-section">
          <h4>REST API 配置</h4>
          <div className="form-group">
            <label>主机地址</label>
            <input
              type="text"
              value={config.host}
              onChange={e => setConfig({ ...config, host: e.target.value })}
              placeholder="localhost"
            />
          </div>
          <div className="form-group">
            <label>端口</label>
            <input
              type="number"
              value={config.port}
              onChange={e => setConfig({ ...config, port: parseInt(e.target.value) })}
              placeholder="5001"
            />
          </div>
        </div>
      )}

      <div className="form-section">
        <h4>默认设置</h4>
        <div className="form-group">
          <label>默认时间范围（小时）</label>
          <input
            type="number"
            value={config.defaultTimeRange}
            onChange={e => setConfig({ ...config, defaultTimeRange: parseInt(e.target.value) })}
          />
        </div>
        <div className="form-group">
          <label>轨道传播器</label>
          <select
            value={config.propagator}
            onChange={e => setConfig({ ...config, propagator: e.target.value as any })}
          >
            <option value="sgp4">SGP4 (TLE 推荐)</option>
            <option value="hpop">HPOP (高精度)</option>
            <option value="j2">J2 (中等精度)</option>
          </select>
        </div>
      </div>

      <div className="form-actions">
        <button className="btn-secondary" onClick={handleTest} disabled={testing}>
          {testing ? '测试中...' : '测试连接'}
        </button>
        <button className="btn-primary" onClick={handleSave}>
          保存并连接
        </button>
      </div>

      {testResult && (
        <div className={`test-result ${testResult.includes('成功') ? 'success' : 'error'}`}>
          {testResult}
        </div>
      )}
    </div>
  )
}

export default STKSetup