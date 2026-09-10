/**
 * 按需加载知识库 - 优化大知识库内存占用
 *
 * 策略：
 * 1. 首次访问时只解密整个知识库的索引（文件列表）
 * 2. 访问具体文件时才解密该文件内容
 * 3. 使用 LRU 缓存限制内存占用
 */

import { createDecipheriv, scryptSync } from 'crypto'
import { gunzipSync } from 'zlib'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

// Encryption config (must match pack-knowledge.ts)
const SALT_LEN = 32
const IV_LEN = 16
const TAG_LEN = 16
const KEY_LEN = 32
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1

// LRU 缓存配置
const MAX_CACHE_SIZE = 50  // 最多缓存 50 个文件
const CACHE_TTL = 5 * 60 * 1000  // 5 分钟过期

interface CacheEntry {
  content: string
  timestamp: number
}

// LRU 缓存
const cache = new Map<string, CacheEntry>()
const accessOrder: string[] = []

// 知识库索引（文件列表）
let knowledgeIndex: string[] | null = null

// 加密的原始数据
let encryptedData: string | null = null

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

function loadUserKey(): { passphrase: string; expires: string } {
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

  return {
    passphrase: payload.slice(0, pipeIdx),
    expires: payload.slice(pipeIdx + 1),
  }
}

function checkExpiration(expires: string): void {
  if (!expires || expires === 'unlimited') {
    return
  }
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

/**
 * 解密整个知识库数据
 */
function decryptKnowledgeBase(): Record<string, string> {
  if (!encryptedData) {
    return {}
  }

  try {
    const { passphrase, expires } = loadUserKey()
    checkExpiration(expires)

    const packed = Buffer.from(encryptedData, 'base64')
    const salt = packed.subarray(0, SALT_LEN)
    const key = deriveKey(passphrase, salt)
    const compressed = decrypt(packed, key)
    const payloadStr = gunzipSync(compressed).toString('utf-8')
    const payload = JSON.parse(payloadStr)

    if (payload.expires) {
      checkExpiration(payload.expires)
    }

    return typeof payload.data === 'string' ? JSON.parse(payload.data) : payload
  } catch (err) {
    console.warn('解密知识库数据失败:', err)
    return {}
  }
}

/**
 * 加载知识库索引（文件列表）
 */
function loadIndex(): string[] {
  if (knowledgeIndex) {
    return knowledgeIndex
  }

  const data = decryptKnowledgeBase()
  knowledgeIndex = Object.keys(data)
  return knowledgeIndex
}

/**
 * 从缓存获取文件内容
 */
function getFromCache(key: string): string | null {
  const entry = cache.get(key)
  if (!entry) {
    return null
  }

  // 检查是否过期
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
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

/**
 * 添加到缓存
 */
function addToCache(key: string, content: string): void {
  // 如果缓存已满，删除最久未访问的
  while (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = accessOrder.shift()
    if (oldestKey) {
      cache.delete(oldestKey)
    }
  }

  cache.set(key, {
    content,
    timestamp: Date.now(),
  })
  accessOrder.push(key)
}

/**
 * 获取指定文件的知识库内容
 */
export function getKnowledge(key: string): string | undefined {
  // 先从缓存获取
  const cached = getFromCache(key)
  if (cached !== null) {
    return cached
  }

  // 缓存未命中，解密整个知识库
  const data = decryptKnowledgeBase()
  const content = data[key]

  if (content) {
    addToCache(key, content)
  }

  return content
}

/**
 * 获取所有可用的知识库文件列表
 */
export function listKnowledge(): string[] {
  return loadIndex()
}

/**
 * 预加载指定文件到缓存
 */
export function preloadKnowledge(keys: string[]): void {
  const data = decryptKnowledgeBase()
  for (const key of keys) {
    const content = data[key]
    if (content) {
      addToCache(key, content)
    }
  }
}

/**
 * 清空缓存
 */
export function clearCache(): void {
  cache.clear()
  accessOrder.length = 0
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): { size: number; maxSize: number; hitRate: number } {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    hitRate: 0,  // TODO: 实现命中率统计
  }
}

// 导出兼容接口
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

// 初始化加载加密数据
try {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const dataPath = join(__dirname, '..', '..', '..', '..', '.cache', 'build', 'knowledgeData.js')

  if (existsSync(dataPath)) {
    const module = require(dataPath)
    encryptedData = module.KNOWLEDGE_DATA || ''
  }
} catch (err) {
  console.warn('加载知识库数据失败:', err)
}
