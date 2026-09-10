/**
 * 验证工具函数
 */

/**
 * 验证邮箱
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 验证密码强度
 */
export function validatePassword(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('密码长度至少 8 位')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('密码需包含大写字母')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('密码需包含小写字母')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('密码需包含数字')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * 验证用户名
 */
export function validateUsername(username: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (username.length < 3) {
    errors.push('用户名长度至少 3 位')
  }
  if (username.length > 20) {
    errors.push('用户名长度最多 20 位')
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('用户名只能包含字母、数字和下划线')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
