# Nginx 配置最佳实践

## 反向代理
```nginx
upstream backend {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
}

server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://backend/api/;
        proxy_read_timeout 300s;
    }

    location /static/ {
        alias /var/www/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

## 性能优化
- `gzip on`：压缩响应
- `worker_processes auto`：CPU 核心数
- `keepalive_timeout`：连接复用
- `client_max_body_size`：上传限制
- `proxy_buffering`：代理缓冲

## SSL/TLS
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # HTTP → HTTPS 重定向
}
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

## 负载均衡策略
- 轮询（默认）
- `least_conn`：最少连接
- `ip_hash`：会话保持
- `weight`：加权轮询

## 常见问题
- 502 Bad Gateway：后端服务未启动
- 504 Gateway Timeout：增加 `proxy_read_timeout`
- 413 Request Entity Too Large：增加 `client_max_body_size`
