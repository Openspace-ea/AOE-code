import { AGENT_TOOL_NAME } from '../../tools/AgentTool/constants.js'
import { ASK_USER_QUESTION_TOOL_NAME } from '../../tools/AskUserQuestionTool/prompt.js'
import { ENTER_PLAN_MODE_TOOL_NAME } from '../../tools/EnterPlanModeTool/constants.js'
import { EXIT_PLAN_MODE_TOOL_NAME } from '../../tools/ExitPlanModeTool/constants.js'
import { SKILL_TOOL_NAME } from '../../tools/SkillTool/constants.js'
import { getIsGit } from '../../utils/git.js'
import { registerBundledSkill } from '../bundledSkills.js'

const MIN_AGENTS = 5
const MAX_AGENTS = 30

const WORKER_INSTRUCTIONS = `完成更改后：
1. **简化** — 调用 \`${SKILL_TOOL_NAME}\` 工具，设置 \`skill: "simplify"\` 来审查和清理你的更改。
2. **运行单元测试** — 运行项目的测试套件（检查 package.json 脚本、Makefile 目标或常用命令如 \`npm test\`、\`bun test\`、\`pytest\`、\`go test\`）。如果测试失败，请修复。
3. **端到端测试** — 按照协调者提示中的 e2e 测试方案执行。如果方案说跳过此单元的 e2e 测试，则跳过。
4. **提交并推送** — 提交所有更改并附上清晰的提交信息，推送分支，然后使用 \`gh pr create\` 创建 PR。使用描述性标题。如果 \`gh\` 不可用或推送失败，请在最终消息中注明。
5. **报告** — 以单行结束：\`PR: <url>\` 以便协调者跟踪。如果未创建 PR，则以 \`PR: none — <原因>\` 结束。`

function buildPrompt(instruction: string): string {
  return `# 批处理：并行工作编排

你正在编排一个大规模、可并行的代码库变更。

## 用户指令

${instruction}

## 阶段 1：研究和规划（规划模式）

立即调用 \`${ENTER_PLAN_MODE_TOOL_NAME}\` 工具进入规划模式，然后：

1. **理解范围。** 启动一个或多个子代理（在前台运行 — 你需要它们的结果）来深入研究此指令涉及的内容。找到所有需要更改的文件、模式和调用点。理解现有约定以确保迁移一致。

2. **分解为独立单元。** 将工作分解为 ${MIN_AGENTS}–${MAX_AGENTS} 个自包含单元。每个单元必须：
   - 可在隔离的 git worktree 中独立实现（与兄弟单元无共享状态）
   - 可独立合并，不依赖其他单元的 PR 先合并
   - 大小大致均匀（拆分大单元，合并小单元）

   根据实际工作调整数量：少量文件 → 接近 ${MIN_AGENTS}；数百个文件 → 接近 ${MAX_AGENTS}。优先按目录或模块切片，而非任意文件列表。

3. **确定 e2e 测试方案。** 找出工作者如何验证其更改实际有效 — 而不仅仅是单元测试通过。查找：
   - \`claude-in-chrome\` 技能或浏览器自动化工具（用于 UI 更改：点击受影响的流程，截图结果）
   - \`tmux\` 或 CLI 验证器技能（用于 CLI 更改：交互式启动应用，测试更改的行为）
   - 开发服务器 + curl 模式（用于 API 更改：启动服务器，访问受影响的端点）
   - 现有的 e2e/集成测试套件

   如果找不到具体的 e2e 路径，使用 \`${ASK_USER_QUESTION_TOOL_NAME}\` 工具询问用户如何端到端验证此更改。提供 2-3 个具体选项（例如，"通过 chrome 扩展截图"、"运行 \`bun run dev\` 并 curl 端点"、"无 e2e — 单元测试足够"）。不要跳过此步骤 — 工作者无法自行询问用户。

   将方案写成简短、具体的步骤集，工作者可自主执行。包括任何设置（启动开发服务器、先构建）和验证的确切命令/交互。

4. **编写计划。** 在计划文件中包括：
   - 研究发现摘要
   - 编号的工作单元列表 — 每个单元：简短标题、涵盖的文件/目录列表、一行更改描述
   - e2e 测试方案（或用户选择跳过时的"跳过 e2e 因为…"）
   - 给每个代理的确切工作者指令（共享模板）

5. 调用 \`${EXIT_PLAN_MODE_TOOL_NAME}\` 提交计划等待批准。

## 阶段 2：生成工作者（计划批准后）

计划批准后，使用 \`${AGENT_TOOL_NAME}\` 工具为每个工作单元生成一个后台代理。**所有代理必须使用 \`isolation: "worktree"\` 和 \`run_in_background: true\`。** 在单个消息块中启动所有代理以并行运行。

每个代理的提示必须完全自包含。包括：
- 整体目标（用户指令）
- 此单元的特定任务（标题、文件列表、更改描述 — 从计划中逐字复制）
- 你发现的需要工作者遵循的代码库约定
- 计划中的 e2e 测试方案（或"跳过 e2e 因为…"）
- 以下工作者指令，逐字复制：

\`\`\`
${WORKER_INSTRUCTIONS}
\`\`\`

使用 \`subagent_type: "general-purpose"\`，除非有更具体的代理类型适用。

## 阶段 3：跟踪进度

启动所有工作者后，渲染初始状态表：

| # | 单元 | 状态 | PR |
|---|------|------|----|
| 1 | <标题> | 运行中 | — |
| 2 | <标题> | 运行中 | — |

当后台代理完成通知到达时，从每个代理的结果中解析 \`PR: <url>\` 行，并使用更新状态（\`完成\` / \`失败\`）和 PR 链接重新渲染表格。对未产生 PR 的代理记录简要失败说明。

所有代理报告后，渲染最终表格和单行摘要（例如，"22/24 个单元已合并为 PR"）。
`
}

const NOT_A_GIT_REPO_MESSAGE = `这不是 git 仓库。\`/batch\` 命令需要 git 仓库，因为它会在隔离的 git worktree 中生成代理并从每个代理创建 PR。请先初始化仓库，或在现有仓库中运行。`

const MISSING_INSTRUCTION_MESSAGE = `请提供描述批处理更改的指令。

示例：
  /batch 从 react 迁移到 vue
  /batch 将所有 lodash 替换为原生等效项
  /batch 为所有无类型函数参数添加类型注解`

export function registerBatchSkill(): void {
  registerBundledSkill({
    name: 'batch',
    description:
      '研究和规划大规模更改，然后在 5-30 个隔离的 worktree 代理中并行执行，每个代理创建一个 PR。',
    whenToUse:
      '当用户想要对多个文件进行大规模、机械性更改（迁移、重构、批量重命名）时使用，这些更改可分解为独立的并行单元。',
    argumentHint: '<instruction>',
    userInvocable: true,
    disableModelInvocation: true,
    async getPromptForCommand(args) {
      const instruction = args.trim()
      if (!instruction) {
        return [{ type: 'text', text: MISSING_INSTRUCTION_MESSAGE }]
      }

      const isGit = await getIsGit()
      if (!isGit) {
        return [{ type: 'text', text: NOT_A_GIT_REPO_MESSAGE }]
      }

      return [{ type: 'text', text: buildPrompt(instruction) }]
    },
  })
}
