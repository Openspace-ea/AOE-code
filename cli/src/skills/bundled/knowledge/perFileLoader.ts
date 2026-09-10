/**
 * 按文件加载器 - 支持超大知识库（100MB+）
 *
 * 优化：使用知识库级主密钥，避免每个文件都调用 scrypt
 * - 派生主密钥：~100ms（每个知识库只调用一次）
 * - 解密文件：~1ms（使用 AES-GCM）
 *
 * 性能对比：
 * - 旧方案：100 个文件 × 100ms scrypt = 10 秒
 * - 新方案：1 × 100ms scrypt + 100 × 1ms AES = ~200ms
 */

import { createDecipheriv, scryptSync } from 'crypto'
import { gunzipSync } from 'zlib'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

// Encryption config
const SALT_LEN = 32
const IV_LEN = 16
const TAG_LEN = 16
const KEY_LEN = 32
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1

// 文件缓存配置
const MAX_CACHED_FILES = 200
const CACHE_TTL = 10 * 60 * 1000

interface FileInfo {
  hash: string
  size: number
}

interface KnowledgeBaseIndex {
  description: string
  kb_type?: string  // 'data' | 'domain' | 'company' | 'overview'
  fileCount: number
  totalSize: number
  encrypted?: boolean  // 是否加密，默认为 true（向后兼容）
  masterSalt?: string  // 加密时必需
  files: Record<string, FileInfo>
}

interface GlobalIndex {
  [kbName: string]: KnowledgeBaseIndex
}

interface CachedFile {
  content: string
  timestamp: number
}

interface CachedMasterKey {
  key: Buffer
  timestamp: number
}

// 文件缓存
const fileCache = new Map<string, CachedFile>()
const fileAccessOrder: string[] = []

// 主密钥缓存
const masterKeyCache = new Map<string, CachedMasterKey>()
const keyAccessOrder: string[] = []

// 索引缓存
let globalIndexCache: GlobalIndex | null = null

// 用户密钥缓存
let passphraseCache: string | null = null

// 路径配置
let KNOWLEDGE_DIR = ''
let INDEX_FILE = ''

function initPaths() {
  // 每次都重新检查，不缓存（因为用户可能随时复制文件到 ~/.aoe/knowledge）

  // 1. 用户配置目录（最高优先级）
  const homeKnowledge = join(homedir(), '.aoe', 'knowledge')
  const homeIndex = join(homeKnowledge, 'index.json')
  if (existsSync(homeIndex)) {
    KNOWLEDGE_DIR = homeKnowledge
    INDEX_FILE = homeIndex
    return
  }

  // 2. 可执行文件目录
  try {
    const execDir = process.execPath ? dirname(process.execPath) : ''
    if (execDir) {
      const execKnowledge = join(execDir, 'knowledge')
      const execIndex = join(execKnowledge, 'index.json')
      if (existsSync(execIndex)) {
        KNOWLEDGE_DIR = execKnowledge
        INDEX_FILE = execIndex
        return
      }
    }
  } catch {
    // ignore
  }

  // 3. 尝试从 build config 加载（开发模式）
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const configPath = join(__dirname, '..', '..', '..', '..', '.cache', 'build', 'knowledgeConfig.js')

    if (existsSync(configPath)) {
      const config = require(configPath)
      if (existsSync(config.INDEX_FILE)) {
        KNOWLEDGE_DIR = config.KNOWLEDGE_DIR
        INDEX_FILE = config.INDEX_FILE
        return
      }
    }
  } catch {
    // ignore
  }

  // 4. 当前工作目录的 dist 目录（开发模式）
  const distKnowledge = join(process.cwd(), 'dist', 'knowledge')
  const distIndex = join(distKnowledge, 'index.json')
  if (existsSync(distIndex)) {
    KNOWLEDGE_DIR = distKnowledge
    INDEX_FILE = distIndex
    return
  }

  // 5. 当前工作目录
  const cwdKnowledge = join(process.cwd(), 'knowledge')
  const cwdIndex = join(cwdKnowledge, 'index.json')
  if (existsSync(cwdIndex)) {
    KNOWLEDGE_DIR = cwdKnowledge
    INDEX_FILE = cwdIndex
    return
  }
}

/**
 * 获取知识库目录路径
 * 用于外部访问（如 localKnowledgeLoader.ts）
 */
export function getKnowledgeDir(): string {
  initPaths()
  return KNOWLEDGE_DIR
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
  // 格式: iv(16) + tag(16) + ciphertext
  const iv = packed.subarray(0, IV_LEN)
  const tag = packed.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ciphertext = packed.subarray(IV_LEN + TAG_LEN)

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
 * 获取知识库的主密钥（带缓存）
 */
function getMasterKey(kbName: string, masterSaltBase64: string): Buffer {
  // 检查缓存
  const cached = masterKeyCache.get(kbName)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // 更新访问顺序
    const idx = keyAccessOrder.indexOf(kbName)
    if (idx !== -1) keyAccessOrder.splice(idx, 1)
    keyAccessOrder.push(kbName)
    return cached.key
  }

  // 派生主密钥（每个知识库只调用一次 scrypt）
  const passphrase = loadPassphrase()
  const masterSalt = Buffer.from(masterSaltBase64, 'base64')
  const masterKey = deriveKey(passphrase, masterSalt)

  // 缓存主密钥
  while (masterKeyCache.size >= 50) {  // 最多缓存 50 个知识库的主密钥
    const oldestKey = keyAccessOrder.shift()
    if (oldestKey) masterKeyCache.delete(oldestKey)
  }

  masterKeyCache.set(kbName, {
    key: masterKey,
    timestamp: Date.now(),
  })
  keyAccessOrder.push(kbName)

  return masterKey
}

/**
 * 加载全局索引
 */
function loadGlobalIndex(): GlobalIndex {
  if (globalIndexCache) return globalIndexCache

  initPaths()

  if (!INDEX_FILE || !existsSync(INDEX_FILE)) {
    return {}
  }

  try {
    const content = readFileSync(INDEX_FILE, 'utf-8')
    globalIndexCache = JSON.parse(content)
    return globalIndexCache || {}
  } catch (err) {
    console.warn('加载知识库索引失败:', err)
    return {}
  }
}

/**
 * 获取缓存的文件
 */
function getFromFileCache(cacheKey: string): string | null {
  const entry = fileCache.get(cacheKey)
  if (!entry) return null

  // 检查过期
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    fileCache.delete(cacheKey)
    const idx = fileAccessOrder.indexOf(cacheKey)
    if (idx !== -1) fileAccessOrder.splice(idx, 1)
    return null
  }

  // 更新访问顺序
  const idx = fileAccessOrder.indexOf(cacheKey)
  if (idx !== -1) fileAccessOrder.splice(idx, 1)
  fileAccessOrder.push(cacheKey)

  return entry.content
}

/**
 * 添加到文件缓存
 */
function addToFileCache(cacheKey: string, content: string): void {
  while (fileCache.size >= MAX_CACHED_FILES) {
    const oldestKey = fileAccessOrder.shift()
    if (oldestKey) fileCache.delete(oldestKey)
  }

  fileCache.set(cacheKey, {
    content,
    timestamp: Date.now(),
  })
  fileAccessOrder.push(cacheKey)
}

/**
 * 解密单个文件（使用主密钥）
 */
function decryptFile(encPath: string, masterKey: Buffer): string {
  const packed = readFileSync(encPath)
  const compressed = decrypt(packed, masterKey)
  return gunzipSync(compressed).toString('utf-8')
}

/**
 * 获取单个文件内容
 * @param kbName 知识库名称
 * @param filePath 文件路径（相对于知识库根目录）
 */
export function getFile(kbName: string, filePath: string): string | undefined {
  initPaths()

  // 构建缓存键
  const cacheKey = `${kbName}/${filePath}`

  // 先从缓存获取
  const cached = getFromFileCache(cacheKey)
  if (cached !== null) {
    return cached
  }

  // 获取索引
  const index = loadGlobalIndex()
  const kbInfo = index[kbName]

  if (!kbInfo) {
    return undefined
  }

  const fileInfo = kbInfo.files[filePath]
  if (!fileInfo) {
    return undefined
  }

  // 获取文件路径
  const filePath2 = join(KNOWLEDGE_DIR, kbName, fileInfo.hash)
  if (!existsSync(filePath2)) {
    console.warn(`知识库文件不存在: ${filePath2}`)
    return undefined
  }

  try {
    let content: string

    // 检查是否加密
    if (kbInfo.encrypted === false) {
      // 明文文件，直接读取
      content = readFileSync(filePath2, 'utf-8')
    } else {
      // 加密文件，需要解密
      const masterKey = getMasterKey(kbName, kbInfo.masterSalt)
      content = decryptFile(filePath2, masterKey)
    }

    addToFileCache(cacheKey, content)
    return content
  } catch (err) {
    console.warn(`读取知识库文件失败: ${cacheKey}`, err)
    return undefined
  }
}

/**
 * 列出所有知识库
 */
export function listBases(): string[] {
  return Object.keys(loadGlobalIndex())
}

/**
 * 列出知识库中的文件
 */
export function listFiles(kbName: string): string[] {
  const index = loadGlobalIndex()
  const kbInfo = index[kbName]
  return kbInfo ? Object.keys(kbInfo.files) : []
}

/**
 * 获取知识库信息
 */
export function getBaseInfo(kbName: string): {
  description: string
  kb_type: string
  fileCount: number
  totalSize: number
  encrypted: boolean
} | null {
  const index = loadGlobalIndex()
  const kbInfo = index[kbName]
  if (!kbInfo) return null

  return {
    description: kbInfo.description,
    kb_type: kbInfo.kb_type || 'domain',
    fileCount: kbInfo.fileCount,
    totalSize: kbInfo.totalSize,
    encrypted: kbInfo.encrypted !== false,  // 默认为 true（向后兼容）
  }
}

/**
 * 搜索文件名
 */
export function searchFiles(query: string): Array<{
  kbName: string
  filePath: string
  size: number
}> {
  const index = loadGlobalIndex()
  const results: Array<{ kbName: string; filePath: string; size: number }> = []
  const queryLower = query.toLowerCase()

  for (const [kbName, kbInfo] of Object.entries(index)) {
    for (const [filePath, fileInfo] of Object.entries(kbInfo.files)) {
      if (filePath.toLowerCase().includes(queryLower)) {
        results.push({
          kbName,
          filePath,
          size: fileInfo.size,
        })
      }
    }
  }

  return results
}

/**
 * 预加载文件到缓存
 */
export function preloadFiles(requests: Array<{ kbName: string; filePath: string }>): void {
  for (const { kbName, filePath } of requests) {
    getFile(kbName, filePath)
  }
}

/**
 * 清空缓存
 */
export function clearCache(): void {
  fileCache.clear()
  fileAccessOrder.length = 0
  masterKeyCache.clear()
  keyAccessOrder.length = 0
  globalIndexCache = null
}

/**
 * 获取缓存统计
 */
export function getCacheStats(): {
  cachedFiles: number
  maxFiles: number
  cachedKeys: number
  maxKeys: number
  memoryUsage: number
} {
  let memoryUsage = 0
  for (const entry of fileCache.values()) {
    memoryUsage += entry.content.length * 2
  }
  for (const entry of masterKeyCache.values()) {
    memoryUsage += entry.key.length
  }

  return {
    cachedFiles: fileCache.size,
    maxFiles: MAX_CACHED_FILES,
    cachedKeys: masterKeyCache.size,
    maxKeys: 50,
    memoryUsage,
  }
}
