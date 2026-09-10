/**
 * 场景管理浮框（Modal，跨专业场景通用）
 *
 * 场景的新建/切换/重命名/删除统一在这里完成，与工作区解耦。
 * 遮罩点击 / Esc 关闭；切换或新建后自动关闭并应用场景。
 * 场景存储由调用方负责（本组件只接数据与回调）；导航轨触发机制
 * （sessionStorage 标志 + aoe:open-scene-modal 事件）见 pro/modes.ts，不在此实现。
 */

import { useEffect, useState } from 'react'
import { relativeTime } from '../../../lib/time'

/** 场景条目：各模式的场景类型只要满足此结构即可复用本浮框 */
export interface SceneEntry {
  id: string
  name: string
  updatedAt: number
}

interface SceneManagerModalProps {
  scenes: SceneEntry[]
  activeSceneId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function SceneManagerModal({
  scenes,
  activeSceneId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onClose,
}: SceneManagerModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // Esc 关闭
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const commitRename = () => {
    const name = editingName.trim()
    const id = editingId
    setEditingId(null)
    if (id && name) onRename(id, name)
  }

  return (
    <div className="pro-shell__scene-modal-overlay" onClick={onClose}>
      <div className="pro-shell__scene-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pro-shell__scene-modal-header">
          <span className="pro-shell__scene-modal-title">场景管理</span>
          <button className="pro-shell__scene-modal-close" onClick={onClose} title="关闭">
            ✕
          </button>
        </header>

        <div className="pro-shell__scene-modal-body">
          <button className="btn btn--primary pro-shell__scene-modal-create" onClick={onCreate}>
            ＋ 新建场景
          </button>

          {scenes.length === 0 && (
            <p className="pro-shell__scene-modal-hint">还没有场景，点击上方按钮新建一个</p>
          )}

          <div className="pro-shell__scene-modal-list">
            {scenes.map((scene) =>
              editingId === scene.id ? (
                <input
                  key={scene.id}
                  className="pro-shell__scene-modal-edit"
                  value={editingName}
                  autoFocus
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
              ) : (
                <div
                  key={scene.id}
                  className={`pro-shell__scene-modal-item${
                    scene.id === activeSceneId ? ' pro-shell__scene-modal-item--active' : ''
                  }`}
                  onClick={() => onSelect(scene.id)}
                >
                  <span className="pro-shell__scene-modal-item-check">
                    {scene.id === activeSceneId ? '●' : ''}
                  </span>
                  <span className="pro-shell__scene-modal-item-name" title={scene.name}>
                    {scene.name}
                  </span>
                  <span className="pro-shell__scene-modal-item-time">
                    {relativeTime(scene.updatedAt)}
                  </span>
                  <span className="pro-shell__scene-modal-item-actions">
                    <button
                      title="重命名"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingId(scene.id)
                        setEditingName(scene.name)
                      }}
                    >
                      ✎
                    </button>
                    <button
                      title="删除"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm(`确定删除场景「${scene.name}」吗？`)) {
                          onDelete(scene.id)
                        }
                      }}
                    >
                      ✕
                    </button>
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
