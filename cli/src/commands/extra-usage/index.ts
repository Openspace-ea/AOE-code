import type { Command } from '../../commands.js'

// AOE Code: Extra usage command disabled — no overage billing
export const extraUsage = {
  type: 'local-jsx',
  name: 'extra-usage',
  description: '额外使用量功能不可用',
  isEnabled: () => false,
  isHidden: true,
  load: () => import('./extra-usage.js'),
} satisfies Command

export const extraUsageNonInteractive = {
  type: 'local',
  name: 'extra-usage',
  supportsNonInteractive: true,
  description: '额外使用量功能不可用',
  isEnabled: () => false,
  isHidden: true,
  load: () => import('./extra-usage-noninteractive.js'),
} satisfies Command
