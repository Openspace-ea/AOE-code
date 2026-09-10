import type { Command } from '../../commands.js'

export default () =>
  ({
    type: 'local-jsx',
    name: 'models',
    description: '查看可用模型列表',
    isEnabled: () => true,
    load: () => import('./models.js'),
  }) satisfies Command
