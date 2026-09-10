/**
 * 顶栏点数徽标：展示总余额，hover 提示每日桶/充值桶构成与重置时间
 */

import { useBilling } from './BillingContext'

export default function PointsBadge() {
  const { balance } = useBilling()
  if (!balance) return null

  const tip = `每日赠送剩余 ${balance.daily_points} 点 · 充值余额 ${balance.recharge_points} 点\n下次重置：${balance.reset_at} UTC`

  return (
    <span className="points-badge" title={tip}>
      <span className="points-badge__icon">◈</span>
      {balance.points} 点
    </span>
  )
}
