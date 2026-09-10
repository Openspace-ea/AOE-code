/**
 * Read tool output limits.  Two caps apply to text reads:
 *
 *   | limit         | default | checks                    | cost          | on overflow     |
 *   |---------------|---------|---------------------------|---------------|-----------------|
 *   | maxSizeBytes  | 256 KB  | TOTAL FILE SIZE (not out) | 1 stat        | throws pre-read |
 *   | maxTokens     | 25000   | actual output tokens      | API roundtrip | throws post-read|
 *
 * Known mismatch: maxSizeBytes gates on total file size, not the slice.
 * Tested truncating instead of throwing for explicit-limit reads that
 * exceed the byte cap (#21841, Mar 2026).  Reverted: tool error rate
 * dropped but mean tokens rose — the throw path yields a ~100-byte error
 * tool-result while truncation yields ~25K tokens of content at the cap.
 *
 * Configuration priority:
 *   1. Environment variable CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS
 *   2. settings.json: fileReadMaxTokens / fileReadMaxSizeBytes
 *   3. GrowthBook feature flag
 *   4. Default values (25000 tokens, 256KB)
 */
import memoize from 'lodash-es/memoize.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from 'src/services/analytics/growthbook.js'
import { MAX_OUTPUT_SIZE } from 'src/utils/file.js'
import { getInitialSettings } from 'src/utils/settings/settings.js'

// Default max output tokens
export const DEFAULT_MAX_OUTPUT_TOKENS = 25000

/**
 * Env var override for max output tokens. Returns undefined when unset/invalid
 * so the caller can fall through to the next precedence tier.
 */
function getEnvMaxTokens(): number | undefined {
  const override = process.env.CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS
  if (override) {
    const parsed = parseInt(override, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return undefined
}

export type FileReadingLimits = {
  maxTokens: number
  maxSizeBytes: number
  includeMaxSizeInPrompt?: boolean
  targetedRangeNudge?: boolean
}

/**
 * Default limits for Read tool when the ToolUseContext doesn't supply an
 * override. Memoized so the GrowthBook value is fixed at first call — avoids
 * the cap changing mid-session as the flag refreshes in the background.
 *
 * Precedence for maxTokens: env var > GrowthBook > DEFAULT_MAX_OUTPUT_TOKENS.
 * (Env var is a user-set override, should beat experiment infrastructure.)
 *
 * Defensive: each field is individually validated; invalid values fall
 * through to the hardcoded defaults (no route to cap=0).
 */
export const getDefaultFileReadingLimits = memoize((): FileReadingLimits => {
  const override =
    getFeatureValue_CACHED_MAY_BE_STALE<Partial<FileReadingLimits> | null>(
      'tengu_amber_wren',
      {},
    )

  // Read from settings.json
  const settings = getInitialSettings()
  const settingsMaxTokens = settings.fileReadMaxTokens
  const settingsMaxSizeBytes = settings.fileReadMaxSizeBytes

  // Priority: env var > settings.json > GrowthBook > default
  const maxSizeBytes =
    (typeof settingsMaxSizeBytes === 'number' &&
    Number.isFinite(settingsMaxSizeBytes) &&
    settingsMaxSizeBytes > 0
      ? settingsMaxSizeBytes
      : typeof override?.maxSizeBytes === 'number' &&
          Number.isFinite(override.maxSizeBytes) &&
          override.maxSizeBytes > 0
        ? override.maxSizeBytes
        : MAX_OUTPUT_SIZE)

  const envMaxTokens = getEnvMaxTokens()
  const maxTokens =
    envMaxTokens ??
    (typeof settingsMaxTokens === 'number' &&
    Number.isFinite(settingsMaxTokens) &&
    settingsMaxTokens > 0
      ? settingsMaxTokens
      : typeof override?.maxTokens === 'number' &&
          Number.isFinite(override.maxTokens) &&
          override.maxTokens > 0
        ? override.maxTokens
        : DEFAULT_MAX_OUTPUT_TOKENS)

  const includeMaxSizeInPrompt =
    typeof override?.includeMaxSizeInPrompt === 'boolean'
      ? override.includeMaxSizeInPrompt
      : undefined

  const targetedRangeNudge =
    typeof override?.targetedRangeNudge === 'boolean'
      ? override.targetedRangeNudge
      : undefined

  return {
    maxSizeBytes,
    maxTokens,
    includeMaxSizeInPrompt,
    targetedRangeNudge,
  }
})
