import chalk from 'chalk'
import type { DailyActivity } from './stats.js'
import { toDateString } from './statsCache.js'

export type HeatmapOptions = {
  terminalWidth?: number // Terminal width in characters
  showMonthLabels?: boolean
}

type Percentiles = {
  p25: number
  p50: number
  p75: number
}

/**
 * Pre-calculates percentiles from activity data for use in intensity calculations
 */
function calculatePercentiles(
  dailyActivity: DailyActivity[],
): Percentiles | null {
  const counts = dailyActivity
    .map(a => a.messageCount)
    .filter(c => c > 0)
    .sort((a, b) => a - b)

  if (counts.length === 0) return null

  return {
    p25: counts[Math.floor(counts.length * 0.25)]!,
    p50: counts[Math.floor(counts.length * 0.5)]!,
    p75: counts[Math.floor(counts.length * 0.75)]!,
  }
}

/**
 * Generates a GitHub-style activity heatmap for the terminal
 */
export function generateHeatmap(
  dailyActivity: DailyActivity[],
  options: HeatmapOptions = {},
): string {
  const { terminalWidth = 80, showMonthLabels = true } = options

  // Day labels take 4 characters ("Mon "), calculate weeks that fit
  // Cap at 52 weeks (1 year) to match GitHub style
  const dayLabelWidth = 4
  const availableWidth = terminalWidth - dayLabelWidth
  const width = Math.min(52, Math.max(10, availableWidth))

  // Build activity map by date
  const activityMap = new Map<string, DailyActivity>()
  for (const activity of dailyActivity) {
    activityMap.set(activity.date, activity)
  }

  // Pre-calculate percentiles once for all intensity lookups
  const percentiles = calculatePercentiles(dailyActivity)

  // Calculate date range - end at today, go back N weeks
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Find the Sunday of the current week (start of the week containing today)
  const currentWeekStart = new Date(today)
  currentWeekStart.setDate(today.getDate() - today.getDay())

  // Go back (width - 1) weeks from the current week start
  const startDate = new Date(currentWeekStart)
  startDate.setDate(startDate.getDate() - (width - 1) * 7)

  // Generate grid (7 rows for days of week, width columns for weeks)
  // Also track which week each month starts for labels
  const grid: string[][] = Array.from({ length: 7 }, () =>
    Array(width).fill(''),
  )
  const monthStarts: { month: number; week: number }[] = []
  let lastMonth = -1

  const currentDate = new Date(startDate)
  for (let week = 0; week < width; week++) {
    for (let day = 0; day < 7; day++) {
      // Don't show future dates
      if (currentDate > today) {
        grid[day]![week] = ' '
        currentDate.setDate(currentDate.getDate() + 1)
        continue
      }

      const dateStr = toDateString(currentDate)
      const activity = activityMap.get(dateStr)

      // Track month changes (on day 0 = Sunday of each week)
      if (day === 0) {
        const month = currentDate.getMonth()
        if (month !== lastMonth) {
          monthStarts.push({ month, week })
          lastMonth = month
        }
      }

      // Determine intensity level based on message count
      const intensity = getIntensity(activity?.messageCount || 0, percentiles)
      grid[day]![week] = getHeatmapChar(intensity)

      currentDate.setDate(currentDate.getDate() + 1)
    }
  }

  // Build output
  const lines: string[] = []

  // Month and year labels
  if (showMonthLabels) {
    const monthNames = [
      '1月', '2月', '3月', '4月', '5月', '6月',
      '7月', '8月', '9月', '10月', '11月', '12月',
    ]
    // Chinese day label "一" is 2 cols, padEnd(2)=2, + " " separator = 3 cols before grid
    const DL = 3

    // Build month label line — position each label at its week column
    // Ensure ≥1 space gap between labels; skip label at week 0 (collides with day labels)
    let monthLine = ' '.repeat(DL)
    for (const { month, week } of monthStarts) {
      if (week === 0) continue // skip — would overlap day label column
      const label = monthNames[month]!
      const targetCol = DL + week
      const curW = getTerminalWidth(monthLine)
      // Ensure at least 1 space gap from previous content
      const col = Math.max(targetCol, curW + 1)
      monthLine += ' '.repeat(Math.max(0, col - curW)) + label
    }
    // Year labels — show year above its first month
    const yearStarts: { year: number; week: number }[] = []
    let prevYear = -1
    for (const { month, week } of monthStarts) {
      if (month === 0 || week === 0) continue // skip labels that were dropped
      // Determine the year: reconstruct from monthStarts context
      // monthStarts are chronological; month going backward = new year
      const year = prevYear === -1 || month <= prevYear
        ? (prevYear === -1
            ? new Date(startDate.getFullYear(), month, 1).getFullYear()
            : yearStarts[yearStarts.length - 1]!.year + 1)
        : yearStarts[yearStarts.length - 1]!.year
      if (yearStarts.length === 0 || year !== yearStarts[yearStarts.length - 1]!.year) {
        yearStarts.push({ year, week })
      }
      prevYear = month
    }

    if (yearStarts.length > 0) {
      let yearLine = ' '.repeat(DL)
      for (const { year, week } of yearStarts) {
        const label = `${year}年`
        const targetCol = DL + week
        const curW = getTerminalWidth(yearLine)
        const col = Math.max(targetCol, curW + 1)
        yearLine += ' '.repeat(Math.max(0, col - curW)) + label
      }
      lines.push(yearLine)
    }

    lines.push(monthLine)
  }

  // Day labels
  const dayLabels = ['日', '一', '二', '三', '四', '五', '六']

  // Grid
  for (let day = 0; day < 7; day++) {
    // Only show labels for Mon, Wed, Fri
    // Chinese chars are double-width: "一" = 2 cols, padEnd(2) = 2, then " " = 1 col → 3 total (matches DL=3)
    const label = [1, 3, 5].includes(day) ? dayLabels[day]!.padEnd(2) : '  '
    const row = label + ' ' + grid[day]!.join('')
    lines.push(row)
  }

  // Legend
  lines.push('')
  lines.push(
    '   少 ' +
      [
        claudeOrange('░'),
        claudeOrange('▒'),
        claudeOrange('▓'),
        claudeOrange('█'),
      ].join(' ') +
      ' 多',
  )

  return lines.join('\n')
}

/**
 * Estimates terminal column width (Chinese/CJK chars = 2, ASCII = 1)
 */
function getTerminalWidth(str: string): number {
  let width = 0
  for (const char of str) {
    const code = char.codePointAt(0)!
    // CJK Unified Ideographs + common CJK ranges
    if (code >= 0x4e00 && code <= 0x9fff) {
      width += 2
    } else {
      width += 1
    }
  }
  return width
}

function getIntensity(
  messageCount: number,
  percentiles: Percentiles | null,
): number {
  if (messageCount === 0 || !percentiles) return 0

  if (messageCount >= percentiles.p75) return 4
  if (messageCount >= percentiles.p50) return 3
  if (messageCount >= percentiles.p25) return 2
  return 1
}

// Claude orange color (hex #da7756)
const claudeOrange = chalk.hex('#da7756')

function getHeatmapChar(intensity: number): string {
  switch (intensity) {
    case 0:
      return chalk.gray('·')
    case 1:
      return claudeOrange('░')
    case 2:
      return claudeOrange('▒')
    case 3:
      return claudeOrange('▓')
    case 4:
      return claudeOrange('█')
    default:
      return chalk.gray('·')
  }
}
