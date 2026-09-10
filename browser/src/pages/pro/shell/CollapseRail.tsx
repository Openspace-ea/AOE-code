/**
 * 侧栏收起细条（左/右通用）
 *
 * 收起态仅一个展开按钮：左工作栏收起后显示「分组»」，
 * 右 Agent 面板收起后显示「Agent«」。
 */

interface CollapseRailProps {
  /** 细条所在侧：left=左工作栏，right=右 Agent 面板 */
  side: 'left' | 'right'
  onExpand: () => void
  /** 悬停提示（如「展开侧边栏」「展开 Agent 对话」） */
  title: string
}

export default function CollapseRail({ side, onExpand, title }: CollapseRailProps) {
  if (side === 'left') {
    return (
      <aside className="pro-shell__rail">
        <button className="pro-shell__rail-btn" onClick={onExpand} title={title}>
          分组 »
        </button>
      </aside>
    )
  }
  return (
    <aside className="pro-shell__rail--right">
      <button onClick={onExpand} title={title}>
        « Agent
      </button>
    </aside>
  )
}
