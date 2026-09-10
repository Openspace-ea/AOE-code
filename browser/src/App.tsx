/**
 * 应用根组件
 *
 * 登录门禁：无 token → 整页跳官网登录页；有 token → 调 /auth/me 校验，
 * 401 清除 token 重新跳登录页，其他错误给出重试入口。
 * 校验通过后注入当前用户并挂载路由。
 */

import { useEffect, useState, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import {
  ApiError,
  fetchCurrentUser,
  getToken,
  logout,
  redirectToLogin,
  type CurrentUser,
} from './lib/auth'
import { UserProvider } from './lib/user'
import AppLayout from './components/layout/AppLayout'
import ChatPage from './pages/chat/ChatPage'
import DownloadPage from './pages/download/DownloadPage'
import ProLayout from './pages/pro/ProLayout'

// 轨道模式体积大（satellite.js 等），按需分包，不拖慢对话首屏
const OrbitPage = lazy(() => import('./pages/pro/orbit/OrbitPage'))
// GNC 仿真（@gnc/core 物理），同样按需分包
const LaunchPage = lazy(() => import('./pages/pro/gnc/LaunchPage'))
// 测控仿真（AST 可见性分析），按需分包
const StationPage = lazy(() => import('./pages/pro/station/StationPage'))

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/chat" replace /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'chat/:id', element: <ChatPage /> },
      // 客户端下载页：CLI / Desktop 版本列表与下载链接
      { path: 'download', element: <DownloadPage /> },
      // 专业模式：容器布局（左侧模式导航轨），轨道模式为首个子场景，
      // 后续发射模拟/对接模拟/ATK 等挂 /pro/<mode>
      {
        path: 'pro',
        element: <ProLayout />,
        children: [
          { index: true, element: <Navigate to="/pro/orbit" replace /> },
          {
            path: 'orbit',
            element: (
              <Suspense
                fallback={
                  <div className="orbit-suspense-fallback">轨道模式加载中…</div>
                }
              >
                <OrbitPage />
              </Suspense>
            ),
          },
          {
            path: 'gnc',
            element: (
              <Suspense
                fallback={
                  <div className="orbit-suspense-fallback">发射模拟加载中…</div>
                }
              >
                <LaunchPage />
              </Suspense>
            ),
          },
          {
            path: 'station',
            element: (
              <Suspense
                fallback={
                  <div className="orbit-suspense-fallback">测控仿真加载中…</div>
                }
              >
                <StationPage />
              </Suspense>
            ),
          },
        ],
      },
      // 旧路径兼容
      { path: 'orbit', element: <Navigate to="/pro/orbit" replace /> },
    ],
  },
])

type AuthState =
  | { status: 'checking'; hint: string }
  | { status: 'authed'; user: CurrentUser }
  | { status: 'error'; message: string }

export default function App() {
  const [state, setState] = useState<AuthState>({
    status: 'checking',
    hint: '正在验证登录状态…',
  })

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setState({ status: 'checking', hint: '未登录，正在跳转登录页…' })
      redirectToLogin()
      return
    }
    fetchCurrentUser(token)
      .then((user) => setState({ status: 'authed', user }))
      .catch((error) => {
        // token 失效：清除本地 token 并重新跳登录页
        if (error instanceof ApiError && error.status === 401) {
          setState({ status: 'checking', hint: '登录已过期，正在重新跳转登录页…' })
          logout()
          return
        }
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : '网络异常，请稍后重试',
        })
      })
  }, [])

  if (state.status === 'checking') {
    return <Centered>{state.hint}</Centered>
  }

  if (state.status === 'error') {
    return (
      <Centered>
        <p style={{ margin: 0, color: 'var(--error)' }}>{state.message}</p>
        <button className="btn btn--primary" onClick={() => window.location.reload()}>
          重试
        </button>
      </Centered>
    )
  }

  return (
    <UserProvider value={state.user}>
      <RouterProvider router={router} />
    </UserProvider>
  )
}

/** 居中容器：门禁各状态共用 */
function Centered({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: 'var(--text)',
      }}
    >
      {children}
    </div>
  )
}
