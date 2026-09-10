import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'crypto'
import { chmodSync } from 'fs'
import { join } from 'path'
import { getClaudeConfigHomeDir } from '../envUtils.js'
import { getErrnoCode } from '../errors.js'
import { getFsImplementation } from '../fsOperations.js'
import {
  jsonParse,
  jsonStringify,
  writeFileSync_DEPRECATED,
} from '../slowOperations.js'
import type { SecureStorage, SecureStorageData } from './types.js'

const ALGORITHM = 'aes-256-gcm'
const SALT_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16
const KEY_LENGTH = 32
const SCRYPT_COST = 16384
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 1

function getStoragePath(): { storageDir: string; storagePath: string } {
  const storageDir = getClaudeConfigHomeDir()
  const storageFileName = '.credentials.enc'
  return { storageDir, storagePath: join(storageDir, storageFileName) }
}

function getKeyPath(): string {
  return join(getClaudeConfigHomeDir(), '.credentials.key')
}

function getOrCreateKey(): Buffer {
  const keyPath = getKeyPath()
  const fs = getFsImplementation()

  try {
    return fs.readFileSync(keyPath) as Buffer
  } catch {
    // Generate new key
    const key = randomBytes(KEY_LENGTH)
    try {
      fs.writeFileSync(keyPath, key)
      chmodSync(keyPath, 0o600)
    } catch (e: unknown) {
      const code = getErrnoCode(e)
      if (code !== 'EEXIST') {
        throw e
      }
    }
    return key
  }
}

function deriveKey(password: Buffer, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH, {
    cost: SCRYPT_COST,
    blockSize: SCRYPT_BLOCK_SIZE,
    parallelization: SCRYPT_PARALLELIZATION,
  }) as Buffer
}

function encrypt(data: string, key: Buffer): string {
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const derivedKey = deriveKey(key, salt)

  const cipher = createCipheriv(ALGORITHM, derivedKey, iv)
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  // Format: salt:iv:tag:encrypted (all base64)
  const result = [
    salt.toString('base64'),
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')

  return result
}

function decrypt(encryptedData: string, key: Buffer): string {
  const parts = encryptedData.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format')
  }

  const salt = Buffer.from(parts[0]!, 'base64')
  const iv = Buffer.from(parts[1]!, 'base64')
  const tag = Buffer.from(parts[2]!, 'base64')
  const encrypted = Buffer.from(parts[3]!, 'base64')

  const derivedKey = deriveKey(key, salt)
  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

export const encryptedStorage: SecureStorage = {
  name: 'encrypted',
  read(): SecureStorageData | null {
    const { storagePath } = getStoragePath()
    try {
      const data = getFsImplementation().readFileSync(storagePath, {
        encoding: 'utf8',
      })
      const key = getOrCreateKey()
      const decrypted = decrypt(data, key)
      return jsonParse(decrypted)
    } catch {
      return null
    }
  },
  async readAsync(): Promise<SecureStorageData | null> {
    const { storagePath } = getStoragePath()
    try {
      const data = await getFsImplementation().readFile(storagePath, {
        encoding: 'utf8',
      })
      const key = getOrCreateKey()
      const decrypted = decrypt(data, key)
      return jsonParse(decrypted)
    } catch {
      return null
    }
  },
  update(data: SecureStorageData): { success: boolean; warning?: string } {
    try {
      const { storageDir, storagePath } = getStoragePath()
      try {
        getFsImplementation().mkdirSync(storageDir)
      } catch (e: unknown) {
        const code = getErrnoCode(e)
        if (code !== 'EEXIST') {
          throw e
        }
      }

      const key = getOrCreateKey()
      const encrypted = encrypt(jsonStringify(data), key)

      writeFileSync_DEPRECATED(storagePath, encrypted, {
        encoding: 'utf8',
        flush: false,
      })
      chmodSync(storagePath, 0o600)
      return { success: true }
    } catch {
      return { success: false }
    }
  },
  delete(): boolean {
    const { storagePath } = getStoragePath()
    try {
      getFsImplementation().unlinkSync(storagePath)
      return true
    } catch (e: unknown) {
      const code = getErrnoCode(e)
      if (code === 'ENOENT') {
        return true
      }
      return false
    }
  },
}
