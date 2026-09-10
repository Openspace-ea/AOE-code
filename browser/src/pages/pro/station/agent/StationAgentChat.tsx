/**
 * 测控仿真场景 Agent 对话面板（薄封装）
 *
 * 与 GncAgentChat 同构：注入场景指令 + 工具集 → AgentPanel。
 * 工具 execute 通过 runSceneAction 复用 StationPage 的 executeAgentActions。
 */

import type { ToolDefinition } from '@aoe/agent'
import AgentPanel from '../../shell/AgentPanel'
import { runSceneAction } from '../../shell/sceneTool'
import { PRESET_STATIONS } from '../services/stationTypes'

interface StationAgentChatProps {
  sceneId: string
  buildPromptContext: () => string
  executeActions: (actions: Record<string, unknown>[]) => string[]
  onAgentReply?: () => void
}

const SCENARIO_PROMPT = `你是 AOE Code Agent，一个测控仿真分析专家。你可以帮助用户配置地面站和卫星、运行可见性分析、解读测控覆盖数据。你擅长通过对话引导用户完成复杂的测控分析任务。

## 引导式工作流（核心原则）

当用户的请求模糊或不完整时，你必须通过反问逐步引导，而不是猜测或直接执行。遵循以下流程：

**第1步：理解意图** — 用户说了什么？缺少哪些关键信息？
**第2步：逐个澄清** — 每次只问一个问题，给出2-3个具体选项
**第3步：确认计划** — 信息齐全后，总结将要执行的操作，等用户确认
**第4步：执行+反馈** — 调用工具，告诉用户结果和专业解读

### 反问示例

用户："分析一下卫星覆盖"
→ 你："你想分析哪颗卫星的地面站覆盖？
1. ISS（国际空间站，近地轨道400km）
2. 北斗三号（中地球轨道35786km）
3. 其他——请告诉我卫星名称"

用户："北斗"
→ 你："好的，北斗卫星需要搭配哪个地面站分析？
1. 北京测控站（华北地区）
2. 喀什测控站（西部地区）
3. 三亚测控站（南部地区）
4. 自定义——告诉我城市名"

用户："北京"
→ 你："明白。分析参数：
- 地面站：北京（116.4°E, 39.9°N）
- 卫星：北斗
- 最小仰角：10°（默认）
- 分析时长：24小时

需要调整仰角或时长吗？还是直接开始分析？"

用户："直接开始"
→ 调用工具 → 返回结果后解读："今天有7次过站窗口，最长持续约7分钟，最大仰角68°——测控条件很好。建议重点关注第2次过站（最大仰角最高）。"

### 什么情况需要反问

- 用户说"分析卫星"但没指定卫星 → 问卫星
- 用户说"建个地面站"但没说位置 → 问城市/坐标
- 用户说"做可见性分析"但缺少地面站或卫星 → 逐个确认
- 用户说"结果怎么样"→ 用专业语言解读数据含义

### 什么情况直接执行

- 用户指令明确（"在北京建地面站""分析北京站对北斗的可见性"）
- 用户说"是""确认""好的"
- 用户补充了完整信息

## 操作方式
- 使用提供的工具（sta_ 前缀）：创建地面站/卫星、设置约束、运行分析、搜索卫星
- 搜索卫星（sta_search_satellite）使用内置轨道数据库（3.2万+目标，含 Starlink/北斗/GPS/ISS 等），无需外部认证
- 多步操作时连续调用所有需要的工具

## 规则
1. 回复正文用中文、简洁；
2. 不要编造数值，不确定就问用户；
3. 可见性分析结果解读要点：过站次数、持续时间、最大仰角——仰角越大测控越容易、窗口越长越好；
4. 运行分析前确认已有至少一个地面站和一颗卫星，否则先创建；
5. 分析结果要给出专业建议（如"仰角偏低，建议降低最小仰角约束"或"窗口间隔较长，建议增加地面站"）。`

const PRESET_DESC = PRESET_STATIONS.map((s) => `${s.name}(${s.city}，${s.lon}°E/${s.lat}°N)`).join('、')

function buildStationTools(
  executeActions: (actions: Record<string, unknown>[]) => string[],
): ToolDefinition[] {
  return [
    {
      name: 'sta_create_station',
      description: `创建地面站。参数：名称、经度（东经正）、纬度（北纬正）、海拔（km）。常见预设：${PRESET_DESC}。若用户说地名可参考预设填入坐标。`,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '地面站名称' },
          lon: { type: 'number', description: '经度（东经正，西经负，单位度）' },
          lat: { type: 'number', description: '纬度（北纬正，南纬负，单位度）' },
          alt: { type: 'number', description: '海拔（km），默认 0' },
        },
        required: ['name', 'lon', 'lat'],
      },
      execute: (args) =>
        runSceneAction(executeActions, {
          type: 'create_station',
          name: args.name,
          lon: args.lon,
          lat: args.lat,
          alt: args.alt ?? 0,
        }),
      source: 'scene',
    },
    {
      name: 'sta_create_satellite',
      description: '创建卫星并添加到场景。如果用户提供了 TLE（line1/line2）直接创建；如果只说了名称（如"Starlink""北斗"），必须先调 sta_search_satellite 搜索获取 TLE，再用返回的 line1/line2 创建。不要编造 TLE。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '卫星名称' },
          line1: { type: 'string', description: 'TLE 第一行' },
          line2: { type: 'string', description: 'TLE 第二行' },
          oe: {
            type: 'object',
            description: '开普勒六根数（a 半长轴m / e 偏心率 / i 倾角deg / xw 升交点赤经deg / dw 近拱点角距deg / M 平近点角deg）',
          },
        },
        required: ['name'],
      },
      execute: (args) =>
        runSceneAction(executeActions, {
          type: 'create_satellite',
          name: args.name,
          line1: args.line1,
          line2: args.line2,
          oe: args.oe,
        }),
      source: 'scene',
    },
    {
      name: 'sta_set_constraint',
      description: '设置可见性约束（最小仰角、方位角范围）。默认最小仰角 10°。',
      parameters: {
        type: 'object',
        properties: {
          min_elevation: { type: 'number', description: '最小仰角（deg），默认 10' },
          azimuth_min: { type: 'number', description: '方位角最小值（deg），默认 0' },
          azimuth_max: { type: 'number', description: '方位角最大值（deg），默认 360' },
        },
      },
      execute: (args) =>
        runSceneAction(executeActions, {
          type: 'set_constraint',
          min_elevation: args.min_elevation ?? 10,
          azimuth_min: args.azimuth_min ?? 0,
          azimuth_max: args.azimuth_max ?? 360,
        }),
      source: 'scene',
    },
    {
      name: 'sta_run_visibility',
      description: '运行可见性分析（地面站 ↔ 卫星）。需先有至少一个地面站和一个卫星。默认分析未来 24 小时。',
      parameters: {
        type: 'object',
        properties: {
          station_id: { type: 'string', description: '地面站 id（不传则用第一个）' },
          satellite_id: { type: 'string', description: '卫星 id（不传则用第一个）' },
          hours: { type: 'number', description: '分析时长（小时），默认 24' },
        },
      },
      execute: (args) =>
        runSceneAction(executeActions, {
          type: 'run_visibility',
          station_id: args.station_id,
          satellite_id: args.satellite_id,
          hours: args.hours ?? 24,
        }),
      source: 'scene',
    },
    {
      name: 'sta_search_satellite',
      description: `搜索卫星 TLE 数据（内置轨道数据库，包含3.2万+目标，含 Starlink/北斗/GPS/ISS 等，数据来自 ssa.aseem.cn 每日更新，无需认证）。
返回匹配的卫星列表（名称+TLE），可直接用于 sta_create_satellite 创建卫星。
示例：搜索"starlink"返回全部 Starlink 卫星；搜索"北斗"返回北斗卫星；搜索"ISS"返回国际空间站。`,
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '搜索关键词' },
        },
        required: ['keyword'],
      },
      execute: (args) =>
        runSceneAction(executeActions, {
          type: 'search_satellite',
          keyword: args.keyword,
        }),
      source: 'scene',
    },
    {
      name: 'sta_show_report',
      description: '显示或隐藏可见性分析报告面板。',
      parameters: {
        type: 'object',
        properties: {
          show: { type: 'boolean', description: 'true 显示，false 隐藏' },
        },
        required: ['show'],
      },
      execute: (args) =>
        runSceneAction(executeActions, {
          type: 'show_report',
          show: args.show,
        }),
      source: 'scene',
    },
  ]
}

export default function StationAgentChat({
  sceneId,
  buildPromptContext,
  executeActions,
  onAgentReply,
}: StationAgentChatProps) {
  return (
    <AgentPanel
      convScope={`station_${sceneId}`}
      scenario="visibility"
      scenarioPrompt={SCENARIO_PROMPT}
      emptyHint="我是 AOE Code Agent，测控仿真分析专家。我可以帮你配置地面站和卫星、运行可见性分析、解读测控数据。"
      suggestions={[
        '在北京创建一个地面站',
        '搜索北斗卫星并添加',
        '对北京站和北斗卫星做 24 小时可见性分析',
        '把最小仰角设为 5 度',
        '分析未来 48 小时的过站窗口',
      ]}
      buildPromptContext={buildPromptContext}
      sceneTools={buildStationTools(executeActions)}
      onAgentReply={onAgentReply}
    />
  )
}
