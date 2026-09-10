import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const LOG_DIR = join(homedir(), '.aoe', 'logs')
const LOG_FILE = join(LOG_DIR, 'debug.log')

/**
 * 判断是否启用了调试模式
 *
 * 调试模式开启方式：
 * - 设置环境变量 AOE_DEBUG=1 / true / yes
 * - NODE_ENV=development 时默认开启
 */
export function isDebugEnabled(): boolean {
  const envDebug = process.env.AOE_DEBUG
  if (envDebug) {
    const lower = envDebug.toLowerCase()
    return lower === '1' || lower === 'true' || lower === 'yes'
  }

  return process.env.NODE_ENV === 'development'
}

/**
 * 获取调试日志文件路径
 */
export function getDebugLogPath(): string {
  return LOG_FILE
}

/**
 * 写入调试日志
 *
 * 当日志目录不存在时自动创建。日志格式：[ISO时间] [标签] 消息
 */
export function debugLog(label: string, message: string): void {
  const timestamp = new Date().toISOString()
  const logLine = `[${timestamp}] [${label}] ${message}`

  try {
    mkdirSync(LOG_DIR, { recursive: true })
    appendFileSync(LOG_FILE, logLine + '\n')
  } catch {
    // 忽略写入错误，避免日志系统本身导致崩溃
  }
}

/**
 * 写入对象调试日志
 *
 * 将对象序列化为格式化的 JSON 后写入日志
 */
export function debugLogObject(label: string, obj: unknown): void {
  try {
    const message = JSON.stringify(obj, null, 2)
    debugLog(label, message)
  } catch {
    debugLog(label, '[无法序列化的对象]')
  }
}

/**
 * 在调试模式下写入日志
 *
 * 只有 isDebugEnabled() 返回 true 时才会写入
 */
export function debug(label: string, message: string): void {
  if (isDebugEnabled()) {
    debugLog(label, message)
  }
}

/**
 * 在调试模式下写入对象日志
 */
export function debugObject(label: string, obj: unknown): void {
  if (isDebugEnabled()) {
    debugLogObject(label, obj)
  }
}
