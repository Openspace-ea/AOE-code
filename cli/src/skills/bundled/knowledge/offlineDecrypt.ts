import { createDecipheriv, scryptSync } from 'crypto'
import { gunzipSync } from 'zlib'
import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// Encryption config (must match pack-knowledge.ts)
const SALT_LEN = 32
const IV_LEN = 16
const TAG_LEN = 16
const KEY_LEN = 32
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1

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

/**
 * Read and decrypt the user key from ~/.aoe/knowledge-key
 */
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
 * Decrypt a base64-encoded encrypted knowledge base.
 * Used by online mode to decrypt data received from the server.
 *
 * @param base64Data - Base64 encoded encrypted data
 * @param serverExpires - Expiration date from server (optional, also checked in encrypted payload)
 * @returns Decrypted knowledge content as string
 */
export function decryptBase(base64Data: string, serverExpires?: string): string {
  const { passphrase, expires: keyExpires } = loadUserKey()

  // Check expiration from key file
  checkExpiration(keyExpires)

  // Check expiration from server response
  if (serverExpires) {
    checkExpiration(serverExpires)
  }

  const packed = Buffer.from(base64Data, 'base64')
  const salt = packed.subarray(0, SALT_LEN)
  const key = deriveKey(passphrase, salt)
  const compressed = decrypt(packed, key)
  const payloadStr = gunzipSync(compressed).toString('utf-8')
  const payload = JSON.parse(payloadStr)

  // Check expiration from encrypted data
  if (payload.expires) {
    checkExpiration(payload.expires)
  }

  return typeof payload.data === 'string' ? JSON.parse(payload.data) : payload
}
