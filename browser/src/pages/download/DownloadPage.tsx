/**
 * 客户端下载页
 *
 * CLI / Desktop 分段切换，展示对应应用的发布版本列表：
 * 版本号 +「最新」标记 + 发布日期（UTC 朴素串转北京时间）+ 更新说明
 * + 各平台下载按钮（只渲染已配置的平台）。
 */

import { useCallback, useEffect, useState } from 'react'
import {
  getReleases,
  type ReleaseApp,
  type ReleaseItem,
  type ReleasePlatform,
} from '../../services/releases'
import './download.css'

/** 平台展示名与排序 */
const PLATFORM_LABELS: [ReleasePlatform, string][] = [
  ['win_x64', 'Windows x64'],
  ['win_arm64', 'Windows ARM64'],
  ['linux_x64', 'Linux x64'],
  ['linux_arm64', 'Linux ARM64'],
  ['mac_arm64', 'macOS (Apple Silicon)'],
]

/** UTC 朴素时间串 → 北京时间日期（如 2026/8/9） */
function formatBeijingDate(utcNaive: string): string {
  const time = new Date(`${utcNaive}Z`).getTime()
  if (Number.isNaN(time)) return ''
  return new Date(time).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })
}

/** 字节数 → MB/GB 展示 */
function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

/** 下载地址兜底补协议头（管理端可能填 www.xxx.com，否则会被当作站内相对路径） */
function normalizeDownloadUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; releases: ReleaseItem[] }
  | { status: 'error'; message: string }

export default function DownloadPage() {
  const [app, setApp] = useState<ReleaseApp>('cli')
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async (target: ReleaseApp) => {
    setState({ status: 'loading' })
    try {
      const releases = await getReleases(target)
      setState({ status: 'ready', releases })
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : '加载失败，请稍后重试',
      })
    }
  }, [])

  useEffect(() => {
    void load(app)
  }, [app, load])

  return (
    <div className="download-page">
      <header className="download-header">
        <h1 className="download-title">下载 AOE Code 客户端</h1>
        <p className="download-subtitle">获取 CLI 命令行工具与 Desktop 桌面应用的最新版本</p>
      </header>

      <div className="download-tabs">
        <button
          className={`download-tab${app === 'cli' ? ' download-tab--active' : ''}`}
          onClick={() => setApp('cli')}
        >
          CLI 命令行
        </button>
        <button
          className={`download-tab${app === 'desktop' ? ' download-tab--active' : ''}`}
          onClick={() => setApp('desktop')}
        >
          Desktop 桌面应用
        </button>
      </div>

      {state.status === 'loading' && <div className="download-state">加载中…</div>}

      {state.status === 'error' && (
        <div className="download-state download-state--error">
          <p>{state.message}</p>
          <button className="btn btn--primary" onClick={() => void load(app)}>
            重试
          </button>
        </div>
      )}

      {state.status === 'ready' && state.releases.length === 0 && (
        <div className="download-state">暂无可用版本</div>
      )}

      {state.status === 'ready' && state.releases.length > 0 && (
        <div className="download-list">
          {state.releases.map((release) => (
            <section key={release.version} className="release-card">
              <div className="release-card__head">
                <span className="release-card__version">v{release.version}</span>
                {release.is_latest && (
                  <span className="release-card__latest">最新</span>
                )}
                <span className="release-card__date">
                  {formatBeijingDate(release.created_at)}
                </span>
              </div>
              {release.release_notes && (
                <p className="release-card__notes">{release.release_notes}</p>
              )}
              <div className="release-card__downloads">
                {PLATFORM_LABELS.filter(([key]) => release.downloads[key]).map(
                  ([key, label]) => {
                    const download = release.downloads[key]!
                    return (
                      <a
                        key={key}
                        className="btn btn--ghost release-card__download"
                        href={normalizeDownloadUrl(download.url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {label}
                        {download.size != null && (
                          <span className="release-card__size">
                            {formatSize(download.size)}
                          </span>
                        )}
                      </a>
                    )
                  },
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
