/**
 * 发射场两级选择器（GNC 业务控件，视图区左上角）
 *
 * 第一级选国家/地区，第二级选该国的发射站；选中后菜单自动收起。
 * 国家排序：中国优先，其后按注册表中出现顺序（发射站参照表文档顺序）。
 */

import { useMemo, useState } from 'react'
import { LAUNCH_SITES } from './services/launchSites'

interface SiteMenuProps {
  /** 当前生效的发射站代码 */
  value: string
  onChange: (code: string) => void
}

export default function SiteMenu({ value, onChange }: SiteMenuProps) {
  const [open, setOpen] = useState(false)
  const current = LAUNCH_SITES.find((s) => s.code === value)

  // 国家列表（中国优先，其余按注册表顺序）
  const countries = useMemo(() => {
    const list: string[] = []
    for (const s of LAUNCH_SITES) {
      if (s.selectable && !list.includes(s.country)) list.push(s.country)
    }
    return list.sort((a, b) => (a === '中国' ? -1 : b === '中国' ? 1 : 0))
  }, [])
  const [country, setCountry] = useState(current?.country ?? '中国')

  const sites = LAUNCH_SITES.filter((s) => s.selectable && s.country === country)

  return (
    <div className="gnc-site-menu">
      <button
        className="pro-shell__view-toggle"
        onClick={() => setOpen((v) => !v)}
        title="选择发射场"
      >
        发射场：{current ? `${current.code} ${current.name}` : value} ▾
      </button>
      {open && (
        <div className="gnc-site-menu__panel">
          <div className="gnc-site-menu__countries">
            {countries.map((c) => (
              <button
                key={c}
                className={`gnc-site-menu__item${
                  c === country ? ' gnc-site-menu__item--active' : ''
                }`}
                onClick={() => setCountry(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="gnc-site-menu__sites">
            {sites.map((s) => (
              <button
                key={s.code}
                className={`gnc-site-menu__item${
                  s.code === value ? ' gnc-site-menu__item--active' : ''
                }`}
                onClick={() => {
                  onChange(s.code)
                  setOpen(false)
                }}
              >
                {s.code} {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
