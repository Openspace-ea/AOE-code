/**
 * Build configuration
 * Read at runtime from build-config.json (set during compile time)
 */

import { readFileSync } from 'fs'
import { join } from 'path'

interface BuildConfig {
  mode: 'online' | 'offline'
}

let _config: BuildConfig | null = null

function loadBuildConfig(): BuildConfig {
  if (_config) return _config

  try {
    // In compiled binary, this won't exist - use default
    const configPath = join(process.cwd(), 'build-config.json')
    const content = readFileSync(configPath, 'utf-8')
    _config = JSON.parse(content)
  } catch {
    _config = { mode: 'offline' }
  }

  return _config!
}

export function isOnlineModeEnabled(): boolean {
  return loadBuildConfig().mode === 'online'
}
