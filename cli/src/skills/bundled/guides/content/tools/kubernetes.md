# Kubernetes 最佳实践

## 核心概念
- Pod → Deployment → Service → Ingress
- ConfigMap / Secret 管理配置
- Namespace 隔离资源
- RBAC 控制访问权限

## Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: my-app:latest
          ports: [{ containerPort: 3000 }]
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits: { cpu: 500m, memory: 512Mi }
          livenessProbe:
            httpGet: { path: /health, port: 3000 }
            initialDelaySeconds: 10
          readinessProbe:
            httpGet: { path: /ready, port: 3000 }
```

## 服务发现
- ClusterIP：内部访问
- NodePort：节点端口暴露
- LoadBalancer：云厂商负载均衡
- Ingress：HTTP 路由

## 配置管理
- ConfigMap：非敏感配置
- Secret：敏感数据（base64 编码）
- 环境变量注入或文件挂载

## 最佳实践
- 设置资源请求和限制
- 配置健康检查（liveness + readiness）
- 使用 Namespace 隔离环境
- Pod Disruption Budget 保证可用性
- HPA 自动扩缩容

## Helm
```bash
helm create my-chart      # 创建 chart
helm install my-release ./my-chart  # 安装
helm upgrade my-release ./my-chart  # 升级
helm rollback my-release 1          # 回滚
```

## 常见问题
- Pod Pending：资源不足或 PVC 未绑定
- CrashLoopBackOff：检查日志和健康检查
- ImagePullBackOff：镜像拉取失败（认证/网络）
- OOMKilled：增加内存限制
