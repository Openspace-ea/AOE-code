import { describe, it, expect } from 'bun:test'
import { escapeXml, escapeXmlAttr } from '../../src/utils/xml'

describe('escapeXml', () => {
  it('转义 & 字符', () => {
    expect(escapeXml('a & b')).toBe('a &amp; b')
  })

  it('转义 < 字符', () => {
    expect(escapeXml('a < b')).toBe('a &lt; b')
  })

  it('转义 > 字符', () => {
    expect(escapeXml('a > b')).toBe('a &gt; b')
  })

  it('转义多个特殊字符', () => {
    expect(escapeXml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert("xss")&lt;/script&gt;'
    )
  })

  it('空字符串返回空字符串', () => {
    expect(escapeXml('')).toBe('')
  })

  it('纯文本不改变', () => {
    expect(escapeXml('hello world')).toBe('hello world')
  })

  it('已转义的字符串不双重转义', () => {
    expect(escapeXml('&amp;')).toBe('&amp;amp;')
  })
})

describe('escapeXmlAttr', () => {
  it('转义 & 字符', () => {
    expect(escapeXmlAttr('a & b')).toBe('a &amp; b')
  })

  it('转义 < 字符', () => {
    expect(escapeXmlAttr('a < b')).toBe('a &lt; b')
  })

  it('转义 > 字符', () => {
    expect(escapeXmlAttr('a > b')).toBe('a &gt; b')
  })

  it('转义双引号', () => {
    expect(escapeXmlAttr('a " b')).toBe('a &quot; b')
  })

  it('转义单引号', () => {
    expect(escapeXmlAttr("a ' b")).toBe('a &apos; b')
  })

  it('转义所有特殊字符', () => {
    expect(escapeXmlAttr('<a href="test&value">')).toBe(
      '&lt;a href=&quot;test&amp;value&quot;&gt;'
    )
  })

  it('空字符串返回空字符串', () => {
    expect(escapeXmlAttr('')).toBe('')
  })
})
