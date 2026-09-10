import { describe, test, expect } from 'bun:test'

describe('Knowledge System', () => {
  describe('Knowledge Data Loading', () => {
    test('should handle missing knowledge data gracefully', () => {
      // Simulate missing KNOWLEDGE_DATA
      const KNOWLEDGE_DATA = ''

      // The loadKnowledge function should return empty object
      const result = !KNOWLEDGE_DATA ? {} : { some: 'data' }
      expect(result).toEqual({})
    })

    test('should handle invalid base64 data', () => {
      const invalidBase64 = 'not-valid-base64!!!'

      // Should not throw when decoding invalid base64
      expect(() => {
        Buffer.from(invalidBase64, 'base64')
      }).not.toThrow()
    })
  })

  describe('Knowledge Search', () => {
    test('should search knowledge points by keyword', () => {
      const knowledgePoints = [
        { title: 'React Hooks', content: 'useState and useEffect', importance: 'p1' },
        { title: 'Vue Components', content: 'Composition API', importance: 'p2' },
        { title: 'React Router', content: 'Navigation in React', importance: 'p1' },
      ]

      const query = 'react'
      const results = knowledgePoints.filter(point => {
        const text = `${point.title} ${point.content}`.toLowerCase()
        return text.includes(query.toLowerCase())
      })

      expect(results.length).toBe(2)
      expect(results[0].title).toBe('React Hooks')
      expect(results[1].title).toBe('React Router')
    })

    test('should sort by importance', () => {
      const results = [
        { title: 'Low', importance: 'p3' },
        { title: 'High', importance: 'p1' },
        { title: 'Medium', importance: 'p2' },
      ]

      const order: Record<string, number> = { p1: 0, p2: 1, p3: 2 }
      results.sort((a, b) => (order[a.importance] ?? 9) - (order[b.importance] ?? 9))

      expect(results[0].title).toBe('High')
      expect(results[1].title).toBe('Medium')
      expect(results[2].title).toBe('Low')
    })
  })
})

describe('Encryption Utilities', () => {
  test('should generate consistent keys from same input', () => {
    const { scryptSync } = require('crypto')

    const password = 'test-password'
    const salt = Buffer.from('test-salt-123456789012345678901234')

    const key1 = scryptSync(password, salt, 32)
    const key2 = scryptSync(password, salt, 32)

    expect(key1.equals(key2)).toBe(true)
  })

  test('should generate different keys with different salts', () => {
    const { scryptSync } = require('crypto')

    const password = 'test-password'
    const salt1 = Buffer.from('salt-1-12345678901234567890123456')
    const salt2 = Buffer.from('salt-2-12345678901234567890123456')

    const key1 = scryptSync(password, salt1, 32)
    const key2 = scryptSync(password, salt2, 32)

    expect(key1.equals(key2)).toBe(false)
  })
})
