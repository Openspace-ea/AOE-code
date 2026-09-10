/**
 * 知识库内容加载器
 *
 * 区分两种内容：
 * 1. 内置内容 (BUILTIN_KNOWLEDGE_DATA): 通用编程知识等，打包进可执行文件
 * 2. 外部知识库: 用户导入的 wiki 知识库，按文件懒加载
 */

import { createDecipheriv, scryptSync } from 'crypto'
import { gunzipSync } from 'zlib'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

// 导入按文件加载器
import {
  getFile,
  listBases,
  listFiles,
  getBaseInfo,
  searchFiles,
  preloadFiles,
  clearCache,
  getCacheStats,
} from './perFileLoader.js'

// Encryption config
const SALT_LEN = 32
const IV_LEN = 16
const TAG_LEN = 16
const KEY_LEN = 32
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1

// Skill prompt (not used by knowledge skill, kept for type compatibility)
export const SKILL_PROMPT: string = ''

// 内置知识库数据
let BUILTIN_KNOWLEDGE_DATA: string = ''

// 缓存
let builtinCache: Record<string, string> | null = null
let passphraseCache: string | null = null

// 初始化内置知识库数据
try {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)

  const builtinPath = join(__dirname, '..', '..', '..', '..', '.cache', 'build', 'builtinKnowledgeData.js')
  if (existsSync(builtinPath)) {
    const module = require(builtinPath)
    BUILTIN_KNOWLEDGE_DATA = module.BUILTIN_KNOWLEDGE_DATA || ''
  }
} catch (err) {
  console.warn('初始化内置知识库失败:', err)
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  })
}

function decrypt(packed: Buffer, key: Buffer): Buffer {
  const iv = packed.subarray(SALT_LEN, SALT_LEN + IV_LEN)
  const tag = packed.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN)
  const ciphertext = packed.subarray(SALT_LEN + IV_LEN + TAG_LEN)

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

function loadPassphrase(): string {
  if (passphraseCache) return passphraseCache

  const keyFile = join(homedir(), '.aoe', 'knowledge-key')
  let raw: string
  try {
    raw = readFileSync(keyFile, 'utf-8').trim()
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      throw new Error(`知识库密钥文件不存在: ${keyFile}\n请将 dist/knowledge-key 复制到该路径。`)
    }
    throw err
  }

  const packed = Buffer.from(raw, 'base64')
  const salt = packed.subarray(0, SALT_LEN)
  const encKey = deriveKey('AOE-USER-KEY-ENC', salt)
  const payloadBuf = decrypt(packed, encKey)
  const payload = payloadBuf.toString('utf-8')
  const pipeIdx = payload.indexOf('|')

  const passphrase = payload.slice(0, pipeIdx)
  const expires = payload.slice(pipeIdx + 1)

  if (expires && expires !== 'unlimited') {
    const expiresDate = new Date(expires)
    if (new Date() > expiresDate) {
      throw new Error(`知识库密钥已过期（有效期至 ${expires}）`)
    }
  }

  passphraseCache = passphrase
  return passphrase
}

/**
 * 加载内置知识库
 */
function loadBuiltin(): Record<string, string> {
  if (builtinCache) return builtinCache

  if (!BUILTIN_KNOWLEDGE_DATA) {
    return {}
  }

  try {
    const passphrase = loadPassphrase()
    const packed = Buffer.from(BUILTIN_KNOWLEDGE_DATA, 'base64')
    const salt = packed.subarray(0, SALT_LEN)
    const key = deriveKey(passphrase, salt)
    const compressed = decrypt(packed, key)
    const json = gunzipSync(compressed).toString('utf-8')
    builtinCache = JSON.parse(json)
    return builtinCache || {}
  } catch (err) {
    console.warn('解密内置知识库失败:', err)
    return {}
  }
}

/**
 * 获取知识库内容
 * @param key 格式:
 *   - 内置内容: "文件路径" 例如 "frontend/react-best-practices.md"
 *   - 外部知识库: "知识库名/文件路径" 例如 "基于复杂网络的体系评估/xxx.md"
 */
export function getKnowledge(key: string): string | undefined {
  // 检查是否是外部知识库引用（包含 /）
  const slashIdx = key.indexOf('/')
  if (slashIdx !== -1) {
    const baseName = key.substring(0, slashIdx)
    const fileKey = key.substring(slashIdx + 1)

    // 尝试作为外部知识库加载（按文件懒加载）
    const content = getFile(baseName, fileKey)
    if (content) {
      return content
    }
  }

  // 作为内置内容加载
  const builtin = loadBuiltin()
  return builtin[key]
}

/**
 * 列出所有可用的知识库
 */
export function listKnowledge(): string[] {
  const result: string[] = []

  // 内置内容
  const builtin = loadBuiltin()
  result.push(...Object.keys(builtin).map(k => `[内置] ${k}`))

  // 外部知识库
  for (const baseName of listBases()) {
    const info = getBaseInfo(baseName)
    if (info) {
      result.push(`[外部] ${baseName} (${info.fileCount} 文件, ${(info.totalSize / 1024).toFixed(1)} KB)`)
    }
  }

  return result
}

/**
 * 搜索知识库文件
 */
export function searchKnowledge(query: string): Array<{
  source: string
  path: string
  size: number
}> {
  const results: Array<{ source: string; path: string; size: number }> = []

  // 搜索内置内容
  const builtin = loadBuiltin()
  for (const path of Object.keys(builtin)) {
    if (path.toLowerCase().includes(query.toLowerCase())) {
      results.push({
        source: '内置',
        path,
        size: builtin[path].length,
      })
    }
  }

  // 搜索外部知识库
  const externalResults = searchFiles(query)
  for (const { kbName, filePath, size } of externalResults) {
    results.push({
      source: kbName,
      path: filePath,
      size,
    })
  }

  return results
}

/**
 * 预加载外部知识库文件
 */
export function preloadKnowledge(requests: Array<{ kbName: string; filePath: string }>): void {
  preloadFiles(requests)
}

/**
 * 清空缓存
 */
export function clearKnowledgeCache(): void {
  builtinCache = null
  clearCache()
}

/**
 * 获取缓存统计
 */
export function getKnowledgeCacheStats() {
  const fileStats = getCacheStats()
  return {
    builtinLoaded: builtinCache !== null,
    ...fileStats,
  }
}

/**
 * 列出外部知识库
 */
export function listExternalBases(): string[] {
  return listBases()
}

/**
 * 列出外部知识库中的文件
 */
export function listExternalFiles(kbName: string): string[] {
  return listFiles(kbName)
}

/**
 * 获取外部知识库信息
 */
export function getExternalBaseInfo(kbName: string) {
  return getBaseInfo(kbName)
}

// 兼容旧接口
export const DOMAIN_KNOWLEDGE = new Proxy({} as Record<string, string>, {
  get(_, prop: string) {
    // 先查内置内容
    const builtin = loadBuiltin()
    const patterns = [
      `frontend/${prop}-best-practices.md`,
      `backend/${prop}.md`,
      `data-science/${prop}.md`,
      `devops/${prop}.md`,
      `frontend/${prop}.md`,
    ]

    for (const pattern of patterns) {
      if (builtin[pattern]) return builtin[pattern]
    }

    // 尝试在外部知识库中查找
    for (const baseName of listBases()) {
      const files = listFiles(baseName)
      for (const file of files) {
        if (file.includes(prop)) {
          const content = getFile(baseName, file)
          if (content) return content
        }
      }
    }

    return undefined
  },
})

export const TOOL_KNOWLEDGE = new Proxy({} as Record<string, string>, {
  get(_, prop: string) {
    const builtin = loadBuiltin()
    const key = `tools/${prop}.md`
    if (builtin[key]) return builtin[key]

    // 尝试在外部知识库中查找
    for (const baseName of listBases()) {
      const content = getFile(baseName, `tools/${prop}.md`)
      if (content) return content
    }

    return undefined
  },
})

export const TEMPLATES = new Proxy({} as Record<string, string>, {
  get(_, prop: string) {
    const builtin = loadBuiltin()
    const key = `templates/${prop}.md`
    if (builtin[key]) return builtin[key]

    // 尝试在外部知识库中查找
    for (const baseName of listBases()) {
      const content = getFile(baseName, `templates/${prop}.md`)
      if (content) return content
    }

    return undefined
  },
})
