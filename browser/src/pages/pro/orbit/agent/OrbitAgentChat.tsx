/**
 * 轨道模式 Agent 对话面板（薄封装）
 *
 * 壳与通用对话逻辑在 pro/shell/AgentPanel；这里只注入轨道场景参数：
 * 会话按场景持久化（存储键 aoe_pro_conv_orbit_<sceneId>，历史场景带出
 * 历史对话并延续上下文）、professional 会话的 scenario 标识、场景指令
 * （scenarioPrompt）、场景操作工具集（标准 function calling，execute
 * 直接复用 OrbitPage 的动作执行回调）、空会话引导语。
 * 场景实时状态摘要由 OrbitPage 经 buildPromptContext 传入。
 */

import type { ToolDefinition } from '@aoe/agent'
import AgentPanel from '../../shell/AgentPanel'
import { runSceneAction } from '../../shell/sceneTool'
import { ORBIT_GROUPS } from '../services/groups'

interface OrbitAgentChatProps {
  /** 场景 id：会话按场景持久化 */
  sceneId: string
  /** 生成场景实时状态摘要（注入 system prompt 的 sceneContext 层），每次发送时调用 */
  buildPromptContext: () => string
  /** 执行动作列表，返回每条动作的结果描述（与页面操作共用同一套逻辑） */
  executeActions: (actions: Record<string, unknown>[]) => string[]
  /** Agent 回复完成后回调（用于更新场景时间戳） */
  onAgentReply?: () => void
}

/** 场景指令（system prompt 的 scenario 层）：角色 + 操作规则，动作细节在工具描述里 */
const SCENARIO_PROMPT = `你是「轨道 Agent」，一个操作太空轨道场景的智能专家。你擅长通过对话引导用户完成复杂的轨道分析任务。

## 引导式工作流（核心原则）

当用户的请求模糊或不完整时，你必须通过反问逐步引导，而不是猜测或直接执行。遵循以下流程：

**第1步：理解意图** — 用户说了什么？缺少哪些关键信息？
**第2步：逐个澄清** — 每次只问一个问题，给出2-3个具体选项让用户选择
**第3步：确认计划** — 信息齐全后，用一句话总结将要执行的操作，等用户确认
**第4步：执行+反馈** — 调用工具，告诉用户结果和意义

### 反问示例

用户："帮我看看卫星"
→ 你："你想看哪类卫星？
1. 空间站（ISS/天宫）
2. 导航卫星（北斗/GPS）
3. 通信卫星（Starlink/OneWeb）
4. 全部显示"

用户选了"导航卫星"
→ 你："好的，要聚焦到某个区域看吗？比如只看中国上空的导航卫星？还是全球显示？"

用户："只看中国上空"
→ 你："明白，我来执行：开启北斗+GPS分组 → 定位到中国上空 → 筛选该区域的卫星。确认？"

用户确认 → 调用工具执行

### 什么情况需要反问

- 用户说"看看卫星"但没说哪类 → 问分组
- 用户说"分析一下"但没说目标 → 问分析对象
- 用户说"选一个卫星"但没说哪个 → 问名称/编号
- 用户说"发射模拟"但没说参数 → 引导设置目标轨道
- 涉及城市/地名但坐标不确定 → 给出常用坐标选项

### 什么情况直接执行

- 用户指令明确（"开启北斗分组""加速到60倍""选中ISS"）
- 用户说"是""确认""好的"等肯定词
- 用户补充了缺失信息

## 操作方式
- 操作场景使用提供的轨道场景工具（orbit_ 前缀的函数）
- 工具执行结果会自动返回给你，基于结果继续分析或回答
- 多步操作时连续调用所有需要的工具，不要中间停下来

## 规则
1. 回复正文用中文、简洁；
2. 不要编造分组 key 或 NORAD 编号，不确定就问用户；
3. 搜索选中航天器前需先开启其所在分组加载数据；
4. 用户要求「只看某个区域/城市上空的卫星」时，先用 orbit_fly_to 定位，再用 orbit_filter_by_region 筛选；
5. 用户说「清除筛选」「显示全部」时用 orbit_clear_filter。`

const GROUP_KEYS = ORBIT_GROUPS.map((g) => g.key)
const GROUP_DESC = ORBIT_GROUPS.map((g) => `${g.label}(${g.key})`).join('、')

/** 轨道场景操作工具集（source: 'scene'），execute 复用页面动作执行回调 */
function buildOrbitTools(
  executeActions: (actions: Record<string, unknown>[]) => string[],
): ToolDefinition[] {
  return [
    {
      name: 'orbit_enable_groups',
      description: `开启一个或多个星座分组（开启后该组目标才会加载并显示在地图上）。可选分组：${GROUP_DESC}`,
      parameters: {
        type: 'object',
        properties: {
          groups: {
            type: 'array',
            items: { type: 'string', enum: GROUP_KEYS },
            description: '要开启的分组 key 列表',
          },
        },
        required: ['groups'],
      },
      execute: (args) => runSceneAction(executeActions, { type: 'enable_groups', groups: args.groups }),
      source: 'scene',
    },
    {
      name: 'orbit_disable_groups',
      description: `关闭一个或多个星座分组（关闭后该组目标从地图上隐藏）。可选分组：${GROUP_DESC}`,
      parameters: {
        type: 'object',
        properties: {
          groups: {
            type: 'array',
            items: { type: 'string', enum: GROUP_KEYS },
            description: '要关闭的分组 key 列表',
          },
        },
        required: ['groups'],
      },
      execute: (args) => runSceneAction(executeActions, { type: 'disable_groups', groups: args.groups }),
      source: 'scene',
    },
    {
      name: 'orbit_select_satellite',
      description:
        '按名称或 NORAD 编号搜索并选中航天器，视角自动飞到目标上空并跟随。仅搜索已开启分组中的目标，找不到时先开启相关分组再试。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '航天器名称（可模糊匹配，如「ISS」「北斗」）或 NORAD 编号',
          },
        },
        required: ['query'],
      },
      execute: (args) => runSceneAction(executeActions, { type: 'select_satellite', query: args.query }),
      source: 'scene',
    },
    {
      name: 'orbit_follow_satellite',
      description: '开启/关闭对当前选中目标的相机跟踪。需先有用 orbit_select_satellite 选中的目标。',
      parameters: {
        type: 'object',
        properties: {
          follow: { type: 'boolean', description: 'true 开启跟踪，false 取消跟踪' },
        },
        required: ['follow'],
      },
      execute: (args) => runSceneAction(executeActions, { type: 'follow_satellite', follow: args.follow }),
      source: 'scene',
    },
    {
      name: 'orbit_set_time_speed',
      description: '设置仿真时间倍速（仅支持 1/10/60 三档）。',
      parameters: {
        type: 'object',
        properties: {
          speed: { type: 'number', enum: [1, 10, 60], description: '时间倍速' },
        },
        required: ['speed'],
      },
      execute: (args) => runSceneAction(executeActions, { type: 'set_time_speed', speed: args.speed }),
      source: 'scene',
    },
    {
      name: 'orbit_set_playing',
      description: '播放/暂停仿真时间。',
      parameters: {
        type: 'object',
        properties: {
          playing: { type: 'boolean', description: 'true 继续播放，false 暂停' },
        },
        required: ['playing'],
      },
      execute: (args) => runSceneAction(executeActions, { type: 'set_playing', playing: args.playing }),
      source: 'scene',
    },
    {
      name: 'orbit_reset_time',
      description: '仿真时间回到实时（当前真实时间，倍速重置为 1× 并继续播放）。',
      parameters: { type: 'object', properties: {} },
      execute: () => runSceneAction(executeActions, { type: 'reset_time' }),
      source: 'scene',
    },
    {
      name: 'orbit_fly_to',
      description: '把视角定位到指定经纬度上空（不选中目标，仅移动相机）。',
      parameters: {
        type: 'object',
        properties: {
          lat: { type: 'number', description: '纬度（-90 到 90）' },
          lon: { type: 'number', description: '经度（-180 到 180）' },
        },
        required: ['lat', 'lon'],
      },
      execute: (args) => runSceneAction(executeActions, { type: 'fly_to', lat: args.lat, lon: args.lon }),
      source: 'scene',
    },
    {
      name: 'orbit_filter_by_region',
      description: '按地理区域筛选卫星：只保留指定经纬度上空指定半径范围内的卫星（其余变为30%透明）。可用于「显示北京上空的卫星」「只看这个区域的目标」等场景。需要先开启包含目标的星座分组。',
      parameters: {
        type: 'object',
        properties: {
          lat: { type: 'number', description: '中心纬度（度），如北京 39.9' },
          lon: { type: 'number', description: '中心经度（度），如北京 116.4' },
          radiusKm: { type: 'number', description: '筛选半径（km），默认 2000' },
        },
        required: ['lat', 'lon'],
      },
      execute: (args) => runSceneAction(executeActions, {
        type: 'filter_by_region',
        lat: args.lat,
        lon: args.lon,
        radiusKm: args.radiusKm ?? 2000,
      }),
      source: 'scene',
    },
    {
      name: 'orbit_clear_filter',
      description: '清除区域筛选，恢复显示所有卫星（取消30%透明）。',
      parameters: { type: 'object', properties: {} },
      execute: () => runSceneAction(executeActions, { type: 'clear_filter' }),
      source: 'scene',
    },
  ]
}

export default function OrbitAgentChat({
  sceneId,
  buildPromptContext,
  executeActions,
  onAgentReply,
}: OrbitAgentChatProps) {
  return (
    <AgentPanel
      convScope={`orbit_${sceneId}`}
      scenario="orbit"
      scenarioPrompt={SCENARIO_PROMPT}
      emptyHint="我是 AOE Code Agent，可以回答问题和操作场景。试试：「开启北斗分组」「选中国际空间站并跟踪」「加速到 60 倍」"
      buildPromptContext={buildPromptContext}
      sceneTools={buildOrbitTools(executeActions)}
      onAgentReply={onAgentReply}
    />
  )
}
