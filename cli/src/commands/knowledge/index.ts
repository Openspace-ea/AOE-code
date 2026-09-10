/**
 * Knowledge command - direct output without LLM
 */
import type { Command } from '../../commands.js'

const knowledge = {
  type: 'local',
  name: 'knowledge',
  description: '管理知识库（list/activate/deactivate/info）',
  argumentHint: '[list|activate|deactivate|info|active] [名称]',
  supportsNonInteractive: true,
  load: () => import('./knowledge.js'),
} satisfies Command

export default knowledge
