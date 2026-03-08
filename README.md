# OpenClaw 卡密管理系统

**技术栈**: Wasp + PostgreSQL + React
**更新时间**: 2026-03-09

---

## 服务器部署 (完整流程)

### 前置要求

- 一台 Linux 服务器 (Ubuntu 20.04+ / CentOS 8+ / Debian 11+)
- 开放 3000 端口

### 第一步：安装 Docker

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com | bash
```

**CentOS/RHEL:**
```bash
yum install -y docker-compose-plugin
systemctl start docker
systemctl enable docker
```

### 第二步：下载代码

```bash
git clone https://github.com/CplSafe/openclaw-key.git
cd openclaw-key
```

### 第三步：配置域名（可选）

如果有域名，修改 `docker-compose.yml` 中的 `WASP_WEB_CLIENT_URL`：

```bash
sed -i 's|http://localhost:3000|https://your-domain.com|g' docker-compose.yml
```

### 第四步：启动服务

```bash
docker compose up -d
```

首次启动需要构建镜像，大约 5-10 分钟。

### 第五步：访问系统

浏览器打开: `http://你的服务器IP:3000`

**默认管理员账号:**
- 用户名: `admin`
- 密码: `admin123456`

⚠️ **首次登录后请立即修改密码！**

---

## 常用命令

```bash
# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 更新到最新版本
git pull
docker compose up -d --build
```

---

## 本地开发

**前置要求:**
- Node.js 22+
- PostgreSQL
- Wasp CLI (`npm i -g @wasp.sh/wasp-cli@0.21.1`)

**启动开发服务器:**
```bash
npm install
wasp db migrate-dev
wasp start
```

访问 http://localhost:3000

---

## 功能特性

### 核心功能

- **卡密管理**: 创建、查看、撤销卡密
- **一键安装**: 用户通过 `curl` 命令完成安装
- **机器码绑定**: 每个卡密只能在一台设备上使用
- **地理位置追踪**: 记录激活 IP 的城市和国家
- **地图可视化**: 仪表盘显示全球激活分布

### 支持的通信渠道 (20+)

Telegram、WhatsApp、飞书、Discord、Slack、Google Chat、Signal、iMessage、IRC、Microsoft Teams、Matrix、LINE、Mattermost 等

### 工作流程

```
管理员创建卡密
    ↓
系统生成: https://yourapp.com/api/install/abc123.sh
    ↓
用户执行: curl -fsSL https://yourapp.com/api/install/abc123.sh | bash
    ↓
二段式验证 → 绑定机器码 → 自动配置 → 完成安装
    ↓
URL 永久失效
```

---

## 项目结构

```
openclaw/
├── main.wasp                 # Wasp 配置
├── docker-compose.yml        # Docker 部署配置
├── Dockerfile                # 多阶段构建
├── src/
│   ├── api/                  # API 端点
│   │   ├── install.ts        # 安装脚本生成
│   │   └── auth.ts           # 认证相关
│   ├── actions.ts            # 服务端操作
│   ├── queries.ts            # 数据查询
│   ├── pages/                # 页面组件
│   │   ├── DashboardPage.tsx # 仪表盘
│   │   ├── LicensePage.tsx   # 卡密管理
│   │   └── SettingsPage.tsx  # 账号设置
│   ├── components/
│   │   └── Layout.tsx        # 侧边栏布局
│   └── utils/
│       ├── crypto.ts         # AES-256-GCM 加密
│       └── geoip.ts          # IP 地理位置查询
└── deploy/
    ├── nginx.conf            # Nginx 配置
    └── supervisord.conf      # 进程管理
```

---

## 安全机制

### 二段式验证

1. 首次访问返回轻量验证脚本
2. 真实安装逻辑在后端动态生成
3. 防止脚本源码泄露

### 数据加密

- 敏感信息使用 AES-256-GCM 加密存储
- 渠道凭证、API Key 全部加密

### 机器码绑定

- macOS: `IOPlatformUUID`
- Linux: `/etc/machine-id`
- Windows: `Win32_ComputerSystemProduct.UUID`

---

## 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DATABASE_URL | PostgreSQL 连接字符串 | 内置 |
| JWT_SECRET | JWT 签名密钥 | 内置 |
| ENCRYPTION_KEY | 数据加密密钥 | 内置 |
| WASP_WEB_CLIENT_URL | 前端访问地址 | http://localhost:3000 |

生产环境建议修改默认密钥。

---

## API 端点

### 公开端点

- `GET /api/install/:token.sh` - 获取安装脚本 (Unix/Linux/macOS)
- `GET /api/install/:token.ps1` - 获取安装脚本 (Windows)
- `POST /api/verify-install` - 验证并绑定机器码

### 管理端点 (需认证)

- `getLicenses` - 查询所有卡密
- `createLicense` - 创建卡密
- `revokeLicense` - 撤销卡密
- `getStats` - 获取统计数据

---

## License

MIT
