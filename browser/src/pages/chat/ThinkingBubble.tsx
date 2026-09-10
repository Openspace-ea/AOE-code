/**
 * 等待回复指示气泡
 *
 * 根据流式阶段动态展示状态：
 * - thinking:  思考中…
 * - tool_call: 正在调用「{name}」…
 * - generating: 正在生成回复…
 * - compressing: 上下文过长，正在压缩…
 *
 * 无阶段信息时退化为带计时器的思考动画。
 */

import { useEffect, useState } from 'react'
import type { StreamStatus } from '../../services/conversation'

/** 工具名称 → 中文标签 */
const TOOL_LABELS: Record<string, string> = {
  search_knowledge: '搜索知识库',
  query_knowledge_base: '查询知识库',
  list_knowledge_files: '列出知识库文件',
  read_knowledge_file: '读取知识库文件',
  search_skill: '搜索技能',
  execute_skill: '执行技能',
  get_orbit_data: '获取轨道数据',
  web_search: '网络搜索',
}

function toolDisplayName(name: string): string {
  return TOOL_LABELS[name] ?? name
}

interface ThinkingBubbleProps {
  status?: StreamStatus | null
}

export default function ThinkingBubble({ status }: ThinkingBubbleProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  let text: string
  if (status?.phase === 'tool_call') {
    text = `正在调用「${toolDisplayName(status.name)}」`
  } else if (status?.phase === 'generating') {
    text = '正在生成回复'
  } else if (status?.phase === 'compressing') {
    text = '上下文过长，正在压缩'
  } else if (status?.phase === 'retrying') {
    text = status.reason || '请求失败，正在重试'
  } else {
    text = '正在思考'
  }

  return (
    <div className="msg msg--assistant">
      <div className="msg__bubble msg__bubble--thinking">
        {text}
        <span className="thinking-dots">
          <i>.</i>
          <i>.</i>
          <i>.</i>
        </span>
        {elapsed >= 3 && <span className="thinking-elapsed">{elapsed}s</span>}
      </div>
    </div>
  )
}
