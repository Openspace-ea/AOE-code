/**
 * 仿真时间角标（视图区左下角独立展示）
 *
 * 北京时间，随仿真时钟/倍速推演；显示格式走 formatters.formatSimTime。
 */

import { formatSimTime } from './formatters'

interface SimClockProps {
  /** 仿真时钟（毫秒时间戳） */
  simTimeMs: number
}

export default function SimClock({ simTimeMs }: SimClockProps) {
  return (
    <div className="pro-shell__sim-clock">
      {formatSimTime(simTimeMs)}
      <span className="pro-shell__sim-clock-zone">北京时间</span>
    </div>
  )
}
