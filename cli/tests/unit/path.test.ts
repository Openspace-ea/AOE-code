import { describe, it, expect } from 'bun:test'
import {
  containsPathTraversal,
  normalizePathForConfigKey,
} from '../../src/utils/path'

describe('containsPathTraversal', () => {
  it('../ 返回 true', () => {
    expect(containsPathTraversal('../secret')).toBe(true)
  })

  it('foo/../bar 返回 true', () => {
    expect(containsPathTraversal('foo/../bar')).toBe(true)
  })

  it('..\\ 返回 true（Windows 风格）', () => {
    expect(containsPathTraversal('..\\secret')).toBe(true)
  })

  it('正常路径返回 false', () => {
    expect(containsPathTraversal('src/utils/test.ts')).toBe(false)
  })

  it('./src 返回 false', () => {
    expect(containsPathTraversal('./src')).toBe(false)
  })

  it('空路径返回 false', () => {
    expect(containsPathTraversal('')).toBe(false)
  })

  it('以 .. 结尾返回 true', () => {
    expect(containsPathTraversal('foo/..')).toBe(true)
  })

  it('路径中间的 .. 返回 true', () => {
    expect(containsPathTraversal('foo/../bar/baz')).toBe(true)
  })

  it('不包含 .. 的路径返回 false', () => {
    expect(containsPathTraversal('foo/bar/baz')).toBe(false)
  })

  it('包含 ... 的路径返回 false', () => {
    expect(containsPathTraversal('foo/.../bar')).toBe(false)
  })
})

describe('normalizePathForConfigKey', () => {
  it('Unix 路径不变', () => {
    expect(normalizePathForConfigKey('/usr/local/bin')).toBe('/usr/local/bin')
  })

  it('保留尾部斜杠', () => {
    expect(normalizePathForConfigKey('/usr/local/')).toBe('/usr/local/')
  })

  it('Windows 反斜杠转正斜杠', () => {
    const result = normalizePathForConfigKey('C:\\Users\\test\\file')
    expect(result).not.toContain('\\')
    expect(result).toContain('/')
  })

  it('已经是正斜杠不变', () => {
    expect(normalizePathForConfigKey('/usr/local/bin')).toBe('/usr/local/bin')
  })

  it('解析 . 和 ..', () => {
    const result = normalizePathForConfigKey('/usr/local/./bin')
    expect(result).toBe('/usr/local/bin')
  })
})
