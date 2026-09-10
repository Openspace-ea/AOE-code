/**
 * 用户头像菜单（样式参考：docs/用户头像菜单-UI样式参考.md）
 *
 * 悬停展开信息卡（无需点击），移出收起。
 * 卡内展示昵称/邮箱/手机号/套餐 + 个人中心/控制台/主页链接。
 */

import { CONSOLE_URL, HOME_URL, PROFILE_URL } from '../../lib/constants'
import { useUser } from '../../lib/user'

export default function UserMenu() {
  const user = useUser()
  const name = user.nickname || user.email || user.phone || '用户'

  return (
    <div className="user-menu">
      <button className="user-menu-trigger" aria-label="用户菜单">
        <img
          src={user.avatar_url || '/img/avatar-default.png'}
          alt={name}
          className="header-avatar-img"
        />
      </button>

      <div className="user-menu-panel">
        <div className="user-menu-name">{name}</div>
        {user.email && <div className="user-menu-row">{user.email}</div>}
        {user.phone && <div className="user-menu-row">{user.phone}</div>}
        <div className="user-menu-row">当前套餐：{user.plan || '个人版'}</div>
        <div className="user-menu-divider" />
        <a
          href={PROFILE_URL}
          className="user-menu-item"
          target="_blank"
          rel="noreferrer"
        >
          个人中心
        </a>
        <a
          href={CONSOLE_URL}
          className="user-menu-item"
          target="_blank"
          rel="noreferrer"
        >
          控制台
        </a>
        <a
          href={HOME_URL}
          className="user-menu-item"
          target="_blank"
          rel="noreferrer"
        >
          主页
        </a>
      </div>
    </div>
  )
}
