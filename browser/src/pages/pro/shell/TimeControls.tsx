/**
 * 时间控制条：播放/暂停、倍速、回到实时
 * （时间显示在视图左下角独立位置，不与控件混排）
 */

interface TimeControlsProps {
  playing: boolean
  speed: number
  /** 仿真时钟（ms）：用于「回到实时」的自动禁用判断；无墙钟仿真时钟的场景
   * （如 GNC 的任务时间 T+ 秒）不传，回正按钮恒可用 */
  simTimeMs?: number
  /** 倍速档位（缺省 [1,10,30,60]；场景可覆盖，如 GNC 为 [1,10,60]） */
  speeds?: number[]
  /** 回正按钮文案（缺省「实时」= 回到实时；语义不同的场景可覆盖，如 GNC 传「重置」= 重置仿真） */
  resetLabel?: string
  /** 回正按钮悬停提示（缺省「回到实时」） */
  resetTitle?: string
  onTogglePlay: () => void
  onSetSpeed: (speed: number) => void
  /** 回到实时：仿真时间重置为系统当前时间，倍速归 1，继续播放 */
  onResetToLive: () => void
}

const DEFAULT_SPEEDS = [1, 10, 30, 60]

export default function TimeControls({
  playing,
  speed,
  simTimeMs,
  speeds = DEFAULT_SPEEDS,
  resetLabel = '实时',
  resetTitle = '回到实时',
  onTogglePlay,
  onSetSpeed,
  onResetToLive,
}: TimeControlsProps) {
  const isLive =
    simTimeMs !== undefined &&
    playing &&
    speed === 1 &&
    Math.abs(Date.now() - simTimeMs) < 5000

  return (
    <div className="pro-shell__time">
      <button
        className="pro-shell__time-btn"
        onClick={onTogglePlay}
        title={playing ? '暂停' : '播放'}
      >
        {playing ? '⏸' : '▶'}
      </button>
      {speeds.map((s) => (
        <button
          key={s}
          className={`pro-shell__time-btn${speed === s ? ' pro-shell__time-btn--active' : ''}`}
          onClick={() => onSetSpeed(s)}
        >
          {s}×
        </button>
      ))}
      <button
        className="pro-shell__time-btn"
        onClick={onResetToLive}
        disabled={isLive}
        title={resetTitle}
      >
        {resetLabel}
      </button>
    </div>
  )
}
