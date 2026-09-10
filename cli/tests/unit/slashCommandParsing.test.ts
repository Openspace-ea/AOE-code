import { describe, it, expect } from 'bun:test'
import { parseSlashCommand } from '../../src/utils/slashCommandParsing'

describe('parseSlashCommand', () => {
  it('普通命令解析正确', () => {
    const result = parseSlashCommand('/search foo bar')
    expect(result).not.toBeNull()
    expect(result!.commandName).toBe('search')
    expect(result!.args).toBe('foo bar')
    expect(result!.isMcp).toBe(false)
  })

  it('无参数命令解析正确', () => {
    const result = parseSlashCommand('/help')
    expect(result).not.toBeNull()
    expect(result!.commandName).toBe('help')
    expect(result!.args).toBe('')
    expect(result!.isMcp).toBe(false)
  })

  it('带空格的参数保留', () => {
    const result = parseSlashCommand('/search foo bar baz')
    expect(result).not.toBeNull()
    expect(result!.args).toBe('foo bar baz')
  })

  it('非斜杠开头返回 null', () => {
    expect(parseSlashCommand('search foo')).toBeNull()
  })

  it('空输入返回 null', () => {
    expect(parseSlashCommand('')).toBeNull()
  })

  it('只有斜杠返回 null', () => {
    expect(parseSlashCommand('/')).toBeNull()
  })

  it('MCP 命令解析正确', () => {
    const result = parseSlashCommand('/mcp:tool (MCP) arg1 arg2')
    expect(result).not.toBeNull()
    expect(result!.commandName).toBe('mcp:tool (MCP)')
    expect(result!.args).toBe('arg1 arg2')
    expect(result!.isMcp).toBe(true)
  })

  it('命令前有空格仍可解析', () => {
    const result = parseSlashCommand(' /help')
    expect(result).not.toBeNull()
    expect(result!.commandName).toBe('help')
  })

  it('非 MCP 命令 isMcp 为 false', () => {
    const result = parseSlashCommand('/help')
    expect(result).not.toBeNull()
    expect(result!.isMcp).toBe(false)
  })
})
