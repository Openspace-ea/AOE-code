import { describe, it, expect } from 'bun:test'
import {
  stripDisplayTags,
  stripDisplayTagsAllowEmpty,
  stripIdeContextTags,
} from '../../src/utils/displayTags'

describe('stripDisplayTags', () => {
  it('无标签文本不变', () => {
    expect(stripDisplayTags('hello world')).toBe('hello world')
  })

  it('剥离小写标签块', () => {
    const text = 'before<task-notification>content</task-notification>after'
    const result = stripDisplayTags(text)
    expect(result).not.toContain('<task-notification>')
    expect(result).toContain('before')
    expect(result).toContain('after')
  })

  it('纯标签文本返回原文', () => {
    const text = '<task-notification>content</task-notification>'
    expect(stripDisplayTags(text)).toBe(text)
  })

  it('空字符串返回空字符串', () => {
    expect(stripDisplayTags('')).toBe('')
  })

  it('大写标签不被剥离', () => {
    const text = 'before<Button>content</Button>after'
    expect(stripDisplayTags(text)).toBe(text)
  })

  it('大写 HTML 标签不被剥离', () => {
    const text = 'before<Div>content</Div>after'
    expect(stripDisplayTags(text)).toBe(text)
  })
})

describe('stripDisplayTagsAllowEmpty', () => {
  it('无标签文本不变', () => {
    expect(stripDisplayTagsAllowEmpty('hello world')).toBe('hello world')
  })

  it('纯标签文本返回空字符串', () => {
    const text = '<task-notification>content</task-notification>'
    expect(stripDisplayTagsAllowEmpty(text)).toBe('')
  })

  it('标签前后有文本保留', () => {
    const text = 'before<task-notification>content</task-notification>after'
    const result = stripDisplayTagsAllowEmpty(text)
    expect(result).toContain('before')
    expect(result).toContain('after')
  })

  it('空字符串返回空字符串', () => {
    expect(stripDisplayTagsAllowEmpty('')).toBe('')
  })
})

describe('stripIdeContextTags', () => {
  it('剥离 ide_opened_file 标签', () => {
    const text = 'before<ide_opened_file>path</ide_opened_file>after'
    const result = stripIdeContextTags(text)
    expect(result).not.toContain('<ide_opened_file>')
    expect(result).toContain('before')
    expect(result).toContain('after')
  })

  it('剥离 ide_selection 标签', () => {
    const text = 'before<ide_selection>content</ide_selection>after'
    const result = stripIdeContextTags(text)
    expect(result).not.toContain('<ide_selection>')
    expect(result).toContain('before')
    expect(result).toContain('after')
  })

  it('不剥离其他小写标签', () => {
    const text = 'before<task-notification>content</task-notification>after'
    expect(stripIdeContextTags(text)).toBe(text)
  })

  it('无标签文本不变', () => {
    expect(stripIdeContextTags('hello world')).toBe('hello world')
  })

  it('空字符串返回空字符串', () => {
    expect(stripIdeContextTags('')).toBe('')
  })
})
