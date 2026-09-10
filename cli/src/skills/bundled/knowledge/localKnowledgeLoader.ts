/**
 * 本地知识库加载器 - 加载项目目录下的明文知识库
 *
 * 支持从项目根目录的 knowledge/ 目录加载未加密的知识库
 * 知识库结构：
 *   knowledge/<知识库名>/
 *   ├── kb_meta.json        # 元数据
 *   ├── INDEX.md            # 索引
 *   ├── overview.md         # 概览
 *   ├── knowledge_points.jsonl  # 知识点（可选）
 *   ├── wiki/               # 文档目录
 *   │   ├── tree.jsonl
 *   │   └── documents/
 *   └── source/             # 原始数据（可选）
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { getCwd } from '../../../utils/cwd.js'

interface LocalKBMeta {
  name: string
  kb_type?: string
  index_summary?: string
  doc_count?: number
  record_count?: number
  source_format?: string
}

interface LocalKBInfo {
  name: string
  description: string
  fileCount: number
  totalSize: number
  meta: LocalKBMeta
  basePath: string
}

// 缓存
const knowledgeBasesCache = new Map<string, LocalKBInfo>()
const fileCache = new Map<string, string>()
let lastScanTime = 0
const SCAN_TTL = 30 * 1000 // 30秒重新扫描

/**
 * 获取项目知识库目录路径
 * 优先级：
 * 1. 用户配置目录 ~/.aoe/knowledge/（全局知识库，最高优先级）
 * 2. 可执行文件所在目录下的 knowledge/（打包后分发的知识库）
 * 3. 当前工作目录下的 knowledge/（项目级知识库）
 */
function getKnowledgeDir(): string {
  // 1. 用户配置目录（最高优先级）
  const homeDir = process.env.HOME || process.env.USERPROFILE || ''
  if (homeDir) {
    const homeKnowledge = join(homeDir, '.aoe', 'knowledge')
    if (existsSync(homeKnowledge)) return homeKnowledge
  }

  // 2. 可执行文件所在目录（打包后）
  try {
    const execDir = process.execPath ? join(process.execPath, '..') : ''
    if (execDir) {
      const execKnowledge = join(execDir, 'knowledge')
      if (existsSync(execKnowledge)) return execKnowledge
    }
  } catch {
    // ignore
  }

  // 3. 当前工作目录
  const cwdKnowledge = join(getCwd(), 'knowledge')
  if (existsSync(cwdKnowledge)) return cwdKnowledge

  // 默认返回当前目录（即使不存在）
  return cwdKnowledge
}

/**
 * 递归列出目录下的所有文件
 */
function listFilesRecursive(dir: string, prefix: string = ''): string[] {
  const files: string[] = []

  if (!existsSync(dir)) return files

  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath, relativePath))
    } else if (entry.isFile()) {
      files.push(relativePath)
    }
  }

  return files
}

/**
 * 计算目录总大小
 */
function getDirSize(dir: string): number {
  let size = 0

  if (!existsSync(dir)) return size

  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      size += getDirSize(fullPath)
    } else if (entry.isFile()) {
      try {
        const stat = statSync(fullPath)
        size += stat.size
      } catch {
        // ignore
      }
    }
  }

  return size
}

/**
 * 扫描本地知识库
 */
function scanLocalBases(): void {
  const knowledgeDir = getKnowledgeDir()
  if (!existsSync(knowledgeDir)) return

  const now = Date.now()
  if (now - lastScanTime < SCAN_TTL) return

  knowledgeBasesCache.clear()

  try {
    const entries = readdirSync(knowledgeDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const kbName = entry.name
      const kbDir = join(knowledgeDir, kbName)
      const metaPath = join(kbDir, 'kb_meta.json')

      // 检查是否有 kb_meta.json（知识库标识文件）
      if (!existsSync(metaPath)) continue

      try {
        const metaContent = readFileSync(metaPath, 'utf-8')
        const meta: LocalKBMeta = JSON.parse(metaContent)

        const files = listFilesRecursive(kbDir)
        const totalSize = getDirSize(kbDir)

        knowledgeBasesCache.set(kbName, {
          name: kbName,
          description: meta.index_summary || meta.name || kbName,
          fileCount: files.length,
          totalSize,
          meta,
          basePath: kbDir,
        })
      } catch (err) {
        console.warn(`加载本地知识库 "${kbName}" 失败:`, err)
      }
    }

    lastScanTime = now
  } catch (err) {
    console.warn('扫描本地知识库目录失败:', err)
  }
}

/**
 * 列出所有本地知识库
 */
export function listLocalBases(): string[] {
  scanLocalBases()
  return Array.from(knowledgeBasesCache.keys())
}

/**
 * 获取本地知识库信息
 */
export function getLocalBaseInfo(kbName: string): LocalKBInfo | null {
  scanLocalBases()
  return knowledgeBasesCache.get(kbName) || null
}

/**
 * 列出本地知识库中的文件
 */
export function listLocalFiles(kbName: string): string[] {
  scanLocalBases()
  const kb = knowledgeBasesCache.get(kbName)
  if (!kb) return []

  return listFilesRecursive(kb.basePath)
}

/**
 * 获取本地知识库文件内容
 */
export function getLocalFile(kbName: string, filePath: string): string | undefined {
  const cacheKey = `${kbName}/${filePath}`

  // 检查缓存
  if (fileCache.has(cacheKey)) {
    return fileCache.get(cacheKey)
  }

  scanLocalBases()
  const kb = knowledgeBasesCache.get(kbName)
  if (!kb) return undefined

  const fullPath = join(kb.basePath, filePath)
  if (!existsSync(fullPath)) return undefined

  try {
    const content = readFileSync(fullPath, 'utf-8')
    fileCache.set(cacheKey, content)
    return content
  } catch {
    return undefined
  }
}

/**
 * 搜索本地知识库
 */
export function searchLocalKnowledge(query: string): Array<{
  kbName: string
  filePath: string
  excerpt: string
}> {
  scanLocalBases()
  const results: Array<{ kbName: string; filePath: string; excerpt: string }> = []
  const queryLower = query.toLowerCase()

  for (const [kbName, kb] of knowledgeBasesCache) {
    // 搜索知识点
    const kpPath = join(kb.basePath, 'knowledge_points.jsonl')
    if (existsSync(kpPath)) {
      try {
        const content = readFileSync(kpPath, 'utf-8')
        const lines = content.split('\n').filter(Boolean)

        for (const line of lines) {
          try {
            const point = JSON.parse(line)
            const text = `${point.title || ''} ${point.content || ''}`.toLowerCase()
            if (text.includes(queryLower)) {
              results.push({
                kbName,
                filePath: 'knowledge_points.jsonl',
                excerpt: `**${point.title}**\n${point.content}`,
              })
            }
          } catch {
            // skip malformed lines
          }
        }
      } catch {
        // ignore
      }
    }

    // 搜索概览
    const overviewPath = join(kb.basePath, 'overview.md')
    if (existsSync(overviewPath)) {
      try {
        const content = readFileSync(overviewPath, 'utf-8')
        if (content.toLowerCase().includes(queryLower)) {
          const matchIdx = content.toLowerCase().indexOf(queryLower)
          const start = Math.max(0, matchIdx - 200)
          const end = Math.min(content.length, matchIdx + 300)
          results.push({
            kbName,
            filePath: 'overview.md',
            excerpt: content.slice(start, end).trim(),
          })
        }
      } catch {
        // ignore
      }
    }

    // 搜索文档
    const files = listFilesRecursive(kb.basePath)
    for (const file of files) {
      if (!file.endsWith('.md') && !file.endsWith('.jsonl')) continue
      if (file === 'knowledge_points.jsonl' || file === 'overview.md') continue

      const content = getLocalFile(kbName, file)
      if (!content) continue

      if (content.toLowerCase().includes(queryLower)) {
        const matchIdx = content.toLowerCase().indexOf(queryLower)
        const start = Math.max(0, matchIdx - 200)
        const end = Math.min(content.length, matchIdx + 300)
        results.push({
          kbName,
          filePath: file,
          excerpt: content.slice(start, end).trim(),
        })
      }
    }
  }

  return results.slice(0, 20)
}

/**
 * 搜索指定本地知识库
 */
export function searchLocalKnowledgeInBase(kbName: string, query: string): Array<{
  filePath: string
  excerpt: string
}> {
  scanLocalBases()
  const kb = knowledgeBasesCache.get(kbName)
  if (!kb) return []

  const results: Array<{ filePath: string; excerpt: string }> = []
  const queryLower = query.toLowerCase()

  // 搜索知识点
  const kpPath = join(kb.basePath, 'knowledge_points.jsonl')
  if (existsSync(kpPath)) {
    try {
      const content = readFileSync(kpPath, 'utf-8')
      const lines = content.split('\n').filter(Boolean)

      for (const line of lines) {
        try {
          const point = JSON.parse(line)
          const text = `${point.title || ''} ${point.content || ''}`.toLowerCase()
          if (text.includes(queryLower)) {
            results.push({
              filePath: 'knowledge_points.jsonl',
              excerpt: `**${point.title}**\n${point.content}`,
            })
          }
        } catch {
          // skip malformed lines
        }
      }
    } catch {
      // ignore
    }
  }

  // 搜索概览
  const overviewPath = join(kb.basePath, 'overview.md')
  if (existsSync(overviewPath)) {
    try {
      const content = readFileSync(overviewPath, 'utf-8')
      if (content.toLowerCase().includes(queryLower)) {
        const matchIdx = content.toLowerCase().indexOf(queryLower)
        const start = Math.max(0, matchIdx - 200)
        const end = Math.min(content.length, matchIdx + 300)
        results.push({
          filePath: 'overview.md',
          excerpt: content.slice(start, end).trim(),
        })
      }
    } catch {
      // ignore
    }
  }

  // 搜索文档
  const files = listFilesRecursive(kb.basePath)
  for (const file of files) {
    if (!file.endsWith('.md') && !file.endsWith('.jsonl')) continue
    if (file === 'knowledge_points.jsonl' || file === 'overview.md') continue

    const content = getLocalFile(kbName, file)
    if (!content) continue

    if (content.toLowerCase().includes(queryLower)) {
      const matchIdx = content.toLowerCase().indexOf(queryLower)
      const start = Math.max(0, matchIdx - 200)
      const end = Math.min(content.length, matchIdx + 300)
      results.push({
        filePath: file,
        excerpt: content.slice(start, end).trim(),
      })
    }
  }

  return results.slice(0, 20)
}

/**
 * 清空本地知识库缓存
 */
export function clearLocalCache(): void {
  knowledgeBasesCache.clear()
  fileCache.clear()
  lastScanTime = 0
}
