/**
 * AOE Code: 指标收集已禁用
 *
 * 不再向 Anthropic 发送任何指标数据
 */

import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { logForDebugging } from '../../utils/debug.js'
import { logError } from '../../utils/log.js'
import { memoizeWithTTLAsync } from '../../utils/memoize.js'

type MetricsStatus = {
  enabled: boolean
  hasError: boolean
}

// In-memory TTL — dedupes calls within a single process
const CACHE_TTL_MS = 60 * 60 * 1000

// Disk TTL — org settings rarely change. When disk cache is fresher than this,
// we skip the network entirely (no background refresh).
const DISK_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * AOE Code: 始终返回禁用状态，不连接 Anthropic
 */
async function _checkMetricsEnabledAPI(): Promise<MetricsStatus> {
  // AOE Code: 指标收集已禁用
  logForDebugging('AOE Code: 指标收集已禁用')
  return { enabled: false, hasError: false }
}

// Create memoized version with custom error handling
const memoizedCheckMetrics = memoizeWithTTLAsync(
  _checkMetricsEnabledAPI,
  CACHE_TTL_MS,
)

/**
 * Fetch (in-memory memoized) and persist to disk on change.
 * Errors are not persisted — a transient failure should not overwrite a
 * known-good disk value.
 */
async function refreshMetricsStatus(): Promise<MetricsStatus> {
  const result = await memoizedCheckMetrics()
  if (result.hasError) {
    return result
  }

  const cached = getGlobalConfig().metricsStatusCache
  const unchanged = cached !== undefined && cached.enabled === result.enabled
  // Skip write when unchanged AND timestamp still fresh — avoids config churn
  // when concurrent callers race past a stale disk entry and all try to write.
  if (unchanged && Date.now() - cached.timestamp < DISK_CACHE_TTL_MS) {
    return result
  }

  saveGlobalConfig(current => ({
    ...current,
    metricsStatusCache: {
      enabled: result.enabled,
      timestamp: Date.now(),
    },
  }))
  return result
}

/**
 * Check if metrics are enabled for the current organization.
 *
 * AOE Code: 始终返回禁用状态
 */
export async function checkMetricsEnabled(): Promise<MetricsStatus> {
  // AOE Code: 始终返回禁用状态
  return { enabled: false, hasError: false }
}

// Export for testing purposes only
export const _clearMetricsEnabledCacheForTesting = (): void => {
  memoizedCheckMetrics.cache.clear()
}
