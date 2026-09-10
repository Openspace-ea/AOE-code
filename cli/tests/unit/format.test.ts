import { describe, test, expect } from 'bun:test'
import {
  formatFileSize,
  formatSecondsShort,
  formatDuration,
  formatNumber,
  formatTokens,
} from '../../src/utils/format.js'

describe('formatFileSize', () => {
  test('should format 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 bytes')
  })

  test('should format bytes below 1KB', () => {
    expect(formatFileSize(512)).toBe('512 bytes')
    expect(formatFileSize(1023)).toBe('1023 bytes')
  })

  test('should format KB', () => {
    expect(formatFileSize(1024)).toBe('1KB')
    expect(formatFileSize(1536)).toBe('1.5KB')
    expect(formatFileSize(10240)).toBe('10KB')
  })

  test('should format MB', () => {
    expect(formatFileSize(1048576)).toBe('1MB')
    expect(formatFileSize(1572864)).toBe('1.5MB')
    expect(formatFileSize(10485760)).toBe('10MB')
  })

  test('should format GB', () => {
    expect(formatFileSize(1073741824)).toBe('1GB')
    expect(formatFileSize(1610612736)).toBe('1.5GB')
  })

  test('should strip trailing .0', () => {
    expect(formatFileSize(1024)).toBe('1KB')
    expect(formatFileSize(1048576)).toBe('1MB')
  })
})

describe('formatSecondsShort', () => {
  test('should format milliseconds as seconds', () => {
    expect(formatSecondsShort(0)).toBe('0.0s')
    expect(formatSecondsShort(500)).toBe('0.5s')
    expect(formatSecondsShort(1000)).toBe('1.0s')
    expect(formatSecondsShort(1234)).toBe('1.2s')
    expect(formatSecondsShort(59900)).toBe('59.9s')
  })
})

describe('formatDuration', () => {
  test('should format 0ms', () => {
    expect(formatDuration(0)).toBe('0s')
  })

  test('should format sub-second durations', () => {
    expect(formatDuration(500)).toBe('0s')
    expect(formatDuration(0.5)).toBe('0.0s')
  })

  test('should format seconds', () => {
    expect(formatDuration(1000)).toBe('1s')
    expect(formatDuration(30000)).toBe('30s')
    expect(formatDuration(59000)).toBe('59s')
  })

  test('should format minutes and seconds', () => {
    expect(formatDuration(60000)).toBe('1m 0s')
    expect(formatDuration(90000)).toBe('1m 30s')
    expect(formatDuration(3599000)).toBe('59m 59s')
  })

  test('should format hours, minutes and seconds', () => {
    expect(formatDuration(3600000)).toBe('1h 0m 0s')
    expect(formatDuration(5400000)).toBe('1h 30m 0s')
  })

  test('should format days', () => {
    expect(formatDuration(86400000)).toBe('1d 0h 0m')
    expect(formatDuration(90000000)).toBe('1d 1h 0m')
  })

  test('should handle rounding carry-over', () => {
    // 59.5s -> Math.floor(59500/1000) = 59s
    expect(formatDuration(59500)).toBe('59s')
    // Exactly 60s -> 1m 0s
    expect(formatDuration(60000)).toBe('1m 0s')
  })

  test('should hide trailing zeros when option is set', () => {
    expect(formatDuration(3600000, { hideTrailingZeros: true })).toBe('1h')
    expect(formatDuration(3660000, { hideTrailingZeros: true })).toBe('1h 1m')
    expect(formatDuration(86400000, { hideTrailingZeros: true })).toBe('1d')
  })

  test('should show most significant unit only', () => {
    expect(formatDuration(90000000, { mostSignificantOnly: true })).toBe('1d')
    expect(formatDuration(5400000, { mostSignificantOnly: true })).toBe('1h')
    expect(formatDuration(90000, { mostSignificantOnly: true })).toBe('1m')
    expect(formatDuration(30000, { mostSignificantOnly: true })).toBe('30s')
  })
})

describe('formatNumber', () => {
  test('should format small numbers', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(1)).toBe('1')
    expect(formatNumber(999)).toBe('999')
  })

  test('should format thousands with decimal', () => {
    expect(formatNumber(1000)).toBe('1.0k')
    expect(formatNumber(1500)).toBe('1.5k')
    expect(formatNumber(99999)).toBe('100.0k')
  })

  test('should format millions with decimal', () => {
    expect(formatNumber(1000000)).toBe('1.0m')
    expect(formatNumber(1500000)).toBe('1.5m')
  })

  test('should handle negative numbers', () => {
    expect(formatNumber(-500)).toBe('-500')
    expect(formatNumber(-1500)).toBe('-1.5k')
  })
})

describe('formatTokens', () => {
  test('should format small numbers', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(500)).toBe('500')
  })

  test('should format thousands without .0', () => {
    expect(formatTokens(1000)).toBe('1k')
    expect(formatTokens(1500)).toBe('1.5k')
  })

  test('should format millions without .0', () => {
    expect(formatTokens(1000000)).toBe('1m')
    expect(formatTokens(2500000)).toBe('2.5m')
  })

  test('should strip .0 from output', () => {
    // formatNumber(1000) = "1.0k" -> formatTokens strips ".0" = "1k"
    expect(formatTokens(1000)).toBe('1k')
    expect(formatTokens(1000000)).toBe('1m')
    expect(formatTokens(1500)).toBe('1.5k') // keeps non-zero decimal
  })
})
