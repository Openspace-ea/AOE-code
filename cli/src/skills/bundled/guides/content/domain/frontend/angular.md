# Angular 最佳实践

## 架构模式
- 使用 Standalone Components（Angular 14+），减少 NgModule 依赖
- 单一职责：每个组件/服务/模块只做一件事
- 使用 Signals（Angular 16+）替代部分 RxJS 场景
- 依赖注入贯穿始终，使用 `providedIn: 'root'`

## 组件设计
- 使用 `OnPush` 变更检测策略
- Smart / Dumb 组件模式：容器组件处理逻辑，展示组件只负责渲染
- 使用 `@Input` / `@Output` 装饰器（或 input/output 信号）
- 生命周期钩子按顺序排列

## RxJS 模式
- 用 `switchMap` 处理搜索/自动补全
- 用 `combineLatest` 合并多个数据源
- 用 `shareReplay(1)` 缓存 HTTP 响应
- 组件中用 `takeUntil` 或 `DestroyRef` 自动取消订阅
- 避免嵌套 subscribe

## 服务层
- HTTP 请求封装在 Service 中
- 使用 `inject()` 函数替代构造函数注入
- 错误统一处理：HTTP Interceptor

## 常见反模式
- 避免：在组件中直接操作 DOM（用 ViewChild 或 Renderer2）
- 避免：NgModule 和 Standalone 混用
- 避免：在模板中调用函数（用 pipe 或 computed）
- 避免：忘记取消订阅导致内存泄漏

## 代码示例

```typescript
// Standalone Component + Signals
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, UserCardComponent],
  template: `
    @for (user of users(); track user.id) {
      <app-user-card [user]="user" (select)="onSelect($event)" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListComponent {
  private userService = inject(UserService)
  users = this.userService.users
  selectedId = signal<string | null>(null)

  onSelect(id: string) {
    this.selectedId.set(id)
  }
}

// HTTP Service
@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient)
  private users$ = this.http.get<User[]>('/api/users').pipe(shareReplay(1))

  users = toSignal(this.users$, { initialValue: [] })

  getUser(id: string): Observable<User | undefined> {
    return this.users$.pipe(map(users => users.find(u => u.id === id)))
  }
}
```
