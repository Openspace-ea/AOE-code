/**
 * 上传附件按钮（会话内上传文本文件）
 *
 * 客户端读取文本文件内容，发送时内联进消息上下文（后端无会话附件接口，
 * 仅支持文本类文件；图片/PDF 需后端支持后接入）。限制：单文件 ≤ 2MB，
 * 内容截断至 50K 字符。
 */

import { useRef } from 'react'

/** 一个待发送的附件 */
export interface ChatAttachment {
  name: string
  content: string
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const MAX_CONTENT_CHARS = 50_000
const ACCEPT = '.md,.txt,.json,.csv,.log,.yaml,.yml,.xml,.sql,.py,.js,.ts,.tsx,.jsx,.html,.css,.sh,.c,.cpp,.h,.java,.go,.rs,.vue,.ini,.cfg,.toml'

interface UploadButtonProps {
  onAdd: (attachments: ChatAttachment[]) => void
  onError: (message: string) => void
  disabled?: boolean
}

export default function UploadButton({ onAdd, onError, disabled = false }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const accepted: ChatAttachment[] = []

    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_SIZE) {
        onError(`文件 ${file.name} 超过 2MB 限制`)
        continue
      }
      try {
        let content = await file.text()
        if (content.length > MAX_CONTENT_CHARS) {
          content = `${content.slice(0, MAX_CONTENT_CHARS)}\n…（内容过长已截断）`
        }
        accepted.push({ name: file.name, content })
      } catch {
        onError(`文件 ${file.name} 读取失败`)
      }
    }

    if (accepted.length > 0) onAdd(accepted)
    // 允许重复选择同一文件
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        className="model-selector__trigger"
        disabled={disabled}
        title="上传文本文件（内容随消息注入上下文）"
        onClick={() => inputRef.current?.click()}
      >
        📤 上传
      </button>
    </>
  )
}

/** 把附件内容拼进消息正文（内联上下文） */
export function buildContentWithAttachments(text: string, attachments: ChatAttachment[]): string {
  if (attachments.length === 0) return text
  const blocks = attachments.map(
    (a) => `【上传文件：${a.name}】\n\`\`\`\n${a.content}\n\`\`\``,
  )
  return [text, ...blocks].filter(Boolean).join('\n\n')
}
