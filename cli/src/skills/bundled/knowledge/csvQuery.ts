/**
 * CSV数据查询模块
 *
 * 支持对CSV文件进行简单查询
 * 语法：
 *   - 字段名=值      精确匹配
 *   - 字段名>值      大于比较（数值）
 *   - 字段名<值      小于比较（数值）
 *   - 字段名>=值     大于等于
 *   - 字段名<=值     小于等于
 *   - 字段名~值      模糊匹配（包含）
 *   - count          统计总数
 *   - head N         显示前N条
 *   - 字段名         列出该字段的所有唯一值
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getLocalFile, listLocalFiles } from './localKnowledgeLoader.js'
import { getFile as getEncryptedFile, listFiles as listEncryptedFiles, getBaseInfo } from './perFileLoader.js'

interface CsvRow {
  [key: string]: string
}

interface CsvData {
  headers: string[]
  rows: CsvRow[]
}

interface QueryResult {
  success: boolean
  message: string
  data?: CsvRow[]
  count?: number
}

// 缓存解析后的CSV数据
const csvCache = new Map<string, CsvData>()

/**
 * 解析CSV内容
 */
function parseCsv(content: string): CsvData {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  // 解析表头
  const headers = parseCsvLine(lines[0])

  // 解析数据行
  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    if (values.length === headers.length) {
      const row: CsvRow = {}
      headers.forEach((header, index) => {
        row[header] = values[index]
      })
      rows.push(row)
    }
  }

  return { headers, rows }
}

/**
 * 解析CSV行（处理引号内的逗号）
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // 转义的引号
        current += '"'
        i++
      } else {
        // 切换引号状态
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // 字段分隔
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // 添加最后一个字段
  result.push(current.trim())

  return result
}

/**
 * 获取或加载CSV数据
 * 优先从本地加载，如果没有则从加密知识库加载
 */
function getCsvData(kbName: string, csvPath: string): CsvData | null {
  const cacheKey = `${kbName}/${csvPath}`

  if (csvCache.has(cacheKey)) {
    return csvCache.get(cacheKey)!
  }

  // 1. 尝试从本地加载
  let content = getLocalFile(kbName, csvPath)

  // 2. 尝试从加密知识库加载
  if (!content) {
    content = getEncryptedFile(kbName, csvPath)
  }

  if (!content) return null

  const data = parseCsv(content)
  csvCache.set(cacheKey, data)
  return data
}

/**
 * 查找知识库中的CSV文件
 */
function findCsvFiles(kbName: string): string[] {
  // 1. 尝试从本地获取文件列表
  const localFiles = listLocalFiles(kbName)
  if (localFiles.length > 0) {
    return localFiles.filter(f => f.endsWith('.csv'))
  }

  // 2. 尝试从加密知识库获取文件列表
  const encryptedFiles = listEncryptedFiles(kbName)
  return encryptedFiles.filter(f => f.endsWith('.csv'))
}

/**
 * 解析查询条件
 */
function parseQuery(query: string): {
  type: 'filter' | 'count' | 'head' | 'distinct' | 'help'
  field?: string
  operator?: '=' | '>' | '<' | '>=' | '<=' | '~'
  value?: string
  limit?: number
} {
  const trimmed = query.trim()

  // count 命令
  if (trimmed.toLowerCase() === 'count') {
    return { type: 'count' }
  }

  // help 命令
  if (trimmed.toLowerCase() === 'help' || trimmed === '?') {
    return { type: 'help' }
  }

  // head N 命令
  const headMatch = trimmed.match(/^head\s+(\d+)$/i)
  if (headMatch) {
    return { type: 'head', limit: parseInt(headMatch[1]) }
  }

  // 比较操作符
  const compareMatch = trimmed.match(/^(\w+)\s*(>=|<=|>|<|=|~)\s*(.+)$/)
  if (compareMatch) {
    return {
      type: 'filter',
      field: compareMatch[1].toUpperCase(),
      operator: compareMatch[2] as '=' | '>' | '<' | '>=' | '<=' | '~',
      value: compareMatch[3].trim(),
    }
  }

  // 字段名（列出唯一值）
  if (/^\w+$/.test(trimmed)) {
    return { type: 'distinct', field: trimmed.toUpperCase() }
  }

  // 默认作为模糊搜索
  return { type: 'filter', field: '*', operator: '~', value: trimmed }
}

/**
 * 执行查询
 */
export function queryCsv(
  kbName: string,
  query: string,
  csvPath?: string,
): QueryResult {
  // 查找CSV文件
  const csvFiles = csvPath ? [csvPath] : findCsvFiles(kbName)

  if (csvFiles.length === 0) {
    return {
      success: false,
      message: `知识库 "${kbName}" 中没有找到CSV文件`,
    }
  }

  // 使用第一个CSV文件（或指定的文件）
  const targetFile = csvFiles[0]
  const data = getCsvData(kbName, targetFile)

  if (!data) {
    return {
      success: false,
      message: `无法读取CSV文件: ${targetFile}`,
    }
  }

  // 解析查询
  const parsed = parseQuery(query)

  // 执行查询
  switch (parsed.type) {
    case 'count':
      return {
        success: true,
        message: `共 ${data.rows.length} 条记录`,
        count: data.rows.length,
      }

    case 'head':
      const limit = parsed.limit || 10
      return {
        success: true,
        message: `显示前 ${Math.min(limit, data.rows.length)} 条记录`,
        data: data.rows.slice(0, limit),
      }

    case 'distinct':
      if (!parsed.field || !data.headers.includes(parsed.field)) {
        return {
          success: false,
          message: `字段 "${parsed.field}" 不存在。可用字段: ${data.headers.join(', ')}`,
        }
      }
      const uniqueValues = [...new Set(data.rows.map(r => r[parsed.field!]))]
      return {
        success: true,
        message: `字段 "${parsed.field}" 有 ${uniqueValues.length} 个唯一值`,
        data: uniqueValues.slice(0, 50).map(v => ({ [parsed.field!]: v })),
      }

    case 'filter':
      return executeFilter(data, parsed.field!, parsed.operator!, parsed.value!)

    case 'help':
      return {
        success: true,
        message: getHelpText(),
      }

    default:
      return {
        success: false,
        message: '无法解析查询',
      }
  }
}

/**
 * 执行过滤查询
 */
function executeFilter(
  data: CsvData,
  field: string,
  operator: string,
  value: string,
): QueryResult {
  // 全字段模糊搜索
  if (field === '*') {
    const results = data.rows.filter(row =>
      Object.values(row).some(v => v.toLowerCase().includes(value.toLowerCase())),
    )
    return {
      success: true,
      message: `找到 ${results.length} 条匹配记录`,
      data: results.slice(0, 50),
    }
  }

  // 检查字段是否存在
  if (!data.headers.includes(field)) {
    return {
      success: false,
      message: `字段 "${field}" 不存在。可用字段: ${data.headers.join(', ')}`,
    }
  }

  // 执行过滤
  let results: CsvRow[] = []

  switch (operator) {
    case '=':
      results = data.rows.filter(row => row[field] === value)
      break

    case '~':
      results = data.rows.filter(row =>
        row[field].toLowerCase().includes(value.toLowerCase()),
      )
      break

    case '>':
      results = data.rows.filter(row => {
        const num = parseFloat(row[field])
        const target = parseFloat(value)
        return !isNaN(num) && !isNaN(target) && num > target
      })
      break

    case '<':
      results = data.rows.filter(row => {
        const num = parseFloat(row[field])
        const target = parseFloat(value)
        return !isNaN(num) && !isNaN(target) && num < target
      })
      break

    case '>=':
      results = data.rows.filter(row => {
        const num = parseFloat(row[field])
        const target = parseFloat(value)
        return !isNaN(num) && !isNaN(target) && num >= target
      })
      break

    case '<=':
      results = data.rows.filter(row => {
        const num = parseFloat(row[field])
        const target = parseFloat(value)
        return !isNaN(num) && !isNaN(target) && num <= target
      })
      break

    default:
      return {
        success: false,
        message: `不支持的操作符: ${operator}`,
      }
  }

  return {
    success: true,
    message: `找到 ${results.length} 条匹配记录`,
    data: results.slice(0, 50),
  }
}

/**
 * 获取帮助文本
 */
function getHelpText(): string {
  return `CSV查询语法：

  count                   统计总记录数
  head N                  显示前N条记录
  字段名                   列出该字段的所有唯一值
  字段名=值                精确匹配
  字段名~值                模糊匹配（包含）
  字段名>值                大于（数值）
  字段名<值                小于（数值）
  字段名>=值               大于等于
  字段名<=值               小于等于
  关键词                   全字段模糊搜索

示例：
  count                   查看总记录数
  head 10                 查看前10条
  OBJECT_NAME~STARLINK    查找名称包含STARLINK的
  PERIOD>100              查找周期大于100的
  INCLINATION<30          查找倾角小于30度的
  NORAD_CAT_ID=25544      查找NORAD编号为25544的`
}

/**
 * 格式化查询结果为文本
 */
export function formatQueryResult(result: QueryResult, maxRows: number = 20): string {
  if (!result.success) {
    return `❌ ${result.message}`
  }

  const parts: string[] = [`✅ ${result.message}`]

  if (result.count !== undefined) {
    return parts.join('\n')
  }

  if (result.data && result.data.length > 0) {
    // 获取所有字段名
    const headers = Object.keys(result.data[0])

    // 计算每列最大宽度
    const widths: Record<string, number> = {}
    headers.forEach(h => {
      widths[h] = Math.max(
        h.length,
        ...result.data!.slice(0, maxRows).map(row => (row[h] || '').length),
      )
    })

    // 生成表头
    const headerLine = headers.map(h => h.padEnd(widths[h])).join(' | ')
    const separator = headers.map(h => '-'.repeat(widths[h])).join('-+-')

    parts.push('')
    parts.push(headerLine)
    parts.push(separator)

    // 生成数据行
    const displayRows = result.data.slice(0, maxRows)
    for (const row of displayRows) {
      const line = headers.map(h => (row[h] || '').padEnd(widths[h])).join(' | ')
      parts.push(line)
    }

    if (result.data.length > maxRows) {
      parts.push(`\n... 还有 ${result.data.length - maxRows} 条记录`)
    }
  }

  return parts.join('\n')
}

/**
 * 清空CSV缓存
 */
export function clearCsvCache(): void {
  csvCache.clear()
}
