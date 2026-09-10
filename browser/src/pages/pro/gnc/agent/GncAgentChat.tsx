/**
 * GNC 场景 Agent 对话面板（薄封装）
 *
 * 壳与通用对话逻辑在 pro/shell/AgentPanel；这里只注入 GNC 场景参数：
 * 会话按场景持久化（存储键 aoe_pro_conv_gnc_<sceneId>，历史场景带出
 * 历史对话并延续上下文）、场景指令（scenarioPrompt）、场景操作工具集
 * （标准 function calling，execute 直接复用 LaunchPage 的动作执行回调）、
 * 空会话引导语。场景实时状态摘要由 LaunchPage 经 buildPromptContext 传入。
 */

import type { ToolDefinition } from '@aoe/agent'
import AgentPanel from '../../shell/AgentPanel'
import { runSceneAction } from '../../shell/sceneTool'
import { LAUNCH_SITES } from '../services/launchSites'

interface GncAgentChatProps {
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
const SCENARIO_PROMPT = `你是 AOE Code Agent，一个操作 GNC 发射仿真场景的智能专家。载具为 SLS Block 1。你擅长通过对话引导用户完成发射任务规划。

## 引导式工作流（核心原则）

当用户的请求模糊或不完整时，你必须通过反问逐步引导，而不是猜测或直接执行。遵循以下流程：

**第1步：理解意图** — 用户说了什么？缺少哪些关键信息？
**第2步：逐个澄清** — 每次只问一个问题，给出2-3个具体选项
**第3步：确认计划** — 信息齐全后，总结将要执行的操作，等用户确认
**第4步：执行+反馈** — 调用工具，告诉用户结果

### 反问示例

用户："我要发射一个卫星"
→ 你："好的！你想发射到什么类型的轨道？
1. 近地轨道 LEO（400km，国际空间站高度）
2. 太阳同步轨道 SSO（650km，遥感卫星常用）
3. 中地球轨道 MEO（20200km，导航卫星）
4. 地球同步轨道 GEO（35786km）"

用户："遥感卫星"
→ 你："太阳同步轨道 SSO 很适合遥感。发射场用哪个？
1. 酒泉（TAISC）— 纬度40.9°，适合中高倾角
2. 西昌（XICLF）— 纬度28.2°，适合GEO/SSO
3. 文昌（WENC）— 纬度19.6°，最低纬度，运载效率最高"

用户："文昌"
→ 你："好的，我来配置：目标轨道 650km/98°（SSO），发射场文昌。确认后点火发射？"

### 什么情况需要反问

- 用户说"发射一个卫星"但没说轨道 → 问目标轨道类型
- 用户说"模拟一下"但没说参数 → 引导设置
- 用户说"换个发射场"但没说哪个 → 列出可选项
- 用户说"调整轨道"但没说具体参数 → 问高度/倾角

### 什么情况直接执行

- 用户说"点火""暂停""重置""加速到60倍"
- 用户说"是""确认""好的"
- 用户补充了完整参数

## 操作方式
- 使用 GNC 场景工具（gnc_ 前缀）：点火/暂停/重置、时间倍速、目标轨道、发射场、相机跟踪
- 多步操作时连续调用所有需要的工具

## 规则
1. 回复正文用中文、简洁；
2. 不要编造数值或发射站代码，不确定就问用户；
3. 注意各工具生效条件（如目标轨道仅发射前可设定、切换发射场会重置仿真）；
4. 目标轨道高度范围 200-2000km（LEO），倾角不能小于发射场纬度。`

const SITE_CODES = LAUNCH_SITES.filter((s) => s.selectable).map((s) => s.code)
const SITE_DESC = LAUNCH_SITES.filter((s) => s.selectable)
  .map((s) => `${s.name}(${s.code})`)
  .join('、')

/** GNC 场景操作工具集（source: 'scene'），execute 复用页面动作执行回调 */
function buildGncTools(
  executeActions: (actions: Record<string, unknown>[]) => string[],
): ToolDefinition[] {
  return [
    {
      name: 'gnc_ignite',
      description: '点火发射（仅待发射状态有效，点火后仿真开始运行）。已发射或飞行中调用无意义。',
      parameters: { type: 'object', properties: {} },
      execute: () => runSceneAction(executeActions, { type: 'ignite' }),
      source: 'scene',
    },
    {
      name: 'gnc_pause',
      description: '暂停仿真。',
      parameters: { type: 'object', properties: {} },
      execute: () => runSceneAction(executeActions, { type: 'pause' }),
      source: 'scene',
    },
    {
      name: 'gnc_resume',
      description: '继续运行已暂停的仿真。',
      parameters: { type: 'object', properties: {} },
      execute: () => runSceneAction(executeActions, { type: 'resume' }),
      source: 'scene',
    },
    {
      name: 'gnc_reset',
      description: '重置仿真到待发射状态（清空当前飞行进度，需重新点火）。',
      parameters: { type: 'object', properties: {} },
      execute: () => runSceneAction(executeActions, { type: 'reset' }),
      source: 'scene',
    },
    {
      name: 'gnc_set_speed',
      description: '设置仿真时间倍速（仅支持 1/10/60 三档）。',
      parameters: {
        type: 'object',
        properties: {
          speed: { type: 'number', enum: [1, 10, 60], description: '时间倍速' },
        },
        required: ['speed'],
      },
      execute: (args) => runSceneAction(executeActions, { type: 'set_speed', speed: args.speed }),
      source: 'scene',
    },
    {
      name: 'gnc_set_target_orbit',
      description:
        '设定目标轨道（圆轨道高度 200–2000 km，倾角下限为当前发射场纬度绝对值、上限 98°）。注意：仅发射前（待发射状态）可设定；发射后调用会被拒绝，需先 gnc_reset 重置再设定并重新点火。',
      parameters: {
        type: 'object',
        properties: {
          altitude_km: { type: 'number', description: '目标轨道高度 km（200–2000）' },
          inclination_deg: {
            type: 'number',
            description: '目标倾角（度）；不传则沿用当前设定。下限为发射场纬度绝对值',
          },
        },
        required: ['altitude_km'],
      },
      execute: (args) =>
        runSceneAction(executeActions, {
          type: 'set_target_orbit',
          altitude_km: args.altitude_km,
          inclination_deg: args.inclination_deg,
        }),
      source: 'scene',
    },
    {
      name: 'gnc_set_launch_site',
      description: `切换发射场（会重置仿真，需重新点火；倾角下限随之变为新场区纬度绝对值）。可选发射场：${SITE_DESC}`,
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', enum: SITE_CODES, description: '发射站代码' },
        },
        required: ['code'],
      },
      execute: (args) => runSceneAction(executeActions, { type: 'set_launch_site', code: args.code }),
      source: 'scene',
    },
    {
      name: 'gnc_set_follow',
      description: '相机跟踪开关：开启后相机跟随航天器。',
      parameters: {
        type: 'object',
        properties: {
          follow: { type: 'boolean', description: 'true 开启跟踪，false 关闭' },
        },
        required: ['follow'],
      },
      execute: (args) => runSceneAction(executeActions, { type: 'set_follow', follow: args.follow }),
      source: 'scene',
    },
  ]
}

export default function GncAgentChat({
  sceneId,
  buildPromptContext,
  executeActions,
  onAgentReply,
}: GncAgentChatProps) {
  return (
    <AgentPanel
      convScope={`gnc_${sceneId}`}
      scenario="gnc"
      scenarioPrompt={SCENARIO_PROMPT}
      emptyHint="我是 AOE Code Agent，可以回答问题和操作发射仿真。试试：「点火发射」「加速到 60 倍」「把目标轨道改到 800km 再发射」"
      buildPromptContext={buildPromptContext}
      sceneTools={buildGncTools(executeActions)}
      onAgentReply={onAgentReply}
    />
  )
}
