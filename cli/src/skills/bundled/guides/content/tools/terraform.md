# Terraform 最佳实践

## 项目结构
```
environments/
  dev/
    main.tf
    variables.tf
    terraform.tfvars
  prod/
    main.tf
    variables.tf
    terraform.tfvars
modules/
  vpc/
  ecs/
  rds/
```

## 状态管理
- 远程状态：S3 + DynamoDB 锁
- 状态隔离：每个环境独立状态
- `terraform import` 导入已有资源
- `terraform state mv` 重命名资源

## 模块设计
- 输入变量：`variable "name" {}`
- 输出值：`output "id" { value = ... }`
- 版本约束：`source = "terraform-aws-modules/vpc/aws?~> 5.0"`
- 可复用：通用模块 + 环境覆盖

## 代码示例

```hcl
# variables.tf
variable "environment" {
  type    = string
  default = "dev"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

# main.tf
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "my-vpc-${var.environment}"
  cidr = var.vpc_cidr

  azs             = ["us-east-1a", "us-east-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
}
```

## 安全
- 不在代码中硬编码密钥（用 `sensitive = true` + secrets manager）
- `terraform plan` 审查变更
- `.gitignore` 排除 `.tfstate` 和 `.tfvars`
- CI/CD 中使用 `terraform validate` + `tflint`

## 常见命令
```bash
terraform init      # 初始化
terraform plan      # 预览变更
terraform apply     # 应用变更
terraform destroy   # 销毁资源
terraform fmt       # 格式化代码
```
