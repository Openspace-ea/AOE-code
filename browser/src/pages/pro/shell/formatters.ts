/**
 * 统一显示格式（设计文档 §3.2）
 *
 * 所有专业场景的数据显示必须走这里，保证跨场景观感一致；
 * 语义色一律用设计 token，不另起颜色。
 */

/** 仿真时间：YYYY-MM-DD HH:mm:ss（北京时间，UTC+8 偏移换算） */
export function formatSimTime(ms: number): string {
  return new Date(ms + 8 * 3600_000).toISOString().replace('T', ' ').slice(0, 19)
}

/** UTC 时间（秒级）：YYYY-MM-DD HH:mm:ss UTC；空值显示「未知」 */
export function formatUtcTime(date: Date | null): string {
  if (!date) return '未知'
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

/** UTC 时间（分钟级）：YYYY-MM-DD HH:mm UTC（状态栏数据纪元等紧凑场景用） */
export function formatUtcMinute(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

/** 高度/距离（km）：<1000 一位小数；≥1000 千分位整数；≥10000 万 km 一位小数 */
export function formatDistanceKm(km: number): string {
  if (km >= 10_000) return `${(km / 10_000).toFixed(1)} 万 km`
  if (km >= 1000) return `${Math.round(km).toLocaleString('en-US')} km`
  return `${km.toFixed(1)} km`
}

/** 速度（km/s）：两位小数 */
export function formatSpeedKmS(kmS: number): string {
  return `${kmS.toFixed(2)} km/s`
}

/** 经纬度：度两位小数 + 方位，如 39.90°N 116.40°E */
export function formatLatLon(latDeg: number, lonDeg: number): string {
  const lat = `${Math.abs(latDeg).toFixed(2)}°${latDeg >= 0 ? 'N' : 'S'}`
  const lon = `${Math.abs(lonDeg).toFixed(2)}°${lonDeg >= 0 ? 'E' : 'W'}`
  return `${lat} ${lon}`
}

/** 角度/倾角：度两位小数，如 51.64° */
export function formatAngleDeg(deg: number): string {
  return `${deg.toFixed(2)}°`
}

/** 点数/金额：两位小数，如 9.00 */
export function formatPoints(n: number): string {
  return n.toFixed(2)
}

/** 计数：千分位整数，如 12,345 */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}
