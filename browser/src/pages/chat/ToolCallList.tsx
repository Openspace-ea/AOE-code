/**
 * 工具调用记录列表
 *
 * Agent Loop 运行中/完成后展示：
 * - 按轮次分组（多轮循环时显示「第 N 轮」分隔）
 * - 每条调用一行摘要（中文标签、关键参数、状态），点击展开详情
 * - 展开后显示完整参数（JSON）与结果内容；失败时显示错误原因
 */

import { useState } from 'react'
import type { ToolCallRecord } from '../../services/types'

/** 工具名称 → 中文标签（与 ThinkingBubble 保持一致） */
const TOOL_LABELS: Record<string, string> = {
  search_knowledge: '搜索知识库',
  query_knowledge_base: '查询知识库',
  read_knowledge_file: '读取知识库文件',
  search_skill: '搜索技能',
  execute_skill: '执行技能',
  get_orbit_data: '获取轨道数据',
  web_search: '网络搜索',
}

export function toolDisplayName(name: string): string {
  return TOOL_LABELS[name] ?? name
}

/** 取参数中最有展示价值的一项（优先 query） */
function argsPreview(args: Record<string, unknown>): string {
  const value = args.query ?? Object.values(args)[0]
  if (value === undefined) return ''
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > 40 ? `${text.slice(0, 40)}…` : text
}

function argsFull(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args, null, 2)
  } catch {
    return String(args)
  }
}

export default function ToolCallList({ records }: { records: ToolCallRecord[] }) {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set())
  if (records.length === 0) return null

  const toggle = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  // 按轮次分组（保持原始顺序）；只有一轮时不显示轮次分隔
  const groups: { turn: number; items: { record: ToolCallRecord; index: number }[] }[] = []
  records.forEach((record, index) => {
    const turn = record.turn ?? 1
    const last = groups[groups.length - 1]
    if (last && last.turn === turn) last.items.push({ record, index })
    else groups.push({ turn, items: [{ record, index }] })
  })
  const showTurnHeaders = groups.length > 1

  return (
    <div className="tool-calls">
      {groups.map((group) => (
        <div key={group.turn} className="tool-calls__group">
          {showTurnHeaders && (
            <div className="tool-calls__turn">
              第 {group.turn} 轮 · {group.items.length} 次调用
            </div>
          )}
          {group.items.map(({ record, index }) => {
            const isOpen = expanded.has(index)
            const hasDetail =
              Object.keys(record.args).length > 0 || record.result !== undefined || record.error
            return (
              <div key={index} className="tool-calls__entry">
                <div
                  className={`tool-calls__item${hasDetail ? ' tool-calls__item--clickable' : ''}`}
                  onClick={hasDetail ? () => toggle(index) : undefined}
                  title={hasDetail ? (isOpen ? '收起详情' : '展开详情') : undefined}
                >
                  <span className="tool-calls__icon">🔧</span>
                  <span className="tool-calls__name">{toolDisplayName(record.name)}</span>
                  {argsPreview(record.args) && (
                    <span className="tool-calls__args">{argsPreview(record.args)}</span>
                  )}
                  <span
                    className={`tool-calls__status ${
                      record.success === undefined
                        ? 'tool-calls__status--running'
                        : record.success
                          ? 'tool-calls__status--ok'
                          : 'tool-calls__status--fail'
                    }`}
                  >
                    {record.success === undefined ? '执行中…' : record.success ? '完成' : '失败'}
                  </span>
                  {hasDetail && (
                    <span className="tool-calls__chevron">{isOpen ? '▾' : '▸'}</span>
                  )}
                </div>
                {isOpen && hasDetail && (
                  <div className="tool-calls__detail">
                    {Object.keys(record.args).length > 0 && (
                      <>
                        <div className="tool-calls__detail-label">参数</div>
                        <pre className="tool-calls__detail-body">{argsFull(record.args)}</pre>
                      </>
                    )}
                    {record.result !== undefined && (
                      <>
                        <div className="tool-calls__detail-label">结果</div>
                        <pre className="tool-calls__detail-body">{record.result || '(空)'}</pre>
                      </>
                    )}
                    {record.error && (
                      <>
                        <div className="tool-calls__detail-label tool-calls__detail-label--error">
                          错误
                        </div>
                        <pre className="tool-calls__detail-body tool-calls__detail-body--error">
                          {record.error}
                        </pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
