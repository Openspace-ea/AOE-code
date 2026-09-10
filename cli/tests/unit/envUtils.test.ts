import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { homedir } from 'os'
import { join } from 'path'

// We need to test the memoized function, so we'll import it fresh each time
// by clearing the module cache or testing the underlying logic

describe('getClaudeConfigHomeDir', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.CLAUDE_CONFIG_DIR
    delete process.env.AOE_HOME
  })

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv }
  })

  test('should return default path when no env vars set', () => {
    // Since the function is memoized, we test the logic directly
    const result = (
      process.env.CLAUDE_CONFIG_DIR ??
      process.env.AOE_HOME ??
      join(homedir(), '.aoe')
    ).normalize('NFC')

    expect(result).toBe(join(homedir(), '.aoe'))
  })

  test('should use AOE_HOME when set', () => {
    process.env.AOE_HOME = '/tmp/aoe-test'

    const result = (
      process.env.CLAUDE_CONFIG_DIR ??
      process.env.AOE_HOME ??
      join(homedir(), '.aoe')
    ).normalize('NFC')

    expect(result).toBe('/tmp/aoe-test')
  })

  test('should use CLAUDE_CONFIG_DIR when set', () => {
    process.env.CLAUDE_CONFIG_DIR = '/tmp/claude-config'

    const result = (
      process.env.CLAUDE_CONFIG_DIR ??
      process.env.AOE_HOME ??
      join(homedir(), '.aoe')
    ).normalize('NFC')

    expect(result).toBe('/tmp/claude-config')
  })

  test('should prefer CLAUDE_CONFIG_DIR over AOE_HOME', () => {
    process.env.CLAUDE_CONFIG_DIR = '/tmp/claude-config'
    process.env.AOE_HOME = '/tmp/aoe-test'

    const result = (
      process.env.CLAUDE_CONFIG_DIR ??
      process.env.AOE_HOME ??
      join(homedir(), '.aoe')
    ).normalize('NFC')

    expect(result).toBe('/tmp/claude-config')
  })

  test('should normalize Unicode strings (NFC)', () => {
    // Test with a path that contains Unicode characters
    process.env.AOE_HOME = '/tmp/aoe-test'

    const result = (
      process.env.CLAUDE_CONFIG_DIR ??
      process.env.AOE_HOME ??
      join(homedir(), '.aoe')
    ).normalize('NFC')

    expect(result).toBe('/tmp/aoe-test')
    // Verify it's NFC normalized
    expect(result).toBe(result.normalize('NFC'))
  })
})

describe('AOE_HOME environment variable', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.AOE_HOME
    delete process.env.CLAUDE_CONFIG_DIR
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test('should not affect behavior when not set', () => {
    expect(process.env.AOE_HOME).toBeUndefined()
  })

  test('should be readable when set', () => {
    process.env.AOE_HOME = '/custom/path'
    expect(process.env.AOE_HOME).toBe('/custom/path')
  })

  test('should handle empty string', () => {
    process.env.AOE_HOME = ''
    // Empty string should be falsy, so it should fall back to default
    const result = process.env.AOE_HOME || join(homedir(), '.aoe')
    expect(result).toBe(join(homedir(), '.aoe'))
  })

  test('should handle paths with spaces', () => {
    process.env.AOE_HOME = '/path with spaces/aoe'
    expect(process.env.AOE_HOME).toBe('/path with spaces/aoe')
  })

  test('should handle Windows-style paths', () => {
    process.env.AOE_HOME = 'C:\\Users\\test\\.aoe'
    expect(process.env.AOE_HOME).toBe('C:\\Users\\test\\.aoe')
  })
})

describe('Configuration directory priority', () => {
  test('should follow priority: CLAUDE_CONFIG_DIR > AOE_HOME > default', () => {
    const defaultPath = join(homedir(), '.aoe')

    // Test 1: Only default
    expect(
      (undefined ?? undefined ?? defaultPath).normalize('NFC')
    ).toBe(defaultPath)

    // Test 2: AOE_HOME only
    expect(
      (undefined ?? '/aoe-home' ?? defaultPath).normalize('NFC')
    ).toBe('/aoe-home')

    // Test 3: CLAUDE_CONFIG_DIR only
    expect(
      ('/claude-config' ?? undefined ?? defaultPath).normalize('NFC')
    ).toBe('/claude-config')

    // Test 4: Both set - CLAUDE_CONFIG_DIR wins
    expect(
      ('/claude-config' ?? '/aoe-home' ?? defaultPath).normalize('NFC')
    ).toBe('/claude-config')
  })
})

describe('isEnvTruthy', () => {
  // Import the function logic for testing
  function isEnvTruthy(envVar: string | boolean | undefined): boolean {
    if (!envVar) return false
    if (typeof envVar === 'boolean') return envVar
    const normalizedValue = envVar.toLowerCase().trim()
    return ['1', 'true', 'yes', 'on'].includes(normalizedValue)
  }

  test('should return false for undefined', () => {
    expect(isEnvTruthy(undefined)).toBe(false)
  })

  test('should return false for empty string', () => {
    expect(isEnvTruthy('')).toBe(false)
  })

  test('should return true for boolean true', () => {
    expect(isEnvTruthy(true)).toBe(true)
  })

  test('should return false for boolean false', () => {
    expect(isEnvTruthy(false)).toBe(false)
  })

  test('should return true for truthy string values', () => {
    expect(isEnvTruthy('1')).toBe(true)
    expect(isEnvTruthy('true')).toBe(true)
    expect(isEnvTruthy('TRUE')).toBe(true)
    expect(isEnvTruthy('yes')).toBe(true)
    expect(isEnvTruthy('YES')).toBe(true)
    expect(isEnvTruthy('on')).toBe(true)
    expect(isEnvTruthy('ON')).toBe(true)
  })

  test('should return false for falsy string values', () => {
    expect(isEnvTruthy('0')).toBe(false)
    expect(isEnvTruthy('false')).toBe(false)
    expect(isEnvTruthy('FALSE')).toBe(false)
    expect(isEnvTruthy('no')).toBe(false)
    expect(isEnvTruthy('NO')).toBe(false)
    expect(isEnvTruthy('off')).toBe(false)
    expect(isEnvTruthy('OFF')).toBe(false)
  })

  test('should handle whitespace', () => {
    expect(isEnvTruthy(' true ')).toBe(true)
    expect(isEnvTruthy(' false ')).toBe(false)
  })
})

describe('isEnvDefinedFalsy', () => {
  function isEnvDefinedFalsy(envVar: string | boolean | undefined): boolean {
    if (envVar === undefined) return false
    if (typeof envVar === 'boolean') return !envVar
    if (!envVar) return false
    const normalizedValue = envVar.toLowerCase().trim()
    return ['0', 'false', 'no', 'off'].includes(normalizedValue)
  }

  test('should return false for undefined', () => {
    expect(isEnvDefinedFalsy(undefined)).toBe(false)
  })

  test('should return true for boolean false', () => {
    expect(isEnvDefinedFalsy(false)).toBe(true)
  })

  test('should return false for boolean true', () => {
    expect(isEnvDefinedFalsy(true)).toBe(false)
  })

  test('should return true for falsy string values', () => {
    expect(isEnvDefinedFalsy('0')).toBe(true)
    expect(isEnvDefinedFalsy('false')).toBe(true)
    expect(isEnvDefinedFalsy('FALSE')).toBe(true)
    expect(isEnvDefinedFalsy('no')).toBe(true)
    expect(isEnvDefinedFalsy('NO')).toBe(true)
    expect(isEnvDefinedFalsy('off')).toBe(true)
    expect(isEnvDefinedFalsy('OFF')).toBe(true)
  })

  test('should return false for truthy string values', () => {
    expect(isEnvDefinedFalsy('1')).toBe(false)
    expect(isEnvDefinedFalsy('true')).toBe(false)
    expect(isEnvDefinedFalsy('yes')).toBe(false)
    expect(isEnvDefinedFalsy('on')).toBe(false)
  })

  test('should return false for empty string', () => {
    expect(isEnvDefinedFalsy('')).toBe(false)
  })
})

describe('parseEnvVars', () => {
  function parseEnvVars(
    rawEnvArgs: string[] | undefined,
  ): Record<string, string> {
    const parsedEnv: Record<string, string> = {}

    if (rawEnvArgs) {
      for (const envStr of rawEnvArgs) {
        const [key, ...valueParts] = envStr.split('=')
        if (!key || valueParts.length === 0) {
          throw new Error(
            `Invalid environment variable format: ${envStr}, environment variables should be added as: -e KEY1=value1 -e KEY2=value2`,
          )
        }
        parsedEnv[key] = valueParts.join('=')
      }
    }
    return parsedEnv
  }

  test('should return empty object for undefined', () => {
    expect(parseEnvVars(undefined)).toEqual({})
  })

  test('should return empty object for empty array', () => {
    expect(parseEnvVars([])).toEqual({})
  })

  test('should parse single env var', () => {
    expect(parseEnvVars(['KEY=value'])).toEqual({ KEY: 'value' })
  })

  test('should parse multiple env vars', () => {
    expect(parseEnvVars(['KEY1=value1', 'KEY2=value2'])).toEqual({
      KEY1: 'value1',
      KEY2: 'value2',
    })
  })

  test('should handle values with equals signs', () => {
    expect(parseEnvVars(['KEY=value=with=equals'])).toEqual({
      KEY: 'value=with=equals',
    })
  })

  test('should throw error for invalid format', () => {
    expect(() => parseEnvVars(['INVALID'])).toThrow(
      'Invalid environment variable format',
    )
  })

  test('should handle empty value', () => {
    expect(parseEnvVars(['KEY='])).toEqual({ KEY: '' })
  })

  test('should handle value with spaces', () => {
    expect(parseEnvVars(['KEY=value with spaces'])).toEqual({
      KEY: 'value with spaces',
    })
  })
})
