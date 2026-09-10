import type { Command } from '../../commands.js'

export default () =>
  ({
    type: 'local-jsx',
    name: 'chat',
    description: '与 AI 模型对话',
    isEnabled: () => true,
    argumentHint: '[model] [message]',
    load: () => import('./chat.js'),
  }) satisfies Command
