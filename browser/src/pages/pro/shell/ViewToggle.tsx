/**
 * 2D/3D 视图切换按钮（视图区右上角，与左上角底图切换分开）
 */

interface ViewToggleProps {
  viewMode: '3d' | '2d'
  onToggle: () => void
}

export default function ViewToggle({ viewMode, onToggle }: ViewToggleProps) {
  return (
    <button
      className="pro-shell__view-toggle pro-shell__view-toggle--tr"
      onClick={onToggle}
      title={viewMode === '3d' ? '切换到 2D 地图' : '切换到 3D 星球'}
    >
      {viewMode === '3d' ? '2D' : '3D'}
    </button>
  )
}
