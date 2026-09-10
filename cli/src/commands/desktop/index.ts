import type { Command } from '../../commands.js'

// AOE Code: Desktop command disabled — no desktop app available
const desktop = {
  type: 'local-jsx',
  name: 'desktop',
  aliases: ['app'],
  description: '桌面版功能不可用',
  isEnabled: () => false,
  isHidden: true,
  load: () => import('./desktop.js'),
} satisfies Command

export default desktop
