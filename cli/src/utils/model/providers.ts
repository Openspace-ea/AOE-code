import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/index.js'

export type APIProvider = 'openai'

// 缓存 settings 中的 provider 值
let _settingsProvider: string | undefined

/**
 * 设置 provider（目前仅支持 openai）
 */
export function setSettingsProvider(provider: string | undefined): void {
  _settingsProvider = provider
}

export function getAPIProvider(): APIProvider {
  return 'openai'
}

export function getAPIProviderForStatsig(): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return getAPIProvider() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
}

/**
 * AOE Code 仅支持 OpenAI 兼容 API，始终返回 true
 */
export function isFirstPartyAnthropicBaseUrl(): boolean {
  return false
}
