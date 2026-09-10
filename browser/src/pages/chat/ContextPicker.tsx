/**
 * 上下文选择器：关联知识库 / 技能（创建会话时）
 *
 * 输入框控制栏内的两个胶囊按钮（🌐 知识库 / 🛠 技能），点击弹出
 * 勾选列表（向上展开），样式复用 model-selector。选中数量显示在按钮上。
 * 关联在创建会话时生效（6.1），后端会把目录索引/技能描述注入 system prompt。
 */

import { useEffect, useRef, useState } from 'react'
import type { KnowledgeBaseInfo, SkillInfo } from '../../services/types'

interface ContextPickerProps {
  knowledgeBases: KnowledgeBaseInfo[] | null
  skills: SkillInfo[] | null
  selectedKbIds: string[]
  selectedSkillIds: string[]
  onToggleKb: (id: string) => void
  onToggleSkill: (id: string) => void
  disabled?: boolean
}

type Panel = 'kb' | 'skill' | null

export default function ContextPicker({
  knowledgeBases,
  skills,
  selectedKbIds,
  selectedSkillIds,
  onToggleKb,
  onToggleSkill,
  disabled = false,
}: ContextPickerProps) {
  const [openPanel, setOpenPanel] = useState<Panel>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // 点击外部收起
  useEffect(() => {
    if (!openPanel) return
    const onClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpenPanel(null)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [openPanel])

  const togglePanel = (panel: Panel) => {
    setOpenPanel((current) => (current === panel ? null : panel))
  }

  return (
    <div className="model-selector" ref={rootRef}>
      <div className="context-picker">
        <button
          type="button"
          className="model-selector__trigger"
          disabled={disabled || knowledgeBases === null || knowledgeBases.length === 0}
          title="关联知识库"
          onClick={() => togglePanel('kb')}
        >
          🌐 知识库{selectedKbIds.length > 0 && ` ×${selectedKbIds.length}`}
        </button>
        <button
          type="button"
          className="model-selector__trigger"
          disabled={disabled || skills === null || skills.length === 0}
          title="关联技能"
          onClick={() => togglePanel('skill')}
        >
          🛠 技能{selectedSkillIds.length > 0 && ` ×${selectedSkillIds.length}`}
        </button>
      </div>

      {openPanel === 'kb' && knowledgeBases && (
        <div className="model-selector__dropdown">
          {knowledgeBases.map((kb) => (
            <button
              key={kb.id}
              type="button"
              className={`model-selector__option${
                selectedKbIds.includes(kb.id) ? ' model-selector__option--active' : ''
              }`}
              title={kb.description}
              onClick={() => onToggleKb(kb.id)}
            >
              <span className="model-selector__option-name">
                {selectedKbIds.includes(kb.id) ? '☑' : '☐'} {kb.display_name}
              </span>
              <span className="model-selector__option-provider">{kb.file_count} 文件</span>
            </button>
          ))}
        </div>
      )}

      {openPanel === 'skill' && skills && (
        <div className="model-selector__dropdown">
          {skills.map((skill) => (
            <button
              key={skill.id}
              type="button"
              className={`model-selector__option${
                selectedSkillIds.includes(skill.id) ? ' model-selector__option--active' : ''
              }`}
              title={skill.description}
              onClick={() => onToggleSkill(skill.id)}
            >
              <span className="model-selector__option-name">
                {selectedSkillIds.includes(skill.id) ? '☑' : '☐'} {skill.display_name}
              </span>
              <span className="model-selector__option-provider">{skill.skill_type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
