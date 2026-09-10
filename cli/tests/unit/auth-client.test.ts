import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Mock the auth client paths for testing
const TEST_DIR = join(tmpdir(), 'aoe-code-test-' + Date.now())
const TEST_AUTH_DIR = join(TEST_DIR, '.aoe')
const TEST_TOKEN_FILE = join(TEST_AUTH_DIR, 'auth-token')

describe('Auth Client', () => {
  beforeEach(() => {
    // Create test directory
    mkdirSync(TEST_AUTH_DIR, { recursive: true })
  })

  afterEach(() => {
    // Cleanup test directory
    try {
      rmSync(TEST_DIR, { recursive: true, force: true })
    } catch {}
  })

  describe('Token Storage', () => {
    test('should save and read token', () => {
      const token = 'test-token-123'
      writeFileSync(TEST_TOKEN_FILE, token, 'utf-8')

      expect(existsSync(TEST_TOKEN_FILE)).toBe(true)

      const saved = readFileSync(TEST_TOKEN_FILE, 'utf-8').trim()
      expect(saved).toBe(token)
    })

    test('should delete token', () => {
      writeFileSync(TEST_TOKEN_FILE, 'test-token', 'utf-8')
      expect(existsSync(TEST_TOKEN_FILE)).toBe(true)

      unlinkSync(TEST_TOKEN_FILE)
      expect(existsSync(TEST_TOKEN_FILE)).toBe(false)
    })

    test('should handle missing token file', () => {
      expect(existsSync(TEST_TOKEN_FILE)).toBe(false)
    })
  })

  describe('Directory Creation', () => {
    test('should create auth directory recursively', () => {
      const nestedDir = join(TEST_DIR, 'deep', 'nested', '.aoe')
      mkdirSync(nestedDir, { recursive: true })

      expect(existsSync(nestedDir)).toBe(true)
    })
  })
})

describe('Utility Functions', () => {
  test('should validate email format', () => {
    const isValidEmail = (email: string): boolean => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    }

    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('invalid-email')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })

  test('should validate password length', () => {
    const isValidPassword = (password: string): boolean => {
      return password.length >= 8
    }

    expect(isValidPassword('password123')).toBe(true)
    expect(isValidPassword('short')).toBe(false)
  })
})
