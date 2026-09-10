/**
 * STK 配置
 */

export interface STKConfig {
  // 连接类型
  connectionType: 'com' | 'rest' | 'mock'

  // REST API 配置
  host: string
  port: number

  // COM 配置
  comProgId: string // STK COM ProgID，如 'STK11.Application'

  // 自动连接
  autoConnect: boolean

  // 默认场景时间范围（小时）
  defaultTimeRange: number

  // 轨道传播器
  propagator: 'sgp4' | 'hpop' | 'j2'
}

// 默认配置
export const defaultSTKConfig: STKConfig = {
  connectionType: 'mock', // 默认使用 mock，安装 STK 后改为 'com'
  host: 'localhost',
  port: 5001,
  comProgId: 'STK12.Application', // 根据 STK 版本调整
  autoConnect: false,
  defaultTimeRange: 24,
  propagator: 'sgp4'
}

// STK 版本对应的 ProgID
export const STK_VERSIONS: Record<string, string> = {
  'STK 12': 'STK12.Application',
  'STK 11': 'STK11.Application',
  'STK 10': 'STK10.Application',
}

// 配置文件路径
export const CONFIG_FILE = 'stk-config.json'

// 从本地存储加载配置
export function loadSTKConfig(): STKConfig {
  try {
    const saved = localStorage.getItem('stk-config')
    if (saved) {
      return { ...defaultSTKConfig, ...JSON.parse(saved) }
    }
  } catch {}
  return defaultSTKConfig
}

// 保存配置到本地存储
export function saveSTKConfig(config: STKConfig): void {
  localStorage.setItem('stk-config', JSON.stringify(config))
}

// 卫星名称到 NORAD ID 的映射
export const SATELLITE_MAP: Record<string, string> = {
  // 空间站
  'iss': '25544',
  '国际空间站': '25544',
  '天宫': '48274',
  '天宫空间站': '48274',
  'tiangong': '48274',

  // 星座
  'starlink': 'STARLINK',
  '星链': 'STARLINK',
  'oneweb': 'ONEWEB',
  '北斗': 'BEIDOU',
  'beidou': 'BEIDOU',
  'gps': 'GPS',
  'glonass': 'GLONASS',
  'galileo': 'GALILEO',
}

// 常用地面站
export const GROUND_STATIONS: Record<string, { lat: number, lon: number, alt: number }> = {
  '北京': { lat: 39.9042, lon: 116.4074, alt: 0.050 },
  '上海': { lat: 31.2304, lon: 121.4737, alt: 0.004 },
  '西安': { lat: 34.3416, lon: 108.9398, alt: 0.405 },
  '酒泉': { lat: 40.9675, lon: 100.2861, alt: 1.100 },
  '西昌': { lat: 28.2467, lon: 101.9534, alt: 1.500 },
  '文昌': { lat: 19.6145, lon: 110.9510, alt: 0.010 },
  'beijing': { lat: 39.9042, lon: 116.4074, alt: 0.050 },
  'shanghai': { lat: 31.2304, lon: 121.4737, alt: 0.004 },
}

// 常见分析区域
export const ANALYSIS_REGIONS: Record<string, { lat: number, lon: number, radius: number }> = {
  '中国': { lat: 35.0, lon: 105.0, radius: 2500 },
  '亚太': { lat: 20.0, lon: 110.0, radius: 5000 },
  '北美': { lat: 40.0, lon: -100.0, radius: 3000 },
  '欧洲': { lat: 50.0, lon: 10.0, radius: 2000 },
  'china': { lat: 35.0, lon: 105.0, radius: 2500 },
  'asia': { lat: 20.0, lon: 110.0, radius: 5000 },
}

// 解析卫星名称为 NORAD ID
export function resolveSatelliteId(name: string): string {
  const lower = name.toLowerCase()
  return SATELLITE_MAP[lower] || name
}

// 解析地面站坐标
export function resolveGroundStation(name: string): { lat: number, lon: number, alt: number } | null {
  const lower = name.toLowerCase()
  return GROUND_STATIONS[lower] || null
}

// 解析分析区域
export function resolveAnalysisRegion(name: string): { lat: number, lon: number, radius: number } | null {
  const lower = name.toLowerCase()
  return ANALYSIS_REGIONS[lower] || null
}