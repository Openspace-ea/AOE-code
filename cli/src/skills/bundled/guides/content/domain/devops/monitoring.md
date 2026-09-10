# 监控与可观测性

## 三大支柱
- **Metrics**（指标）：Prometheus + Grafana
  - RED 方法：Rate, Errors, Duration
  - USE 方法：Utilization, Saturation, Errors
- **Logs**（日志）：ELK / Loki + Grafana
  - 结构化日志：JSON 格式
  - 关键字段：timestamp, level, message, trace_id
- **Traces**（链路）：Jaeger / Tempo / Zipkin
  - OpenTelemetry 标准
  - 跨服务追踪

## 日志最佳实践
```python
import structlog
logger = structlog.get_logger()
logger.info("user_created", user_id=123, email="user@example.com")
```

## 告警
- 基于阈值：CPU > 80%, 错误率 > 5%
- 基于趋势：错误率持续上升
- 分级：P0（立即响应）→ P1（1小时）→ P2（24小时）
- 避免告警疲劳：定期审查和清理

## 健康检查
- Liveness：进程是否存活
- Readiness：是否准备好接收流量
- Startup：启动是否完成（慢启动场景）

## Prometheus 指标类型
- Counter：单调递增（请求数、错误数）
- Gauge：可增可减（温度、队列长度）
- Histogram：分布统计（请求延迟）
- Summary：类似 Histogram，客户端计算分位数
