/**
 * STK 指挥官 - 自然语言转 STK 操作
 *
 * 核心功能：
 * 1. 理解用户意图
 * 2. 提取参数
 * 3. 生成 STK 操作序列
 * 4. 执行并返回结果
 */

import { STKConnector, STKAnalysisResult, createSTKConnector } from './index'
import api from '../api'

// ============================================
// 类型定义
// ============================================

interface ParsedIntent {
  action: string
  objects: string[]
  parameters: Record<string, any>
  confidence: number
}

interface TaskStep {
  id: string
  command: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
}

interface ExecutionPlan {
  intent: ParsedIntent
  steps: TaskStep[]
  currentStep: number
}

// ============================================
// STK 指挥官
// ============================================

export class STKCommander {
  private connector: STKConnector
  private currentPlan: ExecutionPlan | null = null

  constructor(connectorType: 'com' | 'rest' | 'mock' = 'mock') {
    this.connector = createSTKConnector(connectorType)
  }

  /**
   * 连接 STK
   */
  async connect(): Promise<boolean> {
    return await this.connector.connect()
  }

  /**
   * 执行自然语言命令
   */
  async execute(userInput: string): Promise<{
    success: boolean
    message: string
    result?: any
    steps?: TaskStep[]
  }> {
    try {
      // 1. 解析意图
      const intent = await this.parseIntent(userInput)
      console.log('解析意图:', intent)

      // 2. 生成执行计划
      const plan = this.generatePlan(intent)
      this.currentPlan = plan

      // 3. 执行计划
      const result = await this.executePlan(plan)

      return {
        success: true,
        message: this.generateResponse(intent, result),
        result,
        steps: plan.steps
      }
    } catch (err) {
      return {
        success: false,
        message: `执行失败: ${err}`
      }
    }
  }

  /**
   * 解析用户意图
   * 使用 AI 模型理解自然语言
   */
  private async parseIntent(input: string): Promise<ParsedIntent> {
    // 调用 AI 模型解析意图
    const prompt = `分析以下用户请求，提取操作意图和参数。

用户请求: "${input}"

请返回 JSON 格式:
{
  "action": "操作类型",
  "objects": ["涉及的对象"],
  "parameters": { "参数名": "参数值" },
  "confidence": 0.95
}

支持的操作类型:
- view_orbit: 查看轨道
- analyze_coverage: 覆盖分析
- analyze_access: 可见性分析
- analyze_collision: 碰撞分析
- analyze_reentry: 再入分析
- compare_satellites: 对比卫星
- generate_report: 生成报告
- create_scenario: 创建场景
- add_satellite: 添加卫星

支持的卫星识别:
- ISS, 国际空间站, NORAD 25544
- 天宫, 天宫空间站, NORAD 48274
- Starlink, 星链
- 北斗, BeiDou
- GPS

只返回 JSON，不要其他内容。`

    try {
      const result = await api.chatCompletion('gpt-3.5-turbo', [
        { role: 'user', content: prompt }
      ])

      if (result.success) {
        const content = (result.data as any)?.choices?.[0]?.message?.content || '{}'
        // 提取 JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      }
    } catch (err) {
      console.error('意图解析失败:', err)
    }

    // 默认返回
    return {
      action: 'unknown',
      objects: [],
      parameters: {},
      confidence: 0
    }
  }

  /**
   * 生成执行计划
   */
  private generatePlan(intent: ParsedIntent): ExecutionPlan {
    const steps: TaskStep[] = []
    let stepId = 1

    // 根据意图类型生成步骤
    switch (intent.action) {
      case 'view_orbit':
        steps.push({
          id: `step-${stepId++}`,
          command: 'connect',
          description: '连接 STK',
          status: 'pending'
        })
        for (const obj of intent.objects) {
          steps.push({
            id: `step-${stepId++}`,
            command: `add_satellite:${obj}`,
            description: `添加卫星: ${obj}`,
            status: 'pending'
          })
        }
        steps.push({
          id: `step-${stepId++}`,
          command: 'visualize',
          description: '生成轨道可视化',
          status: 'pending'
        })
        break

      case 'analyze_coverage':
        steps.push(
          { id: `step-${stepId++}`, command: 'connect', description: '连接 STK', status: 'pending' },
          { id: `step-${stepId++}`, command: 'create_scenario', description: '创建分析场景', status: 'pending' },
          { id: `step-${stepId++}`, command: `add_satellite:${intent.objects[0]}`, description: `添加卫星: ${intent.objects[0]}`, status: 'pending' },
          { id: `step-${stepId++}`, command: `set_region:${intent.parameters.region || 'China'}`, description: `设置分析区域`, status: 'pending' },
          { id: `step-${stepId++}`, command: 'compute_coverage', description: '计算覆盖', status: 'pending' },
          { id: `step-${stepId++}`, command: 'generate_report', description: '生成报告', status: 'pending' }
        )
        break

      case 'analyze_access':
        steps.push(
          { id: `step-${stepId++}`, command: 'connect', description: '连接 STK', status: 'pending' },
          { id: `step-${stepId++}`, command: 'create_scenario', description: '创建分析场景', status: 'pending' },
          { id: `step-${stepId++}`, command: `add_satellite:${intent.objects[0]}`, description: `添加卫星: ${intent.objects[0]}`, status: 'pending' },
          { id: `step-${stepId++}`, command: `add_target:${intent.objects[1] || intent.parameters.target}`, description: `添加目标`, status: 'pending' },
          { id: `step-${stepId++}`, command: 'compute_access', description: '计算可见性', status: 'pending' },
          { id: `step-${stepId++}`, command: 'generate_report', description: '生成报告', status: 'pending' }
        )
        break

      case 'compare_satellites':
        steps.push(
          { id: `step-${stepId++}`, command: 'connect', description: '连接 STK', status: 'pending' },
          { id: `step-${stepId++}`, command: 'create_scenario', description: '创建分析场景', status: 'pending' }
        )
        for (const obj of intent.objects) {
          steps.push({
            id: `step-${stepId++}`,
            command: `add_satellite:${obj}`,
            description: `添加卫星: ${obj}`,
            status: 'pending'
          })
        }
        steps.push(
          { id: `step-${stepId++}`, command: 'compare', description: '对比分析', status: 'pending' },
          { id: `step-${stepId++}`, command: 'generate_report', description: '生成报告', status: 'pending' }
        )
        break

      default:
        steps.push({
          id: `step-${stepId++}`,
          command: 'unknown',
          description: '无法识别的操作',
          status: 'pending'
        })
    }

    return {
      intent,
      steps,
      currentStep: 0
    }
  }

  /**
   * 执行计划
   */
  private async executePlan(plan: ExecutionPlan): Promise<any> {
    const results: any[] = []

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i]
      plan.currentStep = i
      step.status = 'running'

      try {
        const result = await this.executeStep(step)
        step.result = result
        step.status = 'completed'
        results.push(result)
      } catch (err) {
        step.status = 'failed'
        step.result = { error: String(err) }
        throw err
      }
    }

    return results
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: TaskStep): Promise<any> {
    const [command, ...args] = step.command.split(':')

    switch (command) {
      case 'connect':
        return await this.connector.connect()

      case 'create_scenario':
        const now = new Date()
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
        await this.connector.createScenario('AOE_Analysis', now, tomorrow)
        return { scenario: 'AOE_Analysis' }

      case 'add_satellite':
        const satName = args[0]
        // 尝试获取 TLE
        const tle = await this.getTLE(satName)
        await this.connector.addSatellite(satName, tle)
        return { satellite: satName }

      case 'set_region':
        return { region: args[0] }

      case 'compute_coverage':
        const satellite = this.findObject('satellite')
        const region = this.findParameter('region') || 'China'
        return await this.connector.computeCoverage(satellite, region)

      case 'compute_access':
        const sat = this.findObject('satellite')
        const target = this.findObject('target') || this.findParameter('target')
        return await this.connector.computeAccess(sat, target)

      case 'visualize':
        return { type: 'visualization', status: 'ready' }

      case 'generate_report':
        return await this.connector.generateReport('analysis', {})

      default:
        return { command: step.command, status: 'executed' }
    }
  }

  /**
   * 获取卫星 TLE
   */
  private async getTLE(name: string): Promise<string[] | undefined> {
    // 从后端获取 TLE
    const result = await api.getSatellites({ search: name, limit: '1' })
    if (result.success) {
      const satellites = (result.data as any)?.satellites || []
      if (satellites.length > 0) {
        // TODO: 获取 TLE 数据
        return undefined
      }
    }
    return undefined
  }

  /**
   * 查找对象
   */
  private findObject(type: string): string {
    if (!this.currentPlan) return ''
    const objects = this.currentPlan.intent.objects
    // 简单实现，返回第一个对象
    return objects[0] || ''
  }

  /**
   * 查找参数
   */
  private findParameter(key: string): string {
    if (!this.currentPlan) return ''
    return this.currentPlan.intent.parameters[key] || ''
  }

  /**
   * 生成响应文本
   */
  private generateResponse(intent: ParsedIntent, results: any[]): string {
    const objectNames = intent.objects.join('、')

    switch (intent.action) {
      case 'view_orbit':
        return `已为您加载 ${objectNames} 的轨道数据，可以在 3D 视图中查看。`

      case 'analyze_coverage':
        const coverage = results.find(r => r.type === 'coverage')
        if (coverage) {
          return `${objectNames} 对 ${intent.parameters.region || '目标区域'} 的覆盖分析完成。\n覆盖率: ${coverage.data.percentage}%\n平均可见时长: ${coverage.data.avgDuration}秒`
        }
        return `${objectNames} 的覆盖分析已完成。`

      case 'analyze_access':
        const access = results.find(r => r.type === 'access')
        if (access) {
          const accesses = access.data.accesses || []
          return `${objectNames} 的可见性分析完成。\n共 ${accesses.length} 个可见窗口。`
        }
        return `${objectNames} 的可见性分析已完成。`

      case 'compare_satellites':
        return `${objectNames} 的对比分析已完成，请查看报告。`

      default:
        return '操作已完成。'
    }
  }

  /**
   * 获取当前执行状态
   */
  getStatus(): ExecutionPlan | null {
    return this.currentPlan
  }
}

export default STKCommander