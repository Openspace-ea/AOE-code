import { readFile, readdir } from 'fs/promises'
import { registerBundledSkill } from '../../bundledSkills.js'
import {
  getInitialSettings,
  updateSettingsForSource,
} from '../../../utils/settings/settings.js'
import {
  listLocalBases,
  getLocalBaseInfo,
  listLocalFiles,
  getLocalFile,
  searchLocalKnowledge,
  searchLocalKnowledgeInBase,
} from './localKnowledgeLoader.js'
import { queryCsv, formatQueryResult } from './csvQuery.js'

type SkillContent = typeof import('./knowledgeContent.js')

/**
 * Detect wiki knowledge bases by checking for INDEX.md and kb_meta.json
 */
function detectWikiBases(fileMap: Record<string, string>): string[] {
  const bases: string[] = []
  const dirs = new Set(
    Object.keys(fileMap)
      .filter(f => f.includes('/'))
      .map(f => f.split('/')[0]),
  )

  for (const dir of dirs) {
    if (fileMap[`${dir}/INDEX.md`] || fileMap[`${dir}/kb_meta.json`]) {
      bases.push(dir)
    }
  }
  return bases
}

/**
 * Search knowledge points JSONL for relevant content
 */
function searchKnowledgePoints(
  jsonl: string,
  query: string,
): Array<{ title: string; content: string; importance: string }> {
  const results: Array<{ title: string; content: string; importance: string }> = []
  const lines = jsonl.split('\n').filter(Boolean)
  const queryLower = query.toLowerCase()

  for (const line of lines) {
    try {
      const point = JSON.parse(line)
      const text = `${point.title || ''} ${point.content || ''}`.toLowerCase()
      if (text.includes(queryLower)) {
        results.push({
          title: point.title,
          content: point.content,
          importance: point.importance || 'p2',
        })
      }
    } catch {
      /* skip malformed lines */
    }
  }

  // Sort by importance (p1 > p2 > p3)
  results.sort((a, b) => {
    const order: Record<string, number> = { p1: 0, p2: 1, p3: 2 }
    return (order[a.importance] ?? 9) - (order[b.importance] ?? 9)
  })

  return results.slice(0, 20) // Limit to top 20
}

/**
 * Search chapter markdown files for relevant content
 */
function searchChapters(
  fileMap: Record<string, string>,
  wikiDir: string,
  query: string,
): Array<{ path: string; excerpt: string }> {
  const results: Array<{ path: string; excerpt: string }> = []
  const queryLower = query.toLowerCase()

  for (const [path, content] of Object.entries(fileMap)) {
    if (!path.startsWith(`${wikiDir}/documents/`) || !path.includes('/chapters/'))
      continue
    if (!path.endsWith('.md')) continue

    const contentLower = content.toLowerCase()
    if (contentLower.includes(queryLower)) {
      // Extract relevant excerpt (first 500 chars around match)
      const matchIdx = contentLower.indexOf(queryLower)
      const start = Math.max(0, matchIdx - 200)
      const end = Math.min(content.length, matchIdx + 300)
      const excerpt = content.slice(start, end).trim()
      results.push({ path, excerpt })
    }
  }

  return results.slice(0, 10)
}

/**
 * Search knowledge base using per-file loader (optimized)
 * Only decrypts files that match the query
 */
function searchKnowledgeBase(
  kbName: string,
  query: string,
): Array<{ path: string; excerpt: string }> {
  // Import per-file loader
  const { listFiles, getFile } = require('./perFileLoader.js')

  const results: Array<{ path: string; excerpt: string }> = []
  const queryLower = query.toLowerCase()

  // Get file list (from unencrypted metadata)
  const files = listFiles(kbName)

  // First pass: search file names for matches
  const nameMatches = files.filter(f => f.toLowerCase().includes(queryLower))

  // Second pass: search file contents (only for name matches or if few files)
  const filesToSearch = nameMatches.length > 0 ? nameMatches : files.slice(0, 20) // Limit to 20 files

  for (const filePath of filesToSearch) {
    // Only decrypt if needed
    const content = getFile(kbName, filePath)
    if (!content) continue

    const contentLower = content.toLowerCase()
    if (contentLower.includes(queryLower)) {
      const matchIdx = contentLower.indexOf(queryLower)
      const start = Math.max(0, matchIdx - 200)
      const end = Math.min(content.length, matchIdx + 300)
      const excerpt = content.slice(start, end).trim()
      results.push({ path: filePath, excerpt })

      if (results.length >= 10) break
    }
  }

  return results
}

/**
 * Get list of activated knowledge base names from settings
 */
export function getActivatedBases(): string[] {
  const settings = getInitialSettings()
  return settings.knowledge?.activatedBases ?? []
}

/**
 * Save activated knowledge base names to user settings
 */
export function setActivatedBases(bases: string[]): { error: Error | null } {
  const settings = getInitialSettings()
  const updated = {
    ...settings,
    knowledge: {
      ...settings.knowledge,
      activatedBases: bases,
    },
  }
  return updateSettingsForSource('userSettings', updated)
}

/**
 * Build prompt for activate command
 */
function buildActivatePrompt(
  name: string,
  cache: Record<string, string>,
): string {
  // Get bases from per-file loader
  const { listBases } = require('./perFileLoader.js')
  const externalBases = listBases()

  const wikiBases = detectWikiBases(cache)
  const localBases = listLocalBases()
  const allBases = [...new Set([...wikiBases, ...externalBases, ...localBases])]
  const kb = allBases.find(b => b.toLowerCase() === name.toLowerCase())

  if (!kb) {
    return `未找到名为 "${name}" 的知识库。\n可用的知识库：${allBases.join(', ')}`
  }

  const activated = getActivatedBases()
  if (activated.includes(kb)) {
    return `知识库 "${kb}" 已经处于激活状态。`
  }

  activated.push(kb)
  const { error } = setActivatedBases(activated)
  if (error) {
    return `激活失败：${error.message}`
  }

  return `已激活知识库 "${kb}"。\n使用 \`/knowledge active\` 查看所有已激活的知识库。`
}

/**
 * Build prompt for deactivate command
 */
function buildDeactivatePrompt(
  name: string,
  cache: Record<string, string>,
): string {
  const activated = getActivatedBases()
  const match = activated.find(b => b.toLowerCase() === name.toLowerCase())

  if (!match) {
    return `知识库 "${name}" 未在激活列表中。\n当前已激活：${activated.length > 0 ? activated.join(', ') : '无'}`
  }

  const updated = activated.filter(b => b !== match)
  const { error } = setActivatedBases(updated)
  if (error) {
    return `取消激活失败：${error.message}`
  }

  return `已取消激活知识库 "${match}"。`
}

/**
 * Build prompt for active command (show activated bases)
 */
function buildActivePrompt(cache: Record<string, string>): string {
  const activated = getActivatedBases()

  if (activated.length === 0) {
    return (
      '当前没有已激活的知识库。\n\n' +
      '使用 `/knowledge activate <名称>` 激活一个 Wiki 知识库。\n' +
      '使用 `/knowledge list` 查看所有可用的知识库。'
    )
  }

  // Import per-file loader
  const { getBaseInfo } = require('./perFileLoader.js')

  const parts: string[] = [`# 已激活的知识库（${activated.length} 个）\n`]

  for (const name of activated) {
    // Try per-file loader first
    const info = getBaseInfo(name)
    if (info) {
      parts.push(`## ${name}`)
      if (info.description) parts.push(`- 描述：${info.description}`)
      parts.push(`- 文件数：${info.fileCount}`)
      parts.push(`- 总大小：${(info.totalSize / 1024).toFixed(1)} KB`)
      parts.push('')
      continue
    }

    // Fallback to cache-based metadata
    const metaKey = `${name}/kb_meta.json`
    if (cache[metaKey]) {
      try {
        const meta = JSON.parse(cache[metaKey])
        parts.push(`## ${meta.name || name}`)
        if (meta.kb_type) parts.push(`- 类型：${meta.kb_type}`)
        if (meta.doc_count) parts.push(`- 文档数：${meta.doc_count}`)
        if (meta.index_summary) parts.push(`- 概要：${meta.index_summary}`)
        parts.push('')
      } catch {
        parts.push(`## ${name}\n`)
      }
    } else {
      parts.push(`## ${name}\n- 状态：数据未找到（可能需要重新打包）\n`)
    }
  }

  parts.push('---')
  parts.push('使用 `/knowledge deactivate <名称>` 取消激活。')

  return parts.join('\n')
}

function buildListPrompt(cache: Record<string, string>): string {
  const parts: string[] = ['# 知识库列表\n']

  // Get bases from per-file loader
  const { listBases, getBaseInfo } = require('./perFileLoader.js')
  const externalBases = listBases()

  // Get local knowledge bases
  const localBases = listLocalBases()

  // Also check legacy cache-based bases
  const wikiBases = detectWikiBases(cache)
  const allBases = [...new Set([...wikiBases, ...externalBases, ...localBases])]

  if (allBases.length > 0) {
    parts.push(`共 ${allBases.length} 个知识库\n`)
    for (const kb of allBases) {
      // Try local knowledge loader first
      const localInfo = getLocalBaseInfo(kb)
      if (localInfo) {
        parts.push(`### ${kb} [本地]`)
        if (localInfo.description) parts.push(`- 描述：${localInfo.description}`)
        parts.push(`- 类型：${localInfo.meta.kb_type || '未知'}`)
        parts.push(`- 文件数：${localInfo.fileCount}`)
        if (localInfo.meta.record_count) {
          parts.push(`- 记录数：${localInfo.meta.record_count.toLocaleString()}`)
        }
        parts.push(`- 总大小：${(localInfo.totalSize / 1024).toFixed(1)} KB`)
        parts.push('')
        continue
      }

      // Try per-file loader
      const info = getBaseInfo(kb)
      if (info) {
        parts.push(`### ${kb}`)
        if (info.description) parts.push(`- 描述：${info.description}`)
        parts.push(`- 文件数：${info.fileCount}`)
        parts.push(`- 总大小：${(info.totalSize / 1024).toFixed(1)} KB`)
        parts.push('')
        continue
      }

      // Fallback to cache-based metadata
      const metaKey = `${kb}/kb_meta.json`
      if (cache[metaKey]) {
        try {
          const meta = JSON.parse(cache[metaKey])
          parts.push(`### ${kb}`)
          parts.push(`- 名称：${meta.name || kb}`)
          parts.push(`- 类型：${meta.kb_type || '未知'}`)
          parts.push(`- 文档数：${meta.doc_count || 0}`)
          if (meta.index_summary) parts.push(`- 概要：${meta.index_summary}`)
          parts.push('')
        } catch {
          parts.push(`### ${kb}\n`)
        }
      }
    }
  } else {
    parts.push('暂无可用的知识库。')
  }

  parts.push('---')
  parts.push('使用 `/knowledge activate <名称>` 激活知识库，`/knowledge info <名称>` 查看详情。')
  parts.push('使用 `/guides list` 查看领域最佳实践和工具指南。')

  return parts.join('\n')
}

function buildInfoPrompt(
  name: string,
  cache: Record<string, string>,
): string {
  // Try local knowledge loader first
  const localBases = listLocalBases()
  const localKb = localBases.find(b => b.toLowerCase() === name.toLowerCase())

  if (localKb) {
    const info = getLocalBaseInfo(localKb)
    if (!info) {
      return `未找到名为 "${name}" 的知识库。`
    }

    const parts: string[] = []
    parts.push(`# ${localKb} [本地知识库]\n`)
    if (info.description) parts.push(`- **描述**：${info.description}`)
    parts.push(`- **类型**：${info.meta.kb_type || '未知'}`)
    parts.push(`- **文件数**：${info.fileCount}`)
    if (info.meta.record_count) {
      parts.push(`- **记录数**：${info.meta.record_count.toLocaleString()}`)
    }
    if (info.meta.source_format) {
      parts.push(`- **数据格式**：${info.meta.source_format}`)
    }
    parts.push(`- **总大小**：${(info.totalSize / 1024).toFixed(1)} KB`)

    // Show file list
    const files = listLocalFiles(localKb)
    if (files.length > 0) {
      parts.push('\n## 文件列表\n')
      for (const file of files.slice(0, 30)) {
        parts.push(`- ${file}`)
      }
      if (files.length > 30) {
        parts.push(`- ... 还有 ${files.length - 30} 个文件`)
      }
    }

    // Show knowledge points summary
    const kpContent = getLocalFile(localKb, 'knowledge_points.jsonl')
    if (kpContent) {
      const lines = kpContent.split('\n').filter(Boolean)
      parts.push(`\n## 知识点统计\n`)
      parts.push(`- 总数：${lines.length}`)
      const p1Count = lines.filter(l => l.includes('"importance":"p1"')).length
      if (p1Count > 0) {
        parts.push(`- 核心知识点（p1）：${p1Count}`)
      }
      parts.push(`\n使用 \`/knowledge <关键词>\` 搜索具体知识点内容。`)
    }

    return parts.join('\n')
  }

  // Try per-file loader
  const { listBases, getBaseInfo, listFiles, getFile } = require('./perFileLoader.js')
  const externalBases = listBases()
  const kb = externalBases.find(b => b.toLowerCase() === name.toLowerCase())

  if (kb) {
    const info = getBaseInfo(kb)
    if (!info) {
      return `未找到名为 "${name}" 的知识库。`
    }

    const parts: string[] = []
    parts.push(`# ${kb}\n`)
    if (info.description) parts.push(`- **描述**：${info.description}`)
    parts.push(`- **文件数**：${info.fileCount}`)
    parts.push(`- **总大小**：${(info.totalSize / 1024).toFixed(1)} KB`)

    // Show file list
    const files = listFiles(kb)
    if (files.length > 0) {
      parts.push('\n## 文件列表\n')
      for (const file of files.slice(0, 20)) {
        parts.push(`- ${file}`)
      }
      if (files.length > 20) {
        parts.push(`- ... 还有 ${files.length - 20} 个文件`)
      }
    }

    return parts.join('\n')
  }

  // Fallback to cache-based search
  const wikiBases = detectWikiBases(cache)
  const legacyKb = wikiBases.find(b => b.toLowerCase() === name.toLowerCase())

  if (!legacyKb) {
    const parts: string[] = [`未找到名为 "${name}" 的知识库。\n`]
    const allBases = [...wikiBases, ...externalBases, ...localBases]
    if (allBases.length > 0) {
      parts.push('可用的知识库：' + allBases.join(', '))
    }
    parts.push('使用 `/guides <topic>` 加载领域最佳实践和工具指南。')
    return parts.join('\n')
  }

  const parts: string[] = []

  // Meta info
  const metaKey = `${legacyKb}/kb_meta.json`
  if (cache[metaKey]) {
    try {
      const meta = JSON.parse(cache[metaKey])
      parts.push(`# ${meta.name || legacyKb}\n`)
      parts.push(`- **类型**：${meta.kb_type || '未知'}`)
      parts.push(`- **文档数**：${meta.doc_count || 0}`)
      if (meta.index_summary) parts.push(`- **概要**：${meta.index_summary}`)
      parts.push('')
    } catch { /* ignore */ }
  }

  // Overview
  const overviewKey = `${legacyKb}/overview.md`
  if (cache[overviewKey]) {
    parts.push('## 知识领域概览\n')
    parts.push(cache[overviewKey])
  }

  // Index / table of contents
  const indexKey = `${legacyKb}/INDEX.md`
  if (cache[indexKey]) {
    parts.push('\n## 目录\n')
    parts.push(cache[indexKey])
  }

  // Knowledge points summary
  const kpKey = `${legacyKb}/knowledge_points.jsonl`
  if (cache[kpKey]) {
    const lines = cache[kpKey].split('\n').filter(Boolean)
    const p1Count = lines.filter(l => l.includes('"importance":"p1"')).length
    const p2Count = lines.filter(l => l.includes('"importance":"p2"')).length
    parts.push(`\n## 知识点统计\n`)
    parts.push(`- 总数：${lines.length}`)
    parts.push(`- 核心知识点（p1）：${p1Count}`)
    parts.push(`- 次要知识点（p2）：${p2Count}`)
    parts.push(`\n使用 \`/knowledge <关键词>\` 搜索具体知识点内容。`)
  }

  // Document list
  const treeKey = `${legacyKb}/wiki/tree.jsonl`
  if (cache[treeKey]) {
    parts.push('\n## 文档结构\n')
    const lines = cache[treeKey].split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const node = JSON.parse(line)
        if (node.type === 'document') {
          parts.push(`- **${node.title}**`)
        } else if (node.type === 'chapter') {
          parts.push(`  - ${node.title}`)
        }
      } catch { /* skip */ }
    }
  }

  return parts.join('\n')
}

function buildKnowledgePrompt(
  args: string,
  content: SkillContent,
): string {
  const parts: string[] = []
  const rawArgs = args.trim()
  const topic = rawArgs.toLowerCase()

  // Import per-file loader for optimized search
  const { listBases, getBaseInfo, listFiles, getFile } = require('./perFileLoader.js')

  // Get the full file map for wiki search
  const cache = (content as any).getCache?.() || {}
  const wikiBases = detectWikiBases(cache)

  // Note: Management commands (list, active, activate, deactivate, info)
  // are handled by the Command version (/knowledge command).
  // This Skill only handles search queries and CSV queries.

  // CSV数据查询命令
  if (topic.startsWith('query ') || topic.startsWith('q ')) {
    const queryArgs = rawArgs.replace(/^(query|q)\s+/i, '').trim()
    const parts = queryArgs.split(/\s+/)
    const kbName = parts[0]
    const query = parts.slice(1).join(' ')

    if (!kbName || !query) {
      return '用法: /knowledge query <知识库名> <查询条件>\n\n示例:\n  /knowledge query 太空轨道数据 count\n  /knowledge query 太空轨道数据 head 10\n  /knowledge query 太空轨道数据 PERIOD>100\n  /knowledge query 太空轨道数据 OBJECT_NAME~STARLINK\n\n输入 /knowledge query <知识库名> help 查看完整查询语法'
    }

    const result = queryCsv(kbName, query)
    return formatQueryResult(result)
  }

  if (topic) {
    // 1. First search activated local knowledge bases (highest priority)
    const activated = getActivatedBases()
    const localBases = listLocalBases()
    const activatedLocal = activated.filter(b => localBases.includes(b))

    if (activatedLocal.length > 0) {
      const activatedResults: string[] = []
      for (const kb of activatedLocal) {
        const results = searchLocalKnowledgeInBase(kb, topic)
        if (results.length > 0) {
          activatedResults.push(`## 已激活知识库搜索结果（${kb}）\n`)
          for (const m of results) {
            activatedResults.push(`### ${m.filePath}\n${m.excerpt}\n`)
          }
        }
      }
      if (activatedResults.length > 0) {
        parts.push(activatedResults.join('\n'))
        return parts.join('\n\n---\n\n')
      }
    }

    // 2. If no results in activated bases, search all local knowledge bases
    const localResults = searchLocalKnowledge(topic)
    if (localResults.length > 0) {
      const localParts: string[] = ['## 本地知识库搜索结果\n']
      for (const m of localResults) {
        localParts.push(`### ${m.kbName} / ${m.filePath}\n${m.excerpt}\n`)
      }
      parts.push(localParts.join('\n'))
      return parts.join('\n\n---\n\n')
    }

    // 3. Search wiki/encrypted knowledge bases
    const externalBases = listBases()
    const allBases = [...wikiBases, ...externalBases.filter(b => !wikiBases.includes(b))]

    if (allBases.length > 0) {
      const wikiResults: string[] = []

      for (const kb of allBases) {
        // Try per-file search first (optimized - only decrypts matching files)
        const perFileResults = searchKnowledgeBase(kb, topic)
        if (perFileResults.length > 0) {
          wikiResults.push(`## 搜索结果（${kb}）\n`)
          for (const m of perFileResults) {
            wikiResults.push(`### ${m.path}\n${m.excerpt}\n`)
          }
          continue
        }

        // Fallback to cache-based search for legacy format
        const kpKey = `${kb}/knowledge_points.jsonl`
        if (cache[kpKey]) {
          const matches = searchKnowledgePoints(cache[kpKey], topic)
          if (matches.length > 0) {
            wikiResults.push(`## 知识点搜索结果（${kb}）\n`)
            for (const m of matches) {
              wikiResults.push(`### ${m.title}\n${m.content}\n`)
            }
          }
        }

        const chapterMatches = searchChapters(cache, kb, topic)
        if (chapterMatches.length > 0) {
          wikiResults.push(`## 章节搜索结果（${kb}）\n`)
          for (const m of chapterMatches) {
            wikiResults.push(`### ${m.path}\n${m.excerpt}\n`)
          }
        }

        const overviewKey = `${kb}/overview.md`
        if (cache[overviewKey] && cache[overviewKey].toLowerCase().includes(topic)) {
          wikiResults.push(`## 知识领域概览（${kb}）\n${cache[overviewKey]}`)
        }
      }

      if (wikiResults.length > 0) {
        parts.push(wikiResults.join('\n\n'))
      }
    }

    if (parts.length > 0) {
      return parts.join('\n\n---\n\n')
    }

    // No match found
    parts.push(`未找到与 "${topic}" 匹配的知识。\n`)
    const allLocalBases = listLocalBases()
    if (allLocalBases.length > 0) {
      parts.push(`本地知识库：${allLocalBases.join(', ')}`)
    }
    if (wikiBases.length > 0) {
      parts.push(`Wiki 知识库：${wikiBases.join(', ')}`)
    }
    parts.push('\n使用 `/guides <topic>` 加载领域最佳实践和工具指南。')
    parts.push(
      '**项目模板：** ' + Object.keys(content.TEMPLATES).join(', '),
    )
    parts.push('\n使用 `/knowledge list` 查看所有可用知识，`/knowledge info <名称>` 查看详情。')
    return parts.join('\n')
  }

  // Show activated knowledge bases
  const activated = getActivatedBases()
  if (activated.length > 0) {
    parts.push('\n# 已激活的知识库\n')
    for (const kb of activated) {
      const metaKey = `${kb}/kb_meta.json`
      const overviewKey = `${kb}/overview.md`
      const indexKey = `${kb}/INDEX.md`
      const kpKey = `${kb}/knowledge_points.jsonl`

      if (cache[metaKey]) {
        try {
          const meta = JSON.parse(cache[metaKey])
          parts.push(`## ${meta.name || kb}\n${meta.index_summary || ''}\n`)
        } catch {
          /* ignore */
        }
      }

      if (cache[overviewKey]) {
        parts.push(cache[overviewKey])
      } else if (cache[indexKey]) {
        parts.push(cache[indexKey])
      }

      // Include top knowledge points from activated bases
      if (cache[kpKey]) {
        const lines = cache[kpKey].split('\n').filter(Boolean)
        const p1Points = lines
          .map((l: string) => { try { return JSON.parse(l) } catch { return null } })
          .filter((p: any) => p && p.importance === 'p1')
          .slice(0, 10)
        if (p1Points.length > 0) {
          parts.push(`\n### 核心知识点\n`)
          for (const p of p1Points) {
            parts.push(`- **${p.title}**：${p.content?.slice(0, 100) || ''}`)
          }
        }
      }
    }
  }

  // Show wiki knowledge base overviews (non-activated)
  const nonActivated = wikiBases.filter(b => !activated.includes(b))
  if (nonActivated.length > 0) {
    parts.push('\n# 其他可用知识库\n')
    for (const kb of nonActivated) {
      const metaKey = `${kb}/kb_meta.json`

      if (cache[metaKey]) {
        try {
          const meta = JSON.parse(cache[metaKey])
          parts.push(`## ${meta.name || kb}\n${meta.index_summary || ''}\n`)
        } catch {
          /* ignore */
        }
      }
    }
    parts.push('使用 `/knowledge activate <名称>` 激活知识库。')
  }

  if (parts.length === 0) {
    parts.push('未检测到已激活的知识库。\n')
    if (wikiBases.length > 0) {
      parts.push(`可用的 Wiki 知识库：${wikiBases.join(', ')}`)
    }
    parts.push('\n使用 `/knowledge activate <名称>` 激活知识库。')
    parts.push('使用 `/guides <topic>` 加载领域最佳实践和工具指南。')
  }

  // Always show command reference
  parts.push([
    '\n---',
    '## 可用命令',
    '| 命令 | 说明 |',
    '|------|------|',
    '| `/knowledge <topic>` | 搜索 Wiki 知识库 |',
    '| `/knowledge list` | 列出可用知识库 |',
    '| `/knowledge info <名称>` | 查看知识库详情 |',
    '| `/knowledge activate <名称>` | 激活 Wiki 知识库（自动加载） |',
    '| `/knowledge active` | 查看已激活的知识库 |',
    '| `/knowledge deactivate <名称>` | 取消激活知识库 |',
    '| `/guides <topic>` | 加载领域最佳实践和工具指南 |',
  ].join('\n'))

  return parts.join('\n\n')
}

function getKnowledgeMode(): 'online' | 'offline' {
  const settings = getInitialSettings()
  const settingsMode = settings.knowledge?.mode
  if (settingsMode) return settingsMode

  // Check build config
  try {
    const { isOnlineModeEnabled } = require('../../../utils/buildConfig.js')
    if (isOnlineModeEnabled()) return 'online'
  } catch {
    // Default to offline
  }

  return 'offline'
}

async function buildOnlinePrompt(args: string): Promise<string> {
  const { listBases, fetchBase } = await import('./onlineClient.js')
  const { isLoggedIn } = await import('../../../auth/client.js')
  const parts: string[] = []
  const rawArgs = args.trim()
  const topic = rawArgs.toLowerCase()

  // Handle special commands
  if (topic === 'list' || topic === 'ls' || !topic) {
    try {
      const { bases, userBases } = await listBases()
      parts.push('## 可用知识库\n')
      if (bases.length > 0) {
        parts.push('### 公开知识库')
        for (const base of bases) {
          parts.push(`- **${base.displayName}** (${base.name})${base.description ? ` - ${base.description}` : ''}`)
        }
      }
      if (userBases && userBases.length > 0) {
        parts.push('\n### 我的知识库')
        for (const base of userBases) {
          parts.push(`- **${base.displayName}** (${base.name})${base.description ? ` - ${base.description}` : ''}`)
        }
      }
      if (!isLoggedIn()) {
        parts.push('\n*登录后可访问更多知识库，使用 /login 登录*')
      }
    } catch (err: any) {
      parts.push(`获取知识库列表失败: ${err.message}`)
    }
    return parts.join('\n')
  }

  // Fetch specific knowledge base
  try {
    const base = await fetchBase(topic)
    parts.push(`## ${base.name}\n`)
    if (base.encrypted) {
      // Decrypt the data using offline logic
      const { decryptBase } = await import('./offlineDecrypt.js')
      const decrypted = decryptBase(base.data, base.expires)
      parts.push(decrypted)
    } else {
      parts.push(base.data)
    }
  } catch (err: any) {
    parts.push(`获取知识库失败: ${err.message}`)
  }

  return parts.join('\n')
}

export function registerKnowledgeSkill(): void {
  registerBundledSkill({
    name: 'knowledge-search',
    description:
      '搜索内置 Wiki 知识库内容。\n' +
      '适用场景：用户搜索专业知识、查询 CSV 数据。\n' +
      '管理知识库请使用 /knowledge 命令（list、activate、deactivate、info）。',
    argumentHint: '<关键词 | query 知识库名 查询条件>',
    allowedTools: ['Read', 'Grep', 'Glob'],
    userInvocable: true,
    async getPromptForCommand(args) {
      const mode = getKnowledgeMode()

      if (mode === 'online') {
        const prompt = await buildOnlinePrompt(args)
        return [{ type: 'text', text: prompt }]
      }

      // Offline mode (default)
      const content = await import('./knowledgeContent.js')
      const prompt = buildKnowledgePrompt(args, content)
      return [{ type: 'text', text: prompt }]
    },
  })
}
