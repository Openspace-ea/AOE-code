import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import { getCwd } from '../../../utils/cwd.js'
import { registerBundledSkill } from '../../bundledSkills.js'

const CONTENT_DIR = join(import.meta.dir, 'content')
const CUSTOM_GUIDES_DIR = '.aoe/guides'

const STACK_INDICATORS: Record<string, string[]> = {
  react: ['package.json'],
  nextjs: ['next.config.js', 'next.config.ts', 'next.config.mjs'],
  vue: ['package.json'],
  angular: ['angular.json'],
  svelte: ['svelte.config.js'],
  express: ['package.json'],
  fastapi: ['pyproject.toml', 'requirements.txt'],
  go: ['go.mod'],
  rust: ['Cargo.toml'],
  spring: ['pom.xml', 'build.gradle'],
  python: ['pyproject.toml', 'setup.py', 'requirements.txt'],
  // 数据库检测
  mysql: ['mysql', 'mysqldump'],
  postgresql: ['pg_dump', 'psql'],
  mongodb: ['mongodump', 'mongorestore'],
  redis: ['redis-cli'],
}

async function detectStack(): Promise<string[]> {
  const cwd = getCwd()
  let entries: string[]
  try {
    entries = await readdir(cwd)
  } catch {
    return []
  }

  const detected: string[] = []

  for (const [stack, indicators] of Object.entries(STACK_INDICATORS)) {
    for (const indicator of indicators) {
      if (entries.includes(indicator)) {
        detected.push(stack)
        break
      }
    }
  }

  if (entries.includes('package.json')) {
    try {
      const pkg = JSON.parse(await readFile(`${cwd}/package.json`, 'utf-8'))
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
      if (allDeps.react && !detected.includes('react')) detected.push('react')
      if (allDeps.next) {
        const idx = detected.indexOf('react')
        if (idx !== -1) detected.splice(idx, 1)
        if (!detected.includes('nextjs')) detected.push('nextjs')
      }
      if (allDeps.vue && !detected.includes('vue')) detected.push('vue')
      if (allDeps['@angular/core'] && !detected.includes('angular'))
        detected.push('angular')
      if (allDeps.svelte && !detected.includes('svelte'))
        detected.push('svelte')
      if (
        (allDeps.express || allDeps.fastify) &&
        !detected.includes('express')
      )
        detected.push('express')
    } catch {
      /* ignore */
    }
  }

  if (entries.includes('requirements.txt')) {
    try {
      const req = await readFile(`${cwd}/requirements.txt`, 'utf-8')
      if (req.includes('fastapi') && !detected.includes('fastapi'))
        detected.push('fastapi')
    } catch {
      /* ignore */
    }
  }

  return [...new Set(detected)]
}

// Lazy-loaded content cache
let _domainCache: Record<string, string> | null = null
let _toolCache: Record<string, string> | null = null
let _templateCache: Record<string, string> | null = null

async function loadDir(subdir: string): Promise<Record<string, string>> {
  const dir = join(CONTENT_DIR, subdir)
  const cache: Record<string, string> = {}

  async function walk(currentDir: string, prefix: string) {
    let entries
    try {
      entries = await readdir(currentDir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath, `${prefix}${entry.name}/`)
      } else if (entry.name.endsWith('.md')) {
        const key = `${prefix}${entry.name.replace('.md', '')}`
        try {
          cache[key] = await readFile(fullPath, 'utf-8')
        } catch {
          /* skip */
        }
      }
    }
  }

  await walk(dir, '')
  return cache
}

async function getDomainCache(): Promise<Record<string, string>> {
  _domainCache ??= await loadDir('domain')
  return _domainCache
}

async function getToolCache(): Promise<Record<string, string>> {
  _toolCache ??= await loadDir('tools')
  return _toolCache
}

async function getTemplateCache(): Promise<Record<string, string>> {
  _templateCache ??= await loadDir('templates')
  return _templateCache
}

// Map topic names to cache keys
const DOMAIN_MAP: Record<string, string> = {
  react: 'frontend/react',
  vue: 'frontend/vue',
  angular: 'frontend/angular',
  svelte: 'frontend/svelte',
  css: 'frontend/css-architecture',
  'web-performance': 'frontend/web-performance',
  node: 'backend/node-express',
  express: 'backend/node-express',
  fastapi: 'backend/python-fastapi',
  'python-backend': 'backend/python-fastapi',
  go: 'backend/go-patterns',
  rust: 'backend/rust-web',
  java: 'backend/java-spring',
  spring: 'backend/java-spring',
  'api-design': 'backend/api-design',
  ml: 'data-science/python-ml',
  'data-science': 'data-science/python-ml',
  jupyter: 'data-science/jupyter-workflow',
  'ci-cd': 'devops/ci-cd',
  monitoring: 'devops/monitoring',
  security: 'devops/security',
  // 新增：数据库
  mysql: 'database/mysql',
  postgresql: 'database/postgresql',
  postgres: 'database/postgresql',
  mongo: 'database/mongodb',
  mongodb: 'database/mongodb',
  redis: 'database/redis',
  // 新增：测试
  'unit-testing': 'testing/unit-testing',
  jest: 'testing/unit-testing',
  mocha: 'testing/unit-testing',
  pytest: 'testing/unit-testing',
  // 新增：调试
  debugging: 'debugging/node-debugging',
  'node-debugging': 'debugging/node-debugging',
  // 新增：错误处理
  'error-handling': 'error-handling/patterns',
  errors: 'error-handling/patterns',
}

const TOOL_MAP: Record<string, string> = {
  webpack: 'webpack',
  vite: 'vite',
  docker: 'docker',
  'docker-compose': 'docker-compose',
  git: 'git-workflows',
  sql: 'sql-optimization',
  nginx: 'nginx',
  terraform: 'terraform',
  kubernetes: 'kubernetes',
  k8s: 'kubernetes',
  testing: 'testing-patterns',
}

const TEMPLATE_MAP: Record<string, string> = {
  react: 'react',
  nextjs: 'nextjs',
  'next.js': 'nextjs',
  vue: 'vue',
  python: 'python',
  go: 'go',
  rust: 'rust',
  node: 'node-api',
  'node-api': 'node-api',
  monorepo: 'monorepo',
  cli: 'cli-tool',
}

const STACK_TO_GUIDES: Record<string, string[]> = {
  react: ['react', 'webpack', 'vite', 'css', 'web-performance', 'testing', 'unit-testing', 'error-handling'],
  nextjs: ['react', 'nextjs', 'css', 'web-performance', 'testing', 'unit-testing', 'error-handling'],
  vue: ['vue', 'vite', 'css', 'web-performance', 'testing', 'unit-testing', 'error-handling'],
  angular: ['angular', 'webpack', 'css', 'testing', 'unit-testing', 'error-handling'],
  svelte: ['svelte', 'vite', 'css', 'testing', 'unit-testing', 'error-handling'],
  express: ['node', 'express', 'api-design', 'docker', 'testing', 'unit-testing', 'error-handling'],
  fastapi: ['fastapi', 'python-backend', 'docker', 'testing', 'unit-testing', 'error-handling'],
  go: ['go', 'docker', 'testing', 'unit-testing', 'error-handling'],
  rust: ['rust', 'docker', 'testing', 'unit-testing', 'error-handling'],
  spring: ['java', 'spring', 'docker', 'testing', 'unit-testing', 'error-handling'],
  python: ['ml', 'data-science', 'jupyter', 'python-backend', 'unit-testing', 'error-handling'],
  // 数据库相关
  mysql: ['mysql', 'unit-testing', 'error-handling'],
  postgresql: ['postgresql', 'unit-testing', 'error-handling'],
  mongodb: ['mongodb', 'unit-testing', 'error-handling'],
  redis: ['redis', 'unit-testing', 'error-handling'],
}

// 自定义指南缓存
let _customGuideCache: Record<string, string> | null = null

async function getCustomGuideCache(): Promise<Record<string, string>> {
  if (_customGuideCache !== null) return _customGuideCache

  const cwd = getCwd()
  const customDir = join(cwd, CUSTOM_GUIDES_DIR)
  _customGuideCache = {}

  try {
    const entries = await readdir(customDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const key = entry.name.replace('.md', '')
        try {
          _customGuideCache[key] = await readFile(join(customDir, entry.name), 'utf-8')
        } catch {
          /* skip */
        }
      }
    }
  } catch {
    /* directory doesn't exist */
  }

  return _customGuideCache
}

async function buildGuidesPrompt(args: string): Promise<string> {
  const parts: string[] = []
  const rawArgs = args.trim()
  const topic = rawArgs.toLowerCase()

  const domainCache = await getDomainCache()
  const toolCache = await getToolCache()
  const templateCache = await getTemplateCache()
  const customCache = await getCustomGuideCache()

  // Special commands
  if (topic === 'list' || topic === 'ls') {
    parts.push('# 可用指南\n')
    parts.push('## 领域知识')
    parts.push(Object.keys(DOMAIN_MAP).join(', '))
    parts.push('\n## 工具指南')
    parts.push(Object.keys(TOOL_MAP).join(', '))
    parts.push('\n## 项目模板')
    parts.push(Object.keys(TEMPLATE_MAP).join(', '))
    if (Object.keys(customCache).length > 0) {
      parts.push('\n## 自定义指南')
      parts.push(Object.keys(customCache).join(', '))
    }
    parts.push('\n---')
    parts.push('使用 `/guides <topic>` 加载特定指南。')
    parts.push(`\n自定义指南目录：\`${CUSTOM_GUIDES_DIR}/\``)
    return parts.join('\n')
  }

  if (topic) {
    // Check custom guides first
    if (customCache[topic]) {
      parts.push(customCache[topic])
    }

    // Check domain
    const domainKey = DOMAIN_MAP[topic]
    if (domainKey && domainCache[domainKey]) {
      parts.push(domainCache[domainKey])
    }

    // Check tool
    const toolKey = TOOL_MAP[topic]
    if (toolKey && toolCache[toolKey]) {
      parts.push(toolCache[toolKey])
    }

    // Check template
    const templateKey = TEMPLATE_MAP[topic]
    if (templateKey && templateCache[templateKey]) {
      parts.push(templateCache[templateKey])
    }

    if (parts.length > 0) {
      return parts.join('\n\n---\n\n')
    }

    // No match
    parts.push(`未找到与 "${topic}" 匹配的指南。\n`)
    parts.push('**领域知识：** ' + Object.keys(DOMAIN_MAP).join(', '))
    parts.push('**工具指南：** ' + Object.keys(TOOL_MAP).join(', '))
    parts.push('**项目模板：** ' + Object.keys(TEMPLATE_MAP).join(', '))
    if (Object.keys(customCache).length > 0) {
      parts.push('**自定义指南：** ' + Object.keys(customCache).join(', '))
    }
    parts.push('\n使用 `/guides list` 查看所有可用指南。')
    return parts.join('\n')
  }

  // No args: auto-detect and show overview
  const stacks = await detectStack()

  if (stacks.length > 0) {
    parts.push(`# 检测到项目类型：${stacks.join(', ')}\n`)

    const relevantTopics = new Set<string>()
    for (const stack of stacks) {
      const topics = STACK_TO_GUIDES[stack]
      if (topics) topics.forEach(t => relevantTopics.add(t))
    }

    for (const t of relevantTopics) {
      const domainKey = DOMAIN_MAP[t]
      const toolKey = TOOL_MAP[t]
      if (domainKey && domainCache[domainKey]) {
        parts.push(domainCache[domainKey])
      }
      if (toolKey && toolCache[toolKey]) {
        parts.push(toolCache[toolKey])
      }
    }
  }

  if (parts.length === 0) {
    parts.push('未检测到项目类型。使用 `/guides <topic>` 加载特定指南。\n')
    parts.push('**领域知识：** ' + Object.keys(DOMAIN_MAP).join(', '))
    parts.push('**工具指南：** ' + Object.keys(TOOL_MAP).join(', '))
    parts.push('**项目模板：** ' + Object.keys(TEMPLATE_MAP).join(', '))
  }

  // Always show command reference
  parts.push([
    '\n---',
    '## 可用命令',
    '| 命令 | 说明 |',
    '|------|------|',
    '| `/guides <topic>` | 加载指定主题指南 |',
    '| `/guides list` | 列出所有可用指南 |',
  ].join('\n'))

  return parts.join('\n\n')
}

export function registerGuidesSkill(): void {
  registerBundledSkill({
    name: 'guides',
    description:
      '加载领域最佳实践、工具使用指南、项目模板。\n' +
      '适用场景：用户询问框架/工具最佳实践、需要项目模板、搜索专业指南。\n' +
      '主题：react, vue, angular, docker, webpack, vite, git, sql, go, rust, python, node, api-design, testing, security 等。',
    argumentHint: '<topic | list>',
    allowedTools: ['Read', 'Grep', 'Glob'],
    userInvocable: true,
    async getPromptForCommand(args) {
      const prompt = await buildGuidesPrompt(args)
      return [{ type: 'text', text: prompt }]
    },
  })
}
