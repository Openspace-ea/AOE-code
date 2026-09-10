import { describe, it, expect } from 'bun:test'
import { intersperse, count, uniq } from '../../src/utils/array'

describe('intersperse', () => {
  it('空数组返回空数组', () => {
    expect(intersperse([], (i) => i)).toEqual([])
  })

  it('单元素数组不调用分隔符函数', () => {
    let called = false
    intersperse(['a'], () => { called = true; return ',' })
    expect(called).toBe(false)
  })

  it('多元素数组在元素间插入分隔符', () => {
    expect(intersperse(['a', 'b', 'c'], () => ',')).toEqual(['a', ',', 'b', ',', 'c'])
  })

  it('分隔符函数接收索引参数', () => {
    const indices: number[] = []
    intersperse(['a', 'b', 'c'], (i) => {
      indices.push(i)
      return ','
    })
    expect(indices).toEqual([1, 2])
  })

  it('支持数字分隔符', () => {
    expect(intersperse([1, 2, 3], () => 0)).toEqual([1, 0, 2, 0, 3])
  })
})

describe('count', () => {
  it('空数组返回 0', () => {
    expect(count([], () => true)).toBe(0)
  })

  it('计数满足条件的元素', () => {
    expect(count([1, 2, 3, 4, 5], (n) => n > 3)).toBe(2)
  })

  it('没有满足条件的元素返回 0', () => {
    expect(count([1, 2, 3], (n) => n > 10)).toBe(0)
  })

  it('所有元素都满足条件', () => {
    expect(count([1, 2, 3], (n) => n > 0)).toBe(3)
  })

  it('支持字符串数组', () => {
    expect(count(['a', 'b', 'c', 'a'], (s) => s === 'a')).toBe(2)
  })
})

describe('uniq', () => {
  it('空数组返回空数组', () => {
    expect(uniq([])).toEqual([])
  })

  it('无重复元素返回原数组', () => {
    expect(uniq([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('去重数字数组', () => {
    expect(uniq([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3])
  })

  it('去重字符串数组', () => {
    expect(uniq(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('保留首次出现的元素', () => {
    const result = uniq([1, 2, 1, 3, 2])
    expect(result).toEqual([1, 2, 3])
    expect(result.length).toBe(3)
  })
})
