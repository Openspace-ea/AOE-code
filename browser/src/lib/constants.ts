/**
 * 共享常量
 *
 * 地址类配置优先读 .env（VITE_* 变量），有合理默认值。
 */

/** 应用主页地址（顶栏菜单「主页」跳转）——读 .env，缺省 http://localhost:3000 */
export const HOME_URL: string = import.meta.env.VITE_HOME_URL || 'http://localhost:3000'

/** 用户控制台地址（顶栏菜单「控制台」跳转） */
export const CONSOLE_URL = `${HOME_URL}/console`

/** 个人中心地址（顶栏菜单「个人中心」跳转） */
export const PROFILE_URL = `${HOME_URL}/console/profile`

/** 充值页（402 点数不足时引导跳转） */
export const RECHARGE_URL = `${HOME_URL}/console/recharge`

