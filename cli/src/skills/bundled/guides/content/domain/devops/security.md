# 安全最佳实践

## OWASP Top 10 防护
- **注入**：参数化查询，ORM，输入验证
- **认证**：强密码策略，MFA，会话管理
- **敏感数据**：加密存储，HTTPS 传输
- **XXE**：禁用外部实体解析
- **访问控制**：最小权限原则，RBAC
- **安全配置**：移除默认账户，禁用调试模式
- **XSS**：输出编码，CSP 头
- **反序列化**：避免不可信数据反序列化
- **日志**：记录安全事件，不记录敏感信息
- **依赖**：定期更新，安全扫描

## 密钥管理
- 不要硬编码密钥
- 使用环境变量或密钥管理服务（Vault / AWS Secrets Manager）
- 密钥轮换策略
- `.gitignore` 排除敏感文件

## 认证与授权
- JWT：短有效期 + Refresh Token
- OAuth 2.0：Authorization Code Flow（Web 应用）
- API Key：限流 + IP 白名单
- Session：HttpOnly + Secure + SameSite Cookie

## 代码示例

```typescript
// 输入验证
import { z } from 'zod'

const UserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100),
})

// SQL 注入防护
const user = await db.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]  // 参数化查询
)

// 安全 HTTP 头
app.use(helmet())
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') }))
```

## 安全扫描工具
- SAST：Semgrep / CodeQL / SonarQube
- DAST：OWASP ZAP / Burp Suite
- SCA：Snyk / Dependabot / Trivy
- Secret Scanning：git-secrets / truffleHog
