/**
 * 底部状态栏：统一槽位容器
 *
 * 条目由场景注入（目标数/数据纪元/数据来源/底部署名等），
 * 样式变体用 pro-shell__stats-warn / -source / -attribution。
 */

import type { ReactNode } from 'react'

export default function StatBar({ children }: { children: ReactNode }) {
  return <div className="pro-shell__stats">{children}</div>
}
