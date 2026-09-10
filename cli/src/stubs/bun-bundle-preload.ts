// Feature flags configuration — add features here to enable them
const ENABLED_FEATURES = new Set<string>([
  'BUDDY',               // Companion sprite (桌面宠物)
  'EXTRACT_MEMORIES',    // Auto-extract memories from conversations
  'TRANSCRIPT_CLASSIFIER', // Auto-mode classifier for permissions
  'REACTIVE_COMPACT',    // 响应式压缩：API 返回 prompt_too_long 时自动压缩
  // 'KAIROS',            // Assistant mode
  // 'PROACTIVE',         // Proactive mode
  // 'BRIDGE_MODE',       // IDE bridge
  // 'VOICE_MODE',        // Voice input
  // 'COORDINATOR_MODE',  // Multi-agent coordinator
  // 'WEB_BROWSER_TOOL',  // Web browser tool
  // 'DAEMON',            // Daemon mode
])

// Polyfill bun:bundle feature() function
// This module is preloaded via bunfig.toml before any other imports
const feature = (name: string): boolean => ENABLED_FEATURES.has(name)

// Register as a Bun plugin to intercept bun:bundle imports
if (typeof Bun !== 'undefined' && Bun.plugin) {
  const { plugin } = require('bun') as typeof import('bun')
  plugin({
    name: 'bun-bundle-polyfill',
    setup(build) {
      build.onResolve({ filter: /^bun:bundle$/ }, () => ({
        path: 'bun:bundle:polyfill',
        namespace: 'bun-bundle-ns',
      }))
      build.onLoad({ filter: /.*/, namespace: 'bun-bundle-ns' }, () => ({
        contents: `export function feature(name) { return ${JSON.stringify([...ENABLED_FEATURES])}.includes(name) }`,
        loader: 'js',
      }))
    },
  })
}
