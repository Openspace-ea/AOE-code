/**
 * 选中航天器详情面板（薄封装）
 *
 * 容器与样式在 pro/shell/DetailPanel（标题栏 + 关闭 + 键值列表）；
 * 这里只组装轨道业务数据项：静态信息（名称/NORAD/国际标识/分组）+
 * 轨道根数（远/近地点、倾角、周期）+ 实时数据（高度、速度，随传播节拍
 * 刷新）+ TLE 数据纪元。数值显示统一走 pro/shell/formatters。
 */

import DetailPanel from '../shell/DetailPanel'
import {
  formatAngleDeg,
  formatDistanceKm,
  formatSpeedKmS,
  formatUtcTime,
} from '../shell/formatters'
import type { OrbitElements, GeoPosition, SatelliteTle } from './services/types'
import { tleEpochDate } from './services/tle'
import { getGroup } from './services/groups'

interface SatelliteDetailPanelProps {
  tle: SatelliteTle
  elements: OrbitElements
  live: GeoPosition | null
  following: boolean
  onToggleFollow: () => void
  onClose: () => void
}

export default function SatelliteDetailPanel({
  tle,
  elements,
  live,
  following,
  onToggleFollow,
  onClose,
}: SatelliteDetailPanelProps) {
  const groupLabel = getGroup(tle.group)?.label ?? tle.group
  const liveBadge = <span className="pro-shell__detail-live">实时</span>

  return (
    <DetailPanel
      title={tle.name}
      closeTitle="取消选中"
      onClose={onClose}
      sections={[
        {
          items: [
            { key: 'NORAD 编号', value: tle.noradId },
            { key: '国际标识', value: tle.intlDes || '未知' },
            { key: '分组', value: groupLabel },
          ],
        },
        {
          items: [
            { key: '远地点', value: formatDistanceKm(elements.apogeeKm) },
            { key: '近地点', value: formatDistanceKm(elements.perigeeKm) },
            { key: '轨道倾角', value: formatAngleDeg(elements.inclinationDeg) },
            { key: '偏心率', value: elements.eccentricity.toFixed(4) },
            { key: '周期', value: `${elements.periodMin.toFixed(1)} min` },
            { key: '升交点赤经', value: formatAngleDeg(elements.raanDeg) },
            { key: '近地点幅角', value: formatAngleDeg(elements.argPerigeeDeg) },
            { key: '平近点角', value: formatAngleDeg(elements.meanAnomalyDeg) },
            { key: 'BSTAR', value: elements.bstar.toExponential(2) },
            {
              key: '海拔高度',
              value: live ? <>{formatDistanceKm(live.altKm)}{liveBadge}</> : '—',
            },
            {
              key: '速度',
              value: live ? <>{formatSpeedKmS(live.velocityKmS)}{liveBadge}</> : '—',
            },
          ],
        },
      ]}
      footer={
        <>
          <p className="pro-shell__detail-note">
            数据纪元：{formatUtcTime(tleEpochDate(tle.tleLine1))}
          </p>
          <div className="pro-shell__detail-actions">
            <button className="btn btn--ghost" onClick={onToggleFollow}>
              {following ? '取消跟踪' : '跟踪视角'}
            </button>
            <button className="btn btn--ghost" onClick={onClose}>
              取消选中
            </button>
          </div>
        </>
      }
    />
  )
}
