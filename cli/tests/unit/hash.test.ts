import { describe, it, expect } from 'bun:test'
import { djb2Hash, hashContent, hashPair } from '../../src/utils/hash'

describe('djb2Hash', () => {
  it('相同输入产出相同输出', () => {
    expect(djb2Hash('hello')).toBe(djb2Hash('hello'))
    expect(djb2Hash('world')).toBe(djb2Hash('world'))
  })

  it('不同输入产出不同输出', () => {
    expect(djb2Hash('hello')).not.toBe(djb2Hash('world'))
  })

  it('空字符串返回数字', () => {
    const result = djb2Hash('')
    expect(typeof result).toBe('number')
    expect(Number.isFinite(result)).toBe(true)
  })

  it('返回 32 位整数', () => {
    const result = djb2Hash('test')
    expect(Number.isInteger(result)).toBe(true)
    expect(result).toBeGreaterThanOrEqual(-2147483648)
    expect(result).toBeLessThanOrEqual(2147483647)
  })
})

describe('hashContent', () => {
  it('相同内容相同哈希', () => {
    const content = 'const x = 1;'
    expect(hashContent(content)).toBe(hashContent(content))
  })

  it('不同内容不同哈希', () => {
    expect(hashContent('const x = 1;')).not.toBe(hashContent('const x = 2;'))
  })

  it('空字符串返回字符串', () => {
    const result = hashContent('')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('hashPair', () => {
  it('相同 pair 相同哈希', () => {
    expect(hashPair('ts', 'code')).toBe(hashPair('ts', 'code'))
  })

  it('不同 pair 不同哈希', () => {
    expect(hashPair('ts', 'code')).not.toBe(hashPair('ts', 'test'))
  })

  it('消歧义：不同分割产生不同哈希', () => {
    // hashPair("ts", "code") 应该不同于 hashPair("tsc", "ode")
    expect(hashPair('ts', 'code')).not.toBe(hashPair('tsc', 'ode'))
  })

  it('空字符串处理', () => {
    const result = hashPair('', '')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
