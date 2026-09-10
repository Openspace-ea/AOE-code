import { describe, test, expect } from 'bun:test'
import {
  permissionModeFromString,
  isDefaultMode,
  permissionModeTitle,
  permissionModeShortTitle,
  toExternalPermissionMode,
} from '../PermissionMode.js'

describe('permissionModeFromString', () => {
  test('should return valid mode', () => {
    expect(permissionModeFromString('default')).toBe('default')
    expect(permissionModeFromString('plan')).toBe('plan')
    expect(permissionModeFromString('acceptEdits')).toBe('acceptEdits')
    expect(permissionModeFromString('bypassPermissions')).toBe('bypassPermissions')
    expect(permissionModeFromString('dontAsk')).toBe('dontAsk')
  })

  test('should return default for invalid string', () => {
    expect(permissionModeFromString('invalid')).toBe('default')
    expect(permissionModeFromString('')).toBe('default')
    expect(permissionModeFromString('UNKNOWN')).toBe('default')
  })
})

describe('isDefaultMode', () => {
  test('should return true for undefined', () => {
    expect(isDefaultMode(undefined)).toBe(true)
  })

  test('should return true for default', () => {
    expect(isDefaultMode('default')).toBe(true)
  })

  test('should return false for other modes', () => {
    expect(isDefaultMode('plan')).toBe(false)
    expect(isDefaultMode('acceptEdits')).toBe(false)
    expect(isDefaultMode('bypassPermissions')).toBe(false)
    expect(isDefaultMode('dontAsk')).toBe(false)
  })
})

describe('permissionModeTitle', () => {
  test('should return Chinese titles', () => {
    expect(permissionModeTitle('default')).toBe('默认')
    expect(permissionModeTitle('plan')).toBe('计划模式')
    expect(permissionModeTitle('acceptEdits')).toBe('接受编辑')
    expect(permissionModeTitle('bypassPermissions')).toBe('跳过权限')
    expect(permissionModeTitle('dontAsk')).toBe('不再询问')
  })
})

describe('permissionModeShortTitle', () => {
  test('should return Chinese short titles', () => {
    expect(permissionModeShortTitle('default')).toBe('默认')
    expect(permissionModeShortTitle('plan')).toBe('计划')
    expect(permissionModeShortTitle('acceptEdits')).toBe('接受')
    expect(permissionModeShortTitle('bypassPermissions')).toBe('跳过')
    expect(permissionModeShortTitle('dontAsk')).toBe('免问')
  })
})

describe('toExternalPermissionMode', () => {
  test('should map all modes to external modes', () => {
    expect(toExternalPermissionMode('default')).toBe('default')
    expect(toExternalPermissionMode('plan')).toBe('plan')
    expect(toExternalPermissionMode('acceptEdits')).toBe('acceptEdits')
    expect(toExternalPermissionMode('bypassPermissions')).toBe('bypassPermissions')
    expect(toExternalPermissionMode('dontAsk')).toBe('dontAsk')
  })
})
