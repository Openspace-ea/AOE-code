# Node.js + Express 最佳实践

## 项目结构

```
project/
├── src/
│   ├── controllers/      # 请求处理
│   ├── services/         # 业务逻辑
│   ├── repositories/     # 数据访问
│   ├── models/           # 数据模型
│   ├── middleware/        # 中间件
│   ├── routes/           # 路由定义
│   ├── utils/            # 工具函数
│   └── app.ts            # Express 应用
├── tests/
├── config/
└── package.json
```

## 路由组织

### 模块化路由

```typescript
// routes/userRoutes.ts
import { Router } from 'express'
import { UserController } from '../controllers/userController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.get('/', UserController.getAll)
router.get('/:id', UserController.getById)
router.post('/', authMiddleware, UserController.create)
router.put('/:id', authMiddleware, UserController.update)
router.delete('/:id', authMiddleware, UserController.delete)

export default router

// app.ts
import userRoutes from './routes/userRoutes'

app.use('/api/users', userRoutes)
```

## 中间件

### 错误处理中间件

```typescript
// middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message
    })
  }

  console.error('Unexpected error:', err)
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  })
}
```

### 请求验证中间件

```typescript
// middleware/validate.ts
import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: result.error.errors
      })
    }
    req.body = result.data
    next()
  }
}

// 使用
import { z } from 'zod'

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
})

router.post('/users', validate(createUserSchema), UserController.create)
```

## 数据库操作

### Repository 模式

```typescript
// repositories/userRepository.ts
import { prisma } from '../lib/prisma'
import { User, CreateUserDTO } from '../models/user'

export class UserRepository {
  async findAll(): Promise<User[]> {
    return prisma.user.findMany()
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } })
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } })
  }

  async create(data: CreateUserDTO): Promise<User> {
    return prisma.user.create({ data })
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return prisma.user.update({ where: { id }, data })
  }

  async delete(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } })
  }
}
```

## 认证与授权

### JWT 认证

```typescript
// middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

interface JwtPayload {
  userId: string
  email: string
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return res.status(401).json({ message: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' })
  }
}
```

## 日志与监控

### 结构化日志

```typescript
// utils/logger.ts
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
})

// 使用
logger.info('User created', { userId: user.id, email: user.email })
logger.error('Database connection failed', { error: err.message })
```

## 测试

### 单元测试

```typescript
// services/userService.test.ts
import { UserService } from './userService'
import { UserRepository } from '../repositories/userRepository'

jest.mock('../repositories/userRepository')

describe('UserService', () => {
  let userService: UserService
  let userRepo: jest.Mocked<UserRepository>

  beforeEach(() => {
    userRepo = new UserRepository() as jest.Mocked<UserRepository>
    userService = new UserService(userRepo)
  })

  describe('createUser', () => {
    it('should create a new user', async () => {
      const userData = { name: 'Test', email: 'test@example.com', password: 'password123' }
      userRepo.findByEmail.mockResolvedValue(null)
      userRepo.create.mockResolvedValue({ id: '1', ...userData })

      const result = await userService.createUser(userData)

      expect(result).toHaveProperty('id')
      expect(userRepo.create).toHaveBeenCalledWith(userData)
    })

    it('should throw if email already exists', async () => {
      const userData = { name: 'Test', email: 'existing@example.com', password: 'password123' }
      userRepo.findByEmail.mockResolvedValue({ id: '1', ...userData })

      await expect(userService.createUser(userData)).rejects.toThrow('Email already exists')
    })
  })
})
```

### 集成测试

```typescript
// routes/userRoutes.test.ts
import request from 'supertest'
import { app } from '../app'

describe('User Routes', () => {
  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('id')
    })

    it('should return 400 for invalid data', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({ name: 'T' })

      expect(res.status).toBe(400)
    })
  })
})
```
