/**
 * 分文件知识库加载器 - 按需解密
 *
 * 特点：
 * 1. 只解密需要的文件
 * 2. LRU 缓存限制内存占用
 * 3. 支持大知识库 (100MB+)
 */

import { createDecipheriv, scryptSync } from 'crypto'
import { gunzipSync } from 'zlib'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

// Encryption config (must match pack-knowledge-split.ts)
const SALT_LEN = 32
const IV_LEN = 16
const TAG_LEN = 16
const KEY_LEN = 32
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1

// LRU 缓存配置
const MAX_CACHE_SIZE = 100  // 最多缓存 100 个文件
const CACHE_TTL = 10 * 60 * 1000  // 10 分钟过期

interface CacheEntry {
  content: string
  timestamp: number
}

// 缓存
const fileCache = new Map<string, CacheEntry>()
const accessOrder: string[] = []

// 索引缓存
let indexCache: Record<string, string> | null = null

// 密钥缓存
let passphraseCache: string | null = null

// 知识库路径
let KNOWLEDGE_DIR = ''
let INDEX_FILE = ''

function initPaths() {
  if (KNOWLEDGE_DIR) return

  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const pathsPath = join(__dirname, '..', '..', '..', '..', '.cache', 'build', 'knowledgePaths.js')

    if (existsSync(pathsPath)) {
      const paths = require(pathsPath)
      INDEX_FILE = paths.KNOWLEDGE_INDEX_PATH
      KNOWLEDGE_DIR = paths.KNOWLEDGE_DIR
    }
  } catch (err) {
    console.warn('初始化知识库路径失败:', err)
  }
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
  if (passphraseCache) {
    return passphraseCache
  }

  const keyFile = join(homedir(), '.aoe', 'knowledge-key')
  let raw: string
  try {
    raw = readFileSync(keyFile, 'utf-8').trim()
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `知识库密钥文件不存在: ${keyFile}\n` +
        `请将 dist/knowledge-key 复制到该路径。`
      )
    }
    throw err
  }

  const packed = Buffer.from(raw, 'base64')
  if (packed.length < SALT_LEN + IV_LEN + TAG_LEN + 1) {
    throw new Error('知识库密钥格式无效')
  }

  const salt = packed.subarray(0, SALT_LEN)
  const encKey = deriveKey('AOE-USER-KEY-ENC', salt)
  const payloadBuf = decrypt(packed, encKey)
  const payload = payloadBuf.toString('utf-8')
  const pipeIdx = payload.indexOf('|')
  if (pipeIdx === -1) {
    throw new Error('知识库密钥格式无效')
  }

  const passphrase = payload.slice(0, pipeIdx)
  const expires = payload.slice(pipeIdx + 1)

  // 检查有效期
  if (expires && expires !== 'unlimited') {
    const expiresDate = new Date(expires)
    if (isNaN(expiresDate.getTime())) {
      throw new Error(`知识库密钥有效期格式无效: ${expires}`)
    }
    if (new Date() > expiresDate) {
      throw new Error(
        `知识库密钥已过期（有效期至 ${expires}），请联系提供方获取新密钥。`
      )
    }
  }

  passphraseCache = passphrase
  return passphrase
}

function decryptFile(encBase64: string): string {
  const passphrase = loadPassphrase()
  const packed = Buffer.from(encBase64, 'base64')
  const salt = packed.subarray(0, SALT_LEN)
  const key = deriveKey(passphrase, salt)
  const compressed = decrypt(packed, key)
  return gunzipSync(compressed).toString('utf-8')
}

function loadIndex(): Record<string, string> {
  if (indexCache) {
    return indexCache
  }

  initPaths()

  if (!INDEX_FILE || !existsSync(INDEX_FILE)) {
    console.warn('知识库索引文件不存在')
    return {}
  }

  try {
    const encBase64 = readFileSync(INDEX_FILE, 'utf-8').trim()
    const indexJson = decryptFile(encBase64)
    indexCache = JSON.parse(indexJson)
    return indexCache || {}
  } catch (err) {
    console.warn('加载知识库索引失败:', err)
    return {}
  }
}

function getFromCache(key: string): string | null {
  const entry = fileCache.get(key)
  if (!entry) {
    return null
  }

  // 检查是否过期
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    fileCache.delete(key)
    const idx = accessOrder.indexOf(key)
    if (idx !== -1) {
      accessOrder.splice(idx, 1)
    }
    return null
  }

  // 更新访问顺序
  const idx = accessOrder.indexOf(key)
  if (idx !== -1) {
    accessOrder.splice(idx, 1)
  }
  accessOrder.push(key)

  return entry.content
}

function addToCache(key: string, content: string): void {
  // 如果缓存已满，删除最久未访问的
  while (fileCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = accessOrder.shift()
    if (oldestKey) {
      fileCache.delete(oldestKey)
    }
  }

  fileCache.set(key, {
    content,
    timestamp: Date.now(),
  })
  accessOrder.push(key)
}

/**
 * 获取指定文件的知识库内容
 */
export function getKnowledge(key: string): string | undefined {
  initPaths()

  // 先从缓存获取
  const cached = getFromCache(key)
  if (cached !== null) {
    return cached
  }

  // 获取索引
  const index = loadIndex()
  const encFilename = index[key]

  if (!encFilename) {
    return undefined
  }

  // 读取加密文件
  const encPath = join(KNOWLEDGE_DIR, encFilename)
  if (!existsSync(encPath)) {
    console.warn(`知识库文件不存在: ${encPath}`)
    return undefined
  }

  try {
    const encBase64 = readFileSync(encPath, 'utf-8').trim()
    const content = decryptFile(encBase64)
    addToCache(key, content)
    return content
  } catch (err) {
    console.warn(`解密知识库文件失败: ${key}`, err)
    return undefined
  }
}

/**
 * 获取所有可用的知识库文件列表
 */
export function listKnowledge(): string[] {
  const index = loadIndex()
  return Object.keys(index)
}

/**
 * 预加载指定文件到缓存
 */
export function preloadKnowledge(keys: string[]): void {
  for (const key of keys) {
    getKnowledge(key)
  }
}

/**
 * 清空缓存
 */
export function clearCache(): void {
  fileCache.clear()
  accessOrder.length = 0
  indexCache = null
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): {
  fileCount: number
  maxSize: number
  memoryUsage: number
} {
  let memoryUsage = 0
  for (const entry of fileCache.values()) {
    memoryUsage += entry.content.length * 2  // UTF-16
  }

  return {
    fileCount: fileCache.size,
    maxSize: MAX_CACHE_SIZE,
    memoryUsage,
  }
}

// 兼容接口
export const DOMAIN_KNOWLEDGE = new Proxy({} as Record<string, string>, {
  get(_, prop: string) {
    return getKnowledge(`domain/frontend/${prop}.md`) ||
           getKnowledge(`domain/backend/${prop}.md`) ||
           getKnowledge(`domain/data-science/${prop}.md`) ||
           getKnowledge(`domain/devops/${prop}.md`)
  },
})

export const TOOL_KNOWLEDGE = new Proxy({} as Record<string, string>, {
  get(_, prop: string) {
    return getKnowledge(`tools/${prop}.md`)
  },
})

export const TEMPLATES = new Proxy({} as Record<string, string>, {
  get(_, prop: string) {
    return getKnowledge(`templates/${prop}.md`)
  },
})
