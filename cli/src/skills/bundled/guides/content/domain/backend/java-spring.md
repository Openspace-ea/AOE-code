# Spring Boot 最佳实践

## 项目结构
```
src/main/java/com/example/
  controller/     # REST 控制器
  service/        # 业务逻辑
  repository/     # 数据访问（Spring Data JPA）
  model/          # 实体类
  dto/            # 数据传输对象
  config/         # 配置类
  exception/      # 异常处理
```

## 依赖注入
- 构造器注入（推荐）替代 `@Autowired` 字段注入
- `@Service` / `@Repository` / `@Component` 注解
- `@Configuration` + `@Bean` 定义第三方 Bean
- `@Value` 注入配置值

## REST API
- `@RestController` + `@RequestMapping`
- `@GetMapping` / `@PostMapping` 等快捷注解
- `@RequestBody` / `@PathVariable` / `@RequestParam`
- `ResponseEntity` 控制响应状态码

## 数据访问
- Spring Data JPA：接口继承 `JpaRepository`
- `@Query` 自定义 JPQL / 原生查询
- `@Transactional` 事务管理
- Flyway / Liquibase 数据库迁移

## 异常处理
- `@ControllerAdvice` + `@ExceptionHandler` 全局异常处理
- 自定义业务异常类
- 统一错误响应格式

## 代码示例

```java
@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getUser(@PathVariable Long id) {
        return userService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<UserDto> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserDto created = userService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}

@Service
@Transactional
public class UserService {
    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserDto create(CreateUserRequest request) {
        User user = new User(request.getName(), request.getEmail());
        return toDto(userRepository.save(user));
    }
}
```

## 常见反模式
- 避免：字段注入（用构造器注入）
- 避免：在 Controller 中写业务逻辑
- 避免：N+1 查询（用 `@EntityGraph` 或 `JOIN FETCH`）
- 避免：忽略事务边界
