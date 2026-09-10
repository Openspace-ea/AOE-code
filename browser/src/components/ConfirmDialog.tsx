/**
 * 确认弹窗（产品风格统一，替代原生 window.confirm）
 *
 * 用于回滚等破坏性操作的二次确认：标题 + 后果说明 + 取消/确认按钮，
 * 确认按钮为危险色。点击遮罩或「取消」关闭。
 */

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** 后果说明（明确告知用户会发生什么） */
  description: string
  confirmText?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="confirm-dialog__overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="confirm-dialog__header">
          <span className="confirm-dialog__title">{title}</span>
        </header>
        <p className="confirm-dialog__desc">{description}</p>
        <footer className="confirm-dialog__footer">
          <button className="btn btn--ghost" onClick={onCancel}>
            取消
          </button>
          <button className="btn confirm-dialog__danger" onClick={onConfirm}>
            {confirmText}
          </button>
        </footer>
      </div>
    </div>
  )
}
