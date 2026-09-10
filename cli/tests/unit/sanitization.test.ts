import { describe, it, expect } from 'bun:test'
import {
  partiallySanitizeUnicode,
  recursivelySanitizeUnicode,
} from '../../src/utils/sanitization'

describe('partiallySanitizeUnicode', () => {
  it('正常文本不改变', () => {
    expect(partiallySanitizeUnicode('hello world')).toBe('hello world')
  })

  it('中文文本不改变', () => {
    expect(partiallySanitizeUnicode('你好世界')).toBe('你好世界')
  })

  it('移除 Unicode Tag 字符', () => {
    // Unicode Tag 字符范围: U+E0020-U+E007F
    const withTag = 'hello0world'
    expect(partiallySanitizeUnicode(withTag)).not.toContain('0')
  })

  it('移除零宽空格', () => {
    const withZWSP = 'hello​world'
    expect(partiallySanitizeUnicode(withZWSP)).not.toContain('​')
  })

  it('移除方向控制字符', () => {
    const withRLO = 'hello‮world'
    expect(partiallySanitizeUnicode(withRLO)).not.toContain('‮')
  })

  it('保留正常标点符号', () => {
    const text = 'hello, world! 你好?世界.'
    expect(partiallySanitizeUnicode(text)).toBe(text)
  })

  it('空字符串返回空字符串', () => {
    expect(partiallySanitizeUnicode('')).toBe('')
  })
})

describe('recursivelySanitizeUnicode', () => {
  it('字符串调用 partiallySanitizeUnicode', () => {
    expect(recursivelySanitizeUnicode('hello​world')).not.toContain('​')
  })

  it('对象递归净化', () => {
    const input = {
      a: 'hello​world',
      b: 'normal',
    }
    const result = recursivelySanitizeUnicode(input)
    expect(result.a).not.toContain('​')
    expect(result.b).toBe('normal')
  })

  it('数组递归净化', () => {
    const input = ['hello​world', 'normal']
    const result = recursivelySanitizeUnicode(input)
    expect(result[0]).not.toContain('​')
    expect(result[1]).toBe('normal')
  })

  it('嵌套对象递归净化', () => {
    const input = {
      level1: {
        level2: 'hello​world',
      },
    }
    const result = recursivelySanitizeUnicode(input)
    expect(result.level1.level2).not.toContain('​')
  })

  it('null 返回 null', () => {
    expect(recursivelySanitizeUnicode(null)).toBeNull()
  })

  it('undefined 返回 undefined', () => {
    expect(recursivelySanitizeUnicode(undefined)).toBeUndefined()
  })

  it('数字返回原值', () => {
    expect(recursivelySanitizeUnicode(42)).toBe(42)
  })

  it('布尔值返回原值', () => {
    expect(recursivelySanitizeUnicode(true)).toBe(true)
  })
})
