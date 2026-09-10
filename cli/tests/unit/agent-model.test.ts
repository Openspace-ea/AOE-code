import { describe, test, expect } from 'bun:test'
import {
  getDefaultSubagentModel,
  getAgentModelDisplay,
  getAgentModelOptions,
} from '../../src/utils/model/agent.js'

describe('getDefaultSubagentModel', () => {
  test('should return inherit', () => {
    expect(getDefaultSubagentModel()).toBe('inherit')
  })
})

describe('getAgentModelDisplay', () => {
  test('should return Chinese default for undefined', () => {
    expect(getAgentModelDisplay(undefined)).toBe('继承父级（默认）')
  })

  test('should return Chinese for inherit', () => {
    expect(getAgentModelDisplay('inherit')).toBe('继承父级')
  })

  test('should capitalize model name', () => {
    expect(getAgentModelDisplay('sonnet')).toBe('Sonnet')
    expect(getAgentModelDisplay('opus')).toBe('Opus')
    expect(getAgentModelDisplay('haiku')).toBe('Haiku')
  })
})

describe('getAgentModelOptions', () => {
  test('should return 4 options', () => {
    const options = getAgentModelOptions()
    expect(options).toHaveLength(4)
  })

  test('should have correct values', () => {
    const options = getAgentModelOptions()
    const values = options.map(o => o.value)
    expect(values).toContain('sonnet')
    expect(values).toContain('opus')
    expect(values).toContain('haiku')
    expect(values).toContain('inherit')
  })

  test('should have Chinese descriptions', () => {
    const options = getAgentModelOptions()
    for (const option of options) {
      expect(option.description).toBeDefined()
      expect(option.description.length).toBeGreaterThan(0)
    }
  })

  test('sonnet should have balanced description', () => {
    const options = getAgentModelOptions()
    const sonnet = options.find(o => o.value === 'sonnet')!
    expect(sonnet.description).toContain('均衡')
  })

  test('opus should have capability description', () => {
    const options = getAgentModelOptions()
    const opus = options.find(o => o.value === 'opus')!
    expect(opus.description).toContain('最强')
  })

  test('haiku should have speed description', () => {
    const options = getAgentModelOptions()
    const haiku = options.find(o => o.value === 'haiku')!
    expect(haiku.description).toContain('快速')
  })

  test('inherit should have Chinese label', () => {
    const options = getAgentModelOptions()
    const inherit = options.find(o => o.value === 'inherit')!
    expect(inherit.label).toBe('继承父级')
  })
})
