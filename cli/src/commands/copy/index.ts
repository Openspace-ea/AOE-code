/**
 * Copy command - minimal metadata only.
 * Implementation is lazy-loaded from copy.tsx to reduce startup time.
 */
import type { Command } from '../../commands.js'

const copy = {
  type: 'local-jsx',
  name: 'copy',
  description:
    "复制 AOE Code 的最后响应到剪贴板（或 /copy N 复制第 N 个最新响应）",
  load: () => import('./copy.js'),
} satisfies Command

export default copy
