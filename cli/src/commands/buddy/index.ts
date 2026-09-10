import type { Command } from '../../commands.js'

export default {
  type: 'local-jsx',
  name: 'buddy',
  description: '选择和管理你的桌面宠物',
  argumentHint: '[species|eye|hat|mute|unmute|reset]',
  load: () => import('./buddy.js'),
} satisfies Command
