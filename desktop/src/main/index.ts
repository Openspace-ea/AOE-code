/**
 * AOE Code Desktop - 主进程入口
 */

import { AuthClient, ConfigLoader } from '@aoe/core'

// 加载配置
const configLoader = new ConfigLoader()
const config = configLoader.getConfig()

// 初始化认证客户端
const authClient = new AuthClient(config.auth)

// 导出给渲染进程使用
export { authClient, config }
