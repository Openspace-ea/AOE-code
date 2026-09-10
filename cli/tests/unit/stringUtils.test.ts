import { describe, test, expect } from 'bun:test'
import {
  escapeRegExp,
  capitalize,
  plural,
  firstLineOf,
  countCharInString,
  normalizeFullWidthDigits,
  normalizeFullWidthSpace,
  safeJoinLines,
  truncateToLines,
  EndTruncatingAccumulator,
} from '../../src/utils/stringUtils.js'

describe('escapeRegExp', () => {
  test('should escape special regex characters', () => {
    expect(escapeRegExp('.*+?^${}()|[]\\')).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')
  })

  test('should return empty string for empty input', () => {
    expect(escapeRegExp('')).toBe('')
  })

  test('should return unchanged string without special chars', () => {
    expect(escapeRegExp('hello world')).toBe('hello world')
  })

  test('should escape dot only', () => {
    expect(escapeRegExp('file.txt')).toBe('file\\.txt')
  })
})

describe('capitalize', () => {
  test('should capitalize first character', () => {
    expect(capitalize('hello')).toBe('Hello')
  })

  test('should not lowercase rest of string', () => {
    expect(capitalize('fooBar')).toBe('FooBar')
  })

  test('should handle empty string', () => {
    expect(capitalize('')).toBe('')
  })

  test('should handle single character', () => {
    expect(capitalize('a')).toBe('A')
  })

  test('should handle already capitalized', () => {
    expect(capitalize('Hello')).toBe('Hello')
  })
})

describe('plural', () => {
  test('should return singular for count 1', () => {
    expect(plural(1, 'file')).toBe('file')
  })

  test('should return plural for count 0', () => {
    expect(plural(0, 'file')).toBe('files')
  })

  test('should return plural for count > 1', () => {
    expect(plural(2, 'file')).toBe('files')
    expect(plural(100, 'file')).toBe('files')
  })

  test('should use custom plural word', () => {
    expect(plural(2, 'entry', 'entries')).toBe('entries')
    expect(plural(1, 'entry', 'entries')).toBe('entry')
  })
})

describe('firstLineOf', () => {
  test('should return first line', () => {
    expect(firstLineOf('line1\nline2\nline3')).toBe('line1')
  })

  test('should return full string if no newline', () => {
    expect(firstLineOf('single line')).toBe('single line')
  })

  test('should return empty string if starts with newline', () => {
    expect(firstLineOf('\nrest')).toBe('')
  })

  test('should handle empty string', () => {
    expect(firstLineOf('')).toBe('')
  })
})

describe('countCharInString', () => {
  test('should count character occurrences', () => {
    expect(countCharInString('hello world', 'l')).toBe(3)
    expect(countCharInString('hello world', 'o')).toBe(2)
  })

  test('should return 0 if char not found', () => {
    expect(countCharInString('hello', 'x')).toBe(0)
  })

  test('should handle start offset', () => {
    expect(countCharInString('hello world', 'l', 5)).toBe(1)
  })

  test('should handle empty string', () => {
    expect(countCharInString('', 'a')).toBe(0)
  })
})

describe('normalizeFullWidthDigits', () => {
  test('should convert full-width digits to half-width', () => {
    expect(normalizeFullWidthDigits('１２３')).toBe('123')
  })

  test('should handle mixed full and half width', () => {
    expect(normalizeFullWidthDigits('１abc２')).toBe('1abc2')
  })

  test('should leave half-width digits unchanged', () => {
    expect(normalizeFullWidthDigits('123')).toBe('123')
  })

  test('should handle empty string', () => {
    expect(normalizeFullWidthDigits('')).toBe('')
  })
})

describe('normalizeFullWidthSpace', () => {
  test('should convert full-width space to half-width', () => {
    expect(normalizeFullWidthSpace('hello　world')).toBe('hello world')
  })

  test('should leave half-width space unchanged', () => {
    expect(normalizeFullWidthSpace('hello world')).toBe('hello world')
  })

  test('should handle empty string', () => {
    expect(normalizeFullWidthSpace('')).toBe('')
  })
})

describe('safeJoinLines', () => {
  test('should join empty array', () => {
    expect(safeJoinLines([])).toBe('')
  })

  test('should join single item', () => {
    expect(safeJoinLines(['hello'])).toBe('hello')
  })

  test('should join multiple items with default delimiter', () => {
    expect(safeJoinLines(['a', 'b', 'c'])).toBe('a,b,c')
  })

  test('should join with custom delimiter', () => {
    expect(safeJoinLines(['a', 'b', 'c'], ' | ')).toBe('a | b | c')
  })

  test('should truncate when exceeding maxSize', () => {
    const result = safeJoinLines(['hello', 'world', 'test'], ',', 10)
    // Should contain truncation marker
    expect(result).toContain('truncated')
    // Should start with the first items that fit
    expect(result).toContain('hello')
  })
})

describe('truncateToLines', () => {
  test('should not truncate if within limit', () => {
    expect(truncateToLines('line1\nline2', 3)).toBe('line1\nline2')
  })

  test('should truncate to max lines', () => {
    const result = truncateToLines('line1\nline2\nline3\nline4', 2)
    expect(result).toContain('line1')
    expect(result).toContain('line2')
    // Should contain ellipsis character (Unicode …)
    expect(result).toContain('…')
  })

  test('should handle empty text', () => {
    expect(truncateToLines('', 5)).toBe('')
  })

  test('should handle single line', () => {
    expect(truncateToLines('single line', 1)).toBe('single line')
  })
})

describe('EndTruncatingAccumulator', () => {
  test('should accumulate strings', () => {
    const acc = new EndTruncatingAccumulator(100)
    acc.append('hello')
    acc.append(' world')
    expect(acc.toString()).toBe('hello world')
    expect(acc.length).toBe(11)
    expect(acc.truncated).toBe(false)
  })

  test('should truncate when exceeding maxSize', () => {
    const acc = new EndTruncatingAccumulator(10)
    acc.append('hello world this is a test')
    expect(acc.toString().length).toBeLessThanOrEqual(100) // includes truncation marker
    expect(acc.truncated).toBe(true)
  })

  test('should preserve beginning when truncating', () => {
    const acc = new EndTruncatingAccumulator(10)
    acc.append('abcdefghij') // exactly 10
    acc.append('klmnop') // overflow
    expect(acc.toString()).toContain('abcdefghij')
  })

  test('should handle Buffer input', () => {
    const acc = new EndTruncatingAccumulator(100)
    acc.append(Buffer.from('hello'))
    expect(acc.toString()).toBe('hello')
  })

  test('should clear state', () => {
    const acc = new EndTruncatingAccumulator(100)
    acc.append('hello')
    acc.clear()
    expect(acc.toString()).toBe('')
    expect(acc.length).toBe(0)
    expect(acc.truncated).toBe(false)
    expect(acc.totalBytes).toBe(0)
  })

  test('should track total bytes received', () => {
    const acc = new EndTruncatingAccumulator(10)
    acc.append('hello world test')
    expect(acc.totalBytes).toBe(16)
  })
})
