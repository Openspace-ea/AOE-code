/**
 * Knowledge command - direct output without LLM
 */
import type { LocalCommandCall } from '../../types/command.js'
import { isOnlineModeEnabled } from '../../utils/buildConfig.js'
import {
  listLocalBases,
  getLocalBaseInfo,
} from '../../skills/bundled/knowledge/localKnowledgeLoader.js'
import {
  listBases,
  getBaseInfo,
  listFiles,
} from '../../skills/bundled/knowledge/perFileLoader.js'
import {
  getActivatedBases,
  setActivatedBases,
} from '../../skills/bundled/knowledge/knowledge.js'

export const call: LocalCommandCall = async (args) => {
  const action = args.trim().toLowerCase()

  // Handle different actions
  if (action === 'list' || action === 'ls' || action === '') {
    return listKnowledgeBases()
  }

  if (action === 'active' || action === 'activated') {
    return showActivatedBases()
  }

  if (action.startsWith('activate ')) {
    const name = args.slice(9).trim()
    return activateBase(name)
  }

  if (action.startsWith('deactivate ')) {
    const name = args.slice(11).trim()
    return deactivateBase(name)
  }

  if (action.startsWith('info ')) {
    const name = args.slice(5).trim()
    return showBaseInfo(name)
  }

  // Default: show help
  return {
    type: 'text',
    value: [
      '# 知识库命令',
      '',
      '| 命令 | 说明 |',
      '|------|------|',
      '| `/knowledge list` | 列出所有可用知识库 |',
      '| `/knowledge info <名称>` | 查看知识库详情 |',
      '| `/knowledge activate <名称>` | 激活知识库 |',
      '| `/knowledge deactivate <名称>` | 取消激活知识库 |',
      '| `/knowledge active` | 查看已激活的知识库 |',
      '| `/knowledge <关键词>` | 搜索知识库内容 |',
    ].join('\n'),
  }
}

async function listKnowledgeBases() {
  const parts: string[] = ['# 知识库列表\n']

  // 检查是否在线模式
  if (isOnlineModeEnabled()) {
    try {
      const { listBases: listOnlineBases } = await import('../../skills/bundled/knowledge/onlineClient.js')
      const { isLoggedIn } = await import('../../auth/client.js')

      const { bases, userBases } = await listOnlineBases()

      if (bases.length > 0 || (userBases && userBases.length > 0)) {
        if (bases.length > 0) {
          parts.push('## 公开知识库\n')
          for (const base of bases) {
            parts.push(`### ${base.displayName} (${base.name})`)
            if (base.description) parts.push(`- 描述：${base.description}`)
            parts.push(`- 文件数：${base.fileCount}`)
            parts.push('')
          }
        }

        if (userBases && userBases.length > 0) {
          parts.push('## 我的知识库\n')
          for (const base of userBases) {
            parts.push(`### ${base.displayName} (${base.name})`)
            if (base.description) parts.push(`- 描述：${base.description}`)
            parts.push(`- 文件数：${base.fileCount}`)
            parts.push('')
          }
        }
      } else {
        parts.push('暂无可用的在线知识库。\n')
      }

      if (!isLoggedIn()) {
        parts.push('---')
        parts.push('*登录后可访问更多知识库，使用 /login 登录*')
      }

      return { type: 'text', value: parts.join('\n') }
    } catch (err: any) {
      parts.push(`获取在线知识库失败: ${err.message}\n`)
      parts.push('回退到本地知识库...\n\n')
    }
  }

  // 本地模式：获取本地知识库
  const externalBases = listBases()
  const localBases = listLocalBases()
  const allBases = [...new Set([...externalBases, ...localBases])]

  if (allBases.length === 0) {
    return {
      type: 'text',
      value: '暂无可用的知识库。\n\n请确保知识库文件已打包到 dist/knowledge/ 目录。',
    }
  }

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
      parts.push(`- 类型：${info.kb_type || '未知'}`)
      parts.push(`- 文件数：${info.fileCount}`)
      parts.push(`- 总大小：${(info.totalSize / 1024).toFixed(1)} KB`)
      parts.push('')
      continue
    }

    // Fallback: just show name
    parts.push(`### ${kb}`)
    parts.push('')
  }

  parts.push('---')
  parts.push('使用 `/knowledge activate <名称>` 激活知识库，`/knowledge info <名称>` 查看详情。')

  return { type: 'text', value: parts.join('\n') }
}

async function showActivatedBases() {
  const activated = getActivatedBases()

  if (activated.length === 0) {
    return {
      type: 'text',
      value: '当前没有已激活的知识库。\n\n使用 `/knowledge activate <名称>` 激活知识库。',
    }
  }

  const parts: string[] = [`# 已激活的知识库（${activated.length} 个）\n`]

  for (const name of activated) {
    const info = getBaseInfo(name)
    if (info) {
      parts.push(`## ${name}`)
      if (info.description) parts.push(`- 描述：${info.description}`)
      parts.push(`- 文件数：${info.fileCount}`)
      parts.push(`- 总大小：${(info.totalSize / 1024).toFixed(1)} KB`)
      parts.push('')
    } else {
      parts.push(`## ${name}`)
      parts.push('- 状态：数据未找到')
      parts.push('')
    }
  }

  parts.push('---')
  parts.push('使用 `/knowledge deactivate <名称>` 取消激活。')

  return { type: 'text', value: parts.join('\n') }
}

async function activateBase(name: string) {
  if (!name) {
    return {
      type: 'text',
      value: '请指定知识库名称：`/knowledge activate <名称>`',
    }
  }

  const externalBases = listBases()
  const localBases = listLocalBases()
  const allBases = [...new Set([...externalBases, ...localBases])]

  const kb = allBases.find((b: string) => b.toLowerCase() === name.toLowerCase())

  if (!kb) {
    return {
      type: 'text',
      value: `未找到名为 "${name}" 的知识库。\n\n可用的知识库：${allBases.join(', ')}`,
    }
  }

  const activated = getActivatedBases()

  if (activated.includes(kb)) {
    return {
      type: 'text',
      value: `知识库 "${kb}" 已经处于激活状态。`,
    }
  }

  activated.push(kb)
  const { error } = setActivatedBases(activated)

  if (error) {
    return {
      type: 'text',
      value: `激活失败：${error.message}`,
    }
  }

  return {
    type: 'text',
    value: `已激活知识库 "${kb}"。\n使用 \`/knowledge active\` 查看所有已激活的知识库。`,
  }
}

async function deactivateBase(name: string) {
  if (!name) {
    return {
      type: 'text',
      value: '请指定知识库名称：`/knowledge deactivate <名称>`',
    }
  }

  const activated = getActivatedBases()
  const match = activated.find((b: string) => b.toLowerCase() === name.toLowerCase())

  if (!match) {
    return {
      type: 'text',
      value: `知识库 "${name}" 未在激活列表中。\n当前已激活：${activated.length > 0 ? activated.join(', ') : '无'}`,
    }
  }

  const updated = activated.filter((b: string) => b !== match)
  const { error } = setActivatedBases(updated)

  if (error) {
    return {
      type: 'text',
      value: `取消激活失败：${error.message}`,
    }
  }

  return {
    type: 'text',
    value: `已取消激活知识库 "${match}"。`,
  }
}

async function showBaseInfo(name: string) {
  if (!name) {
    return {
      type: 'text',
      value: '请指定知识库名称：`/knowledge info <名称>`',
    }
  }

  // Try local knowledge loader first
  const localBases = listLocalBases()
  const localKb = localBases.find(b => b.toLowerCase() === name.toLowerCase())

  if (localKb) {
    const info = getLocalBaseInfo(localKb)
    if (!info) {
      return {
        type: 'text',
        value: `未找到名为 "${name}" 的知识库。`,
      }
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

    return { type: 'text', value: parts.join('\n') }
  }

  // Try per-file loader
  const externalBases = listBases()
  const kb = externalBases.find((b: string) => b.toLowerCase() === name.toLowerCase())

  if (kb) {
    const info = getBaseInfo(kb)
    if (!info) {
      return {
        type: 'text',
        value: `未找到名为 "${name}" 的知识库。`,
      }
    }

    const parts: string[] = []
    parts.push(`# ${kb}\n`)

    // 显示知识库概要
    if (info.description) {
      parts.push('## 知识库概要\n')
      parts.push(info.description)
      parts.push('')
    }

    // 显示基本信息
    parts.push('## 基本信息\n')
    const typeLabels: Record<string, string> = {
      'data': '数据型',
      'domain': '领域型',
      'company': '企业型',
      'overview': '概览型',
    }
    parts.push(`- **类型**：${typeLabels[info.kb_type] || info.kb_type || '未知'}`)
    parts.push(`- **文件数**：${info.fileCount}`)
    parts.push(`- **总大小**：${(info.totalSize / 1024).toFixed(1)} KB`)
    parts.push('')
    parts.push('---')
    parts.push('使用 `/knowledge activate ' + kb + '` 激活此知识库。')

    return { type: 'text', value: parts.join('\n') }
  }

  // Not found
  const allBases = [...new Set([...externalBases, ...localBases])]
  return {
    type: 'text',
    value: `未找到名为 "${name}" 的知识库。\n\n可用的知识库：${allBases.join(', ')}`,
  }
}
