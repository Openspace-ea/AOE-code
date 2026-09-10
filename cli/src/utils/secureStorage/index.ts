import { createFallbackStorage } from './fallbackStorage.js'
import { encryptedStorage } from './encryptedStorage.js'
import { macOsKeychainStorage } from './macOsKeychainStorage.js'
import { plainTextStorage } from './plainTextStorage.js'
import type { SecureStorage } from './types.js'

/**
 * Get the appropriate secure storage implementation for the current platform
 */
export function getSecureStorage(): SecureStorage {
  if (process.platform === 'darwin') {
    return createFallbackStorage(macOsKeychainStorage, encryptedStorage)
  }

  // Linux and Windows: use AES-256-GCM encrypted storage
  return encryptedStorage
}
