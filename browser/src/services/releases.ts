/**
 * 客户端版本服务：CLI / Desktop 发布版本列表
 *
 * 接口：GET /v1/releases/?app=<app>&channel=stable（channel 固定 stable）。
 * downloads 仅包含已配置的平台，key 为平台标识（win_x64 等），
 * sha256 / size 可能缺省；created_at 为 UTC 朴素时间串。
 */

import { apiFetch } from '../lib/api'

/** 客户端应用标识 */
export type ReleaseApp = 'cli' | 'desktop'

/** 下载平台标识（mac 仅 Apple Silicon） */
export type ReleasePlatform =
  | 'win_x64'
  | 'win_arm64'
  | 'linux_x64'
  | 'linux_arm64'
  | 'mac_arm64'

/** 单个平台的下载信息（sha256 / size 可能缺省） */
export interface ReleaseDownload {
  url: string
  sha256?: string | null
  size?: number | null
}

/** 发布版本项 */
export interface ReleaseItem {
  app: ReleaseApp
  version: string
  channel: string
  release_notes: string | null
  is_latest: boolean
  downloads: Partial<Record<ReleasePlatform, ReleaseDownload>>
  /** UTC 朴素时间串，展示时需转北京时间 */
  created_at: string
}

interface ReleaseListResponse {
  releases: ReleaseItem[]
  total: number
}

/** 指定应用的版本列表（版本号倒序，接口已排好） */
export async function getReleases(app: ReleaseApp): Promise<ReleaseItem[]> {
  const res = await apiFetch<ReleaseListResponse>('/v1/releases/', {
    params: { app, channel: 'stable' },
  })
  return res.releases
}
