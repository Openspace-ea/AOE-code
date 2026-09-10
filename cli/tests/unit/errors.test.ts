import { describe, it, expect } from 'bun:test'
import {
  isAbortError,
  toError,
  errorMessage,
  getErrnoCode,
  isENOENT,
  getErrnoPath,
  hasExactErrorMessage,
} from '../../src/utils/errors'

describe('isAbortError', () => {
  it('AbortError 实例返回 true', () => {
    const err = new Error('Aborted')
    err.name = 'AbortError'
    expect(isAbortError(err)).toBe(true)
  })

  it('普通 Error 返回 false', () => {
    expect(isAbortError(new Error('test'))).toBe(false)
  })

  it('非 Error 对象返回 false', () => {
    expect(isAbortError('test')).toBe(false)
    expect(isAbortError(null)).toBe(false)
    expect(isAbortError(undefined)).toBe(false)
  })
})

describe('toError', () => {
  it('Error 实例返回自身', () => {
    const err = new Error('test')
    expect(toError(err)).toBe(err)
  })

  it('字符串转为 Error', () => {
    const err = toError('test message')
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('test message')
  })

  it('null 转为 Error', () => {
    const err = toError(null)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('null')
  })

  it('undefined 转为 Error', () => {
    const err = toError(undefined)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('undefined')
  })

  it('数字转为 Error', () => {
    const err = toError(42)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('42')
  })
})

describe('errorMessage', () => {
  it('Error 实例返回 message', () => {
    expect(errorMessage(new Error('test'))).toBe('test')
  })

  it('字符串返回自身', () => {
    expect(errorMessage('test')).toBe('test')
  })

  it('null 返回 "null"', () => {
    expect(errorMessage(null)).toBe('null')
  })

  it('undefined 返回 "undefined"', () => {
    expect(errorMessage(undefined)).toBe('undefined')
  })

  it('对象返回字符串表示', () => {
    expect(errorMessage({ key: 'value' })).toBe('[object Object]')
  })
})

describe('getErrnoCode', () => {
  it('有 code 属性的 Error 返回 code', () => {
    const err = new Error('test') as any
    err.code = 'ENOENT'
    expect(getErrnoCode(err)).toBe('ENOENT')
  })

  it('无 code 属性返回 undefined', () => {
    expect(getErrnoCode(new Error('test'))).toBeUndefined()
  })

  it('非 Error 对象返回 undefined', () => {
    expect(getErrnoCode('test')).toBeUndefined()
    expect(getErrnoCode(null)).toBeUndefined()
  })
})

describe('isENOENT', () => {
  it('ENOENT 错误返回 true', () => {
    const err = new Error('no such file') as any
    err.code = 'ENOENT'
    expect(isENOENT(err)).toBe(true)
  })

  it('其他错误返回 false', () => {
    expect(isENOENT(new Error('test'))).toBe(false)
  })

  it('EACCES 错误返回 false', () => {
    const err = new Error('permission denied') as any
    err.code = 'EACCES'
    expect(isENOENT(err)).toBe(false)
  })
})

describe('getErrnoPath', () => {
  it('有 path 属性的 Error 返回 path', () => {
    const err = new Error('test') as any
    err.path = '/some/path'
    expect(getErrnoPath(err)).toBe('/some/path')
  })

  it('无 path 属性返回 undefined', () => {
    expect(getErrnoPath(new Error('test'))).toBeUndefined()
  })

  it('非对象返回 undefined', () => {
    expect(getErrnoPath('test')).toBeUndefined()
    expect(getErrnoPath(null)).toBeUndefined()
  })
})

describe('hasExactErrorMessage', () => {
  it('精确匹配返回 true', () => {
    const err = new Error('exact message')
    expect(hasExactErrorMessage(err, 'exact message')).toBe(true)
  })

  it('不匹配返回 false', () => {
    const err = new Error('other message')
    expect(hasExactErrorMessage(err, 'exact message')).toBe(false)
  })

  it('部分匹配返回 false', () => {
    const err = new Error('this is an exact message')
    expect(hasExactErrorMessage(err, 'exact message')).toBe(false)
  })

  it('非 Error 对象返回 false', () => {
    expect(hasExactErrorMessage('test', 'test')).toBe(false)
    expect(hasExactErrorMessage(null, 'test')).toBe(false)
  })
})
