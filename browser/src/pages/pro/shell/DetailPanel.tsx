/**
 * 详情/参数面板统一容器
 *
 * 标题栏 + 关闭 + 键值列表（值右对齐等宽数字字体）+ 段间分隔线
 * + 可选分组小标题 + 底部插槽。场景只传数据项，不碰样式。
 */

import { Fragment, type ReactNode } from 'react'

/** 键值条目：值支持 ReactNode（可带「实时」徽标等行内标记） */
export interface DetailItem {
  key: string
  value: ReactNode
  /** 参数说明（点击 ℹ️ 显示） */
  description?: string
}

/** 键值分组：段间以分隔线分开，可带小标题 */
export interface DetailSection {
  /** 分组小标题（可选） */
  title?: string
  items: DetailItem[]
}

interface DetailPanelProps {
  /** 面板标题（如目标名称） */
  title: string
  onClose: () => void
  /** 关闭按钮悬停提示（缺省「关闭」） */
  closeTitle?: string
  sections: DetailSection[]
  /** 底部插槽（数据纪元、操作按钮等） */
  footer?: ReactNode
  /** 标题栏右侧额外内容（如模式切换按钮） */
  headerExtra?: ReactNode
}

export default function DetailPanel({
  title,
  onClose,
  closeTitle = '关闭',
  sections,
  footer,
  headerExtra,
}: DetailPanelProps) {
  return (
    <aside className="pro-shell__detail">
      <header className="pro-shell__detail-header">
        <h3 className="pro-shell__detail-title" title={title}>
          {title}
        </h3>
        {headerExtra}
        <button className="pro-shell__detail-close" onClick={onClose} title={closeTitle}>
          ✕
        </button>
      </header>

      {sections.map((section, index) => (
        <Fragment key={index}>
          {index > 0 && <div className="pro-shell__detail-divider" />}
          {section.title && (
            <div className="pro-shell__detail-section-title">{section.title}</div>
          )}
          <dl className="pro-shell__detail-grid">
            {section.items.map((item) => (
              <Fragment key={item.key}>
                <dt>
                  {item.key}
                  {item.description && (
                    <button
                      className="pro-shell__detail-info"
                      title={item.description}
                    >
                      ℹ
                    </button>
                  )}
                </dt>
                <dd>{item.value}</dd>
              </Fragment>
            ))}
          </dl>
        </Fragment>
      ))}

      {footer && (
        <>
          <div className="pro-shell__detail-divider" />
          {footer}
        </>
      )}
    </aside>
  )
}
