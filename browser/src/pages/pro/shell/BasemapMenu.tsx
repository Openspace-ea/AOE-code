/**
 * 底图纹理选择菜单（视图区左上角）
 *
 * 选项列表由调用方提供（如轨道模式的本地纹理注册表，对应 render 预设的
 * EARTH_PRESET.basemaps），shell 只管 UI；选中后菜单自动收起。
 */

import { useState, type ReactNode } from 'react'

export interface BasemapOption {
  key: string
  label: string
}

interface BasemapMenuProps {
  /** 可选底图列表 */
  options: BasemapOption[]
  /** 当前生效的底图 key */
  value: string
  onChange: (key: string) => void
  /** 排在底图按钮之前的附加控件（预留槽位，如已下线的双引擎开关曾挂这里） */
  leading?: ReactNode
  /** 按钮悬停提示（默认「切换底图」；复用于发射场等场景时传入） */
  title?: string
  /** 选项很多时菜单滚动（如 GNC 发射场 41 项） */
  scrollable?: boolean
}

export default function BasemapMenu({
  options,
  value,
  onChange,
  leading,
  title = '切换底图',
  scrollable = false,
}: BasemapMenuProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="pro-shell__map-tools">
      {leading}
      <div className="pro-shell__basemap">
        <button
          className="pro-shell__view-toggle"
          onClick={() => setOpen((v) => !v)}
          title={title}
        >
          {options.find((b) => b.key === value)?.label} ▾
        </button>
        {open && (
          <div
            className={`pro-shell__basemap-menu${scrollable ? ' pro-shell__basemap-menu--scroll' : ''}`}
          >
            {options.map((b) => (
              <button
                key={b.key}
                className={`pro-shell__basemap-item${
                  b.key === value ? ' pro-shell__basemap-item--active' : ''
                }`}
                onClick={() => {
                  onChange(b.key)
                  setOpen(false)
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
