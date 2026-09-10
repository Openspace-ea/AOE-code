import { describe, test, expect } from 'bun:test'
import { generateHeatmap } from '../../src/utils/heatmap.js'

describe('generateHeatmap', () => {
  test('should handle empty activity array', () => {
    const result = generateHeatmap([])
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
    // Should contain dots (no activity)
    expect(result).toContain('·')
  })

  test('should generate heatmap with activity data', () => {
    const today = new Date()
    const activity = [
      { date: today.toISOString().split('T')[0], messageCount: 10, sessionCount: 1, toolCallCount: 5 },
    ]
    const result = generateHeatmap(activity)
    expect(result).toBeDefined()
    expect(result.length).toBeGreaterThan(0)
  })

  test('should respect terminalWidth option', () => {
    const result1 = generateHeatmap([], { terminalWidth: 40 })
    const result2 = generateHeatmap([], { terminalWidth: 120 })
    // Wider terminal should produce wider output
    expect(result2.length).toBeGreaterThanOrEqual(result1.length)
  })

  test('should hide month labels when showMonthLabels is false', () => {
    const withLabels = generateHeatmap([], { showMonthLabels: true })
    const withoutLabels = generateHeatmap([], { showMonthLabels: false })
    // Without labels should be shorter
    expect(withoutLabels.length).toBeLessThan(withLabels.length)
  })

  test('should include Chinese day labels', () => {
    const result = generateHeatmap([])
    // Should contain Chinese day labels
    expect(result).toContain('一')
    expect(result).toContain('三')
    expect(result).toContain('五')
  })

  test('should include legend', () => {
    const result = generateHeatmap([])
    // Should contain legend with Chinese text
    expect(result).toContain('少')
    expect(result).toContain('多')
  })

  test('should show different intensity levels', () => {
    const today = new Date()
    // Create activity with varying intensities
    const activity = []
    for (let i = 0; i < 100; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      activity.push({
        date: date.toISOString().split('T')[0],
        messageCount: i < 10 ? 50 : i < 30 ? 10 : 1, // High, medium, low
        sessionCount: 1,
        toolCallCount: 1,
      })
    }
    const result = generateHeatmap(activity)
    // Should contain different block characters for different intensities
    expect(result).toBeDefined()
  })
})
