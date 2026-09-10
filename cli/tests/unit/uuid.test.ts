import { describe, it, expect } from 'bun:test'
import { validateUuid, createAgentId } from '../../src/utils/uuid'

describe('validateUuid', () => {
  it('有效 UUID 返回 UUID 字符串', () => {
    const result = validateUuid('550e8400-e29b-41d4-a716-446655440000')
    expect(result).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('有效 UUID（大写）返回 UUID 字符串', () => {
    const result = validateUuid('550E8400-E29B-41D4-A716-446655440000')
    expect(result).toBe('550E8400-E29B-41D4-A716-446655440000')
  })

  it('无效 UUID（太短）返回 null', () => {
    expect(validateUuid('550e8400-e29b-41d4-a716')).toBeNull()
  })

  it('无效 UUID（太长）返回 null', () => {
    expect(validateUuid('550e8400-e29b-41d4-a716-446655440000-extra')).toBeNull()
  })

  it('无效 UUID（非法字符）返回 null', () => {
    expect(validateUuid('550e8400-e29b-41d4-a716-44665544000g')).toBeNull()
  })

  it('无效 UUID（缺少分隔符）返回 null', () => {
    expect(validateUuid('550e8400e29b41d4a716446655440000')).toBeNull()
  })

  it('非字符串类型返回 null', () => {
    expect(validateUuid(null)).toBeNull()
    expect(validateUuid(undefined)).toBeNull()
    expect(validateUuid(123)).toBeNull()
    expect(validateUuid({})).toBeNull()
  })

  it('空字符串返回 null', () => {
    expect(validateUuid('')).toBeNull()
  })
})

describe('createAgentId', () => {
  it('无参数生成格式正确的 ID', () => {
    const id = createAgentId()
    // 格式: a{16hex}
    expect(id).toMatch(/^a[0-9a-f]{16}$/)
  })

  it('有 label 生成格式正确的 ID', () => {
    const id = createAgentId('test')
    // 格式: a{label}-{16hex}
    expect(id).toMatch(/^atest-[0-9a-f]{16}$/)
  })

  it('多次调用生成不同 ID', () => {
    const id1 = createAgentId()
    const id2 = createAgentId()
    expect(id1).not.toBe(id2)
  })

  it('有 label 时 ID 包含 label', () => {
    const id = createAgentId('worker')
    expect(id).toContain('worker')
    expect(id.startsWith('aworker-')).toBe(true)
  })
})
