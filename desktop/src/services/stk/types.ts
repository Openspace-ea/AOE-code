/**
 * STK 相关类型定义
 */

export interface STKConnectionConfig {
  type: 'com' | 'rest' | 'mock'
  host: string
  port: number
}

export interface STKScenario {
  name: string
  startTime: string
  stopTime: string
  objects: STKObject[]
}

export interface STKObject {
  name: string
  type: 'satellite' | 'facility' | 'target' | 'area'
  properties: Record<string, any>
}

export interface STKSatelliteInfo {
  name: string
  noradId: string
  orbitType: 'LEO' | 'MEO' | 'GEO' | 'HEO'
  altitude: number
  inclination: number
  period: number
}

export interface STKAccessResult {
  satellite: string
  target: string
  accesses: STKAccessWindow[]
  totalDuration: number
}

export interface STKAccessWindow {
  start: string
  stop: string
  duration: number
  maxElevation: number
}

export interface STKCoverageResult {
  satellite: string
  region: string
  percentage: number
  avgDuration: number
  minGap: number
  maxGap: number
  gridPoints: STKGridPoint[]
}

export interface STKGridPoint {
  latitude: number
  longitude: number
  coveragePercent: number
  avgDuration: number
}

export interface STKPosition {
  x: number
  y: number
  z: number
  latitude: number
  longitude: number
  altitude: number
}

export interface STKReport {
  title: string
  type: string
  generatedAt: string
  content: string
  charts: STKChart[]
}

export interface STKChart {
  title: string
  type: 'line' | 'bar' | 'scatter' | '3d'
  xLabel: string
  yLabel: string
  data: {
    x: number[]
    y: number[]
    z?: number[]
  }
}

// 自然语言解析结果
export interface ParsedNLIntent {
  action: string
  confidence: number
  objects: NLObject[]
  parameters: Record<string, any>
  timeRange?: {
    start: string
    stop: string
  }
}

export interface NLObject {
  name: string
  type: 'satellite' | 'facility' | 'region'
  identifier?: string // NORAD ID 或坐标
}

// 执行状态
export interface ExecutionStatus {
  planId: string
  status: 'planning' | 'executing' | 'completed' | 'failed'
  steps: ExecutionStep[]
  currentStep: number
  progress: number // 0-100
  startTime: string
  endTime?: string
  result?: any
  error?: string
}

export interface ExecutionStep {
  id: string
  description: string
  command: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime?: string
  endTime?: string
  result?: any
  error?: string
}