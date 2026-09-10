import type { Command } from '../../commands.js'

// AOE Code: Upgrade command disabled — no subscription plans
const upgrade = {
  type: 'local-jsx',
  name: 'upgrade',
  description: '升级功能不可用',
  isEnabled: () => false,
  isHidden: true,
  load: () => import('./upgrade.js'),
} satisfies Command

export default upgrade
