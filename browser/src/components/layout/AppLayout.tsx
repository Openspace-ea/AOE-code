/**
 * 应用布局：顶栏 + 主工作区（路由出口）
 *
 * 顶栏：品牌 +「Web 版」胶囊 / 模块导航 / 点数徽标 / 用户菜单。
 * 侧边栏由各模块页面自行渲染（对话模块为会话列表，轨道模式为分组面板）。
 */

import { NavLink, Outlet } from 'react-router-dom'
import { BillingProvider } from './BillingContext'
import PointsBadge from './PointsBadge'
import UserMenu from './UserMenu'
import './layout.css'

export default function AppLayout() {
  return (
    <BillingProvider>
      <div className="app-layout">
        <header className="app-header">
          <div className="app-header__brand">
            <img src="/img/logo-64.png" alt="AOE Code" className="app-header__logo-img" />
            <span className="app-header__logo">AOE Code</span>
            <span className="app-header__capsule">Web 版</span>
          </div>
          <nav className="app-header__nav">
            <NavLink to="/chat" className="app-header__nav-link">
              通用对话
            </NavLink>
            <NavLink to="/pro" className="app-header__nav-link">
              专业模式
            </NavLink>
          </nav>
          <div className="app-header__right">
            <PointsBadge />
            <UserMenu />
          </div>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </BillingProvider>
  )
}
