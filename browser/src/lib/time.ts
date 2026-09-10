/**
 * 时间格式化工具
 */

/** 相对时间（如「3 分钟前」），超过一周显示日期 */
export function relativeTime(iso: string | number): string {
  const time = typeof iso === 'number' ? iso : new Date(iso).getTime()
  const diff = Date.now() - time
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days <= 7) return `${days} 天前`
  return new Date(time).toLocaleDateString('zh-CN')
}
