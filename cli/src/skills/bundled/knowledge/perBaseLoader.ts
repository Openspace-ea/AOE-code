/**
 * 按知识库加载器 - 智能加载相关知识库
 *
 * 特点：
 * 1. 按项目技术栈智能加载
 * 2. 只加载相关的知识库
 * 3. LRU 缓存已加载的知识库
 * 4. 支持 500MB+ 总量
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

// 缓存配置
const MAX_LOADED_BASES = 10  // 最多同时加载 10 个知识库
const CACHE_TTL = 30 * 60 * 1000  // 30 分钟过期

interface KnowledgeIndex {
  [name: string]: {
    file: string
    description: string
    fileCount: number
    size: number
  }
}

interface LoadedBase {
  name: string
  files: Record<string, string>
  timestamp: number
}

// 已加载的知识库
const loadedBases = new Map<string, LoadedBase>()
const accessOrder: string[] = []

// 索引缓存
let indexCache: KnowledgeIndex | null = null

// 密钥缓存
let passphraseCache: string | null = null

// 路径配置
let KNOWLEDGE_DIR = ''
let INDEX_FILE = ''

function initPaths() {
  if (KNOWLEDGE_DIR) return

  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const configPath = join(__dirname, '..', '..', '..', '..', '.cache', 'build', 'knowledgeConfig.js')

    if (existsSync(configPath)) {
      const config = require(configPath)
      KNOWLEDGE_DIR = config.KNOWLEDGE_DIR
      INDEX_FILE = config.INDEX_FILE
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

function decryptBase(encBase64: string): Record<string, string> {
  const passphrase = loadPassphrase()
  const packed = Buffer.from(encBase64, 'base64')
  const salt = packed.subarray(0, SALT_LEN)
  const key = deriveKey(passphrase, salt)
  const compressed = decrypt(packed, key)
  const json = gunzipSync(compressed).toString('utf-8')
  return JSON.parse(json)
}

/**
 * 加载知识库索引
 */
export function loadIndex(): KnowledgeIndex {
  if (indexCache) return indexCache

  initPaths()

  if (!INDEX_FILE || !existsSync(INDEX_FILE)) {
    console.warn('知识库索引文件不存在')
    return {}
  }

  try {
    const content = readFileSync(INDEX_FILE, 'utf-8')
    indexCache = JSON.parse(content)
    return indexCache || {}
  } catch (err) {
    console.warn('加载知识库索引失败:', err)
    return {}
  }
}

/**
 * 获取指定知识库
 */
function loadBase(name: string): LoadedBase | null {
  // 检查缓存
  const cached = loadedBases.get(name)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // 更新访问顺序
    const idx = accessOrder.indexOf(name)
    if (idx !== -1) accessOrder.splice(idx, 1)
    accessOrder.push(name)
    return cached
  }

  // 加载知识库
  const index = loadIndex()
  const info = index[name]
  if (!info) return null

  const encPath = join(KNOWLEDGE_DIR, info.file)
  if (!existsSync(encPath)) return null

  try {
    const encBase64 = readFileSync(encPath, 'utf-8').trim()
    const files = decryptBase(encBase64)

    const loaded: LoadedBase = {
      name,
      files,
      timestamp: Date.now(),
    }

    // 缓存管理
    while (loadedBases.size >= MAX_LOADED_BASES) {
      const oldestName = accessOrder.shift()
      if (oldestName) loadedBases.delete(oldestName)
    }

    loadedBases.set(name, loaded)
    accessOrder.push(name)

    return loaded
  } catch (err) {
    console.warn(`加载知识库 ${name} 失败:`, err)
    return null
  }
}

/**
 * 获取知识库内容
 * @param baseName 知识库名称
 * @param fileKey 文件路径（相对于知识库根目录）
 */
export function getKnowledge(baseName: string, fileKey: string): string | undefined {
  const base = loadBase(baseName)
  return base?.files[fileKey]
}

/**
 * 获取所有可用知识库名称
 */
export function listBases(): string[] {
  return Object.keys(loadIndex())
}

/**
 * 获取知识库信息
 */
export function getBaseInfo(name: string): {
  description: string
  fileCount: number
  size: number
  loaded: boolean
} | null {
  const index = loadIndex()
  const info = index[name]
  if (!info) return null

  return {
    description: info.description,
    fileCount: info.fileCount,
    size: info.size,
    loaded: loadedBases.has(name),
  }
}

/**
 * 预加载指定知识库
 */
export function preloadBases(names: string[]): void {
  for (const name of names) {
    loadBase(name)
  }
}

/**
 * 清空缓存
 */
export function clearCache(): void {
  loadedBases.clear()
  accessOrder.length = 0
  indexCache = null
}

/**
 * 获取缓存统计
 */
export function getCacheStats(): {
  loadedCount: number
  maxSize: number
  memoryUsage: number
} {
  let memoryUsage = 0
  for (const base of loadedBases.values()) {
    for (const content of Object.values(base.files)) {
      memoryUsage += content.length * 2
    }
  }

  return {
    loadedCount: loadedBases.size,
    maxSize: MAX_LOADED_BASES,
    memoryUsage,
  }
}

/**
 * 智能加载 - 根据项目技术栈加载相关知识库
 */
export function loadForProject(projectPath: string): void {
  const index = loadIndex()
  const basesToLoad: string[] = []

  // 检测项目技术栈
  const detectStack = (): string[] => {
    const stack: string[] = []

    // 检查 package.json
    const pkgPath = join(projectPath, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }

        if (deps.react) stack.push('react')
        if (deps.vue) stack.push('vue')
        if (deps.angular) stack.push('angular')
        if (deps.svelte) stack.push('svelte')
        if (deps.next) stack.push('nextjs')
        if (deps.express) stack.push('express')
        if (deps.fastify) stack.push('fastify')
        if (deps.typescript) stack.push('typescript')
      } catch {}
    }

    // 检查 requirements.txt
    const reqPath = join(projectPath, 'requirements.txt')
    if (existsSync(reqPath)) {
      const content = readFileSync(reqPath, 'utf-8')
      if (content.includes('django')) stack.push('django')
      if (content.includes('flask')) stack.push('flask')
      if (content.includes('fastapi')) stack.push('fastapi')
    }

    // 检查 go.mod
    const goPath = join(projectPath, 'go.mod')
    if (existsSync(goPath)) stack.push('go')

    // 检查 Cargo.toml
    const rustPath = join(projectPath, 'Cargo.toml')
    if (existsSync(rustPath)) stack.push('rust')

    // 检查 pom.xml
    const javaPath = join(projectPath, 'pom.xml')
    if (existsSync(javaPath)) stack.push('java')

    return stack
  }

  const stack = detectStack()

  // 匹配知识库
  for (const [name, info] of Object.entries(index)) {
    const nameLower = name.toLowerCase()
    const descLower = info.description.toLowerCase()

    for (const tech of stack) {
      if (nameLower.includes(tech) || descLower.includes(tech)) {
        basesToLoad.push(name)
        break
      }
    }
  }

  // 预加载
  if (basesToLoad.length > 0) {
    console.log(`为项目加载 ${basesToLoad.length} 个知识库: ${basesToLoad.join(', ')}`)
    preloadBases(basesToLoad)
  }
}
