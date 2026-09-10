import { describe, it, expect } from 'bun:test'
import { getDestructiveCommandWarning } from '../../src/tools/BashTool/destructiveCommandWarning'

describe('getDestructiveCommandWarning', () => {
  it('空命令返回 null', () => {
    expect(getDestructiveCommandWarning('')).toBeNull()
  })

  it('安全命令返回 null', () => {
    expect(getDestructiveCommandWarning('ls -la')).toBeNull()
    expect(getDestructiveCommandWarning('cat file.txt')).toBeNull()
    expect(getDestructiveCommandWarning('echo hello')).toBeNull()
  })

  describe('git 破坏性命令', () => {
    it('git reset --hard 返回警告', () => {
      const warning = getDestructiveCommandWarning('git reset --hard HEAD~1')
      expect(warning).not.toBeNull()
      expect(warning).toContain('uncommitted')
    })

    it('git push --force 返回警告', () => {
      const warning = getDestructiveCommandWarning('git push --force origin main')
      expect(warning).not.toBeNull()
      expect(warning).toContain('remote')
    })

    it('git push -f 返回警告', () => {
      const warning = getDestructiveCommandWarning('git push -f origin main')
      expect(warning).not.toBeNull()
    })

    it('git clean -fd 返回警告', () => {
      const warning = getDestructiveCommandWarning('git clean -fd')
      expect(warning).not.toBeNull()
    })

    it('git checkout -- . 返回警告', () => {
      const warning = getDestructiveCommandWarning('git checkout -- .')
      expect(warning).not.toBeNull()
    })
  })

  describe('rm 破坏性命令', () => {
    it('rm -rf 返回警告', () => {
      const warning = getDestructiveCommandWarning('rm -rf /tmp/test')
      expect(warning).not.toBeNull()
      expect(warning).toContain('remove')
    })

    it('rm -r 返回警告', () => {
      const warning = getDestructiveCommandWarning('rm -r /tmp/test')
      expect(warning).not.toBeNull()
    })
  })

  describe('数据库破坏性命令', () => {
    it('DROP TABLE 返回警告', () => {
      const warning = getDestructiveCommandWarning('DROP TABLE users;')
      expect(warning).not.toBeNull()
      expect(warning).toContain('drop')
    })

    it('TRUNCATE TABLE 返回警告', () => {
      const warning = getDestructiveCommandWarning('TRUNCATE TABLE users;')
      expect(warning).not.toBeNull()
    })
  })

  describe('容器/编排破坏性命令', () => {
    it('kubectl delete 返回警告', () => {
      const warning = getDestructiveCommandWarning('kubectl delete pod my-pod')
      expect(warning).not.toBeNull()
    })
  })
})
