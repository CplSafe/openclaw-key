# OpenClaw 一键安装配置系统

**技术栈**: Wasp + PostgreSQL + React
**更新时间**: 2026-03-09

---

## 系统概述

构建一个基于 Wasp 的卡密管理系统，实现：
- 管理员后台生成唯一的一键安装脚本 URL
- 用户通过 `curl` 命令一键安装并配置 OpenClaw
- 安装脚本绑定机器码，仅可使用一次
- 自动配置通信渠道（20+ 平台）和 AI 模型

### 核心流程
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

## 快速开始

### 前置要求
- Node.js 22+
- PostgreSQL 数据库
- Wasp CLI (`npm i -g @wasp.sh/wasp-cli@latest`)

### 开发环境

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（已预配置密钥）
# DATABASE_URL 需要修改为你的 PostgreSQL 连接字符串
cat .env.server

# 3. 初始化数据库
wasp db migrate-dev

# 4. 启动开发服务器
wasp start
```

访问 http://localhost:3000

### 首次使用

1. 访问 `/login` 页面创建管理员账号
2. 登录后进入仪表盘
3. 点击"卡密管理" → "创建卡密"
4. 选择通信渠道（Telegram、飞书等）并填写凭证
5. 配置 AI 模型 API Key
6. 复制生成的安装命令
7. 用户在终端执行: `curl -fsSL <URL> | bash`
```

### 生产部署

```bash
# 构建
wasp build

# 部署到 Fly.io
cd .wasp/build
fly launch --name openclaw-manager
fly secrets set ENCRYPTION_KEY=xxx JWT_SECRET=xxx DATABASE_URL=xxx
fly deploy
```

---

## 架构设计

### 技术选型

- **后端**: Wasp 0.15+ (内置认证、ORM、API 生成)
- **数据库**: PostgreSQL (敏感信息 AES-256-GCM 加密)
- **前端**: Wasp React (管理后台)

### 安全机制

**二段式验证**:
1. 首次访问返回极简验证脚本（30行）
2. 真实安装逻辑在后端动态生成
3. 防止脚本源码泄露

**一次性使用**:
- 每个卡密对应唯一 UUID token
- 验证成功后立即标记为 `used`

**机器码绑定**:
- macOS: `IOPlatformUUID`
- Linux: `/etc/machine-id`
- Windows: `Win32_ComputerSystemProduct.UUID`

---

## 数据库设计

```
LicenseKey (卡密)
  ├── ChannelConfig[] (渠道配置: Telegram, 飞书, Discord...)
  ├── ModelConfig (AI 模型配置)
  └── InstallLog[] (安装日志)
```

### 核心表结构

**LicenseKey**
- `id`: UUID
- `token`: 安装令牌 (唯一)
- `status`: unused | used | revoked
- `machineId`: 绑定的机器码
- `osType`: macos | linux | windows

**ChannelConfig**
- `channelType`: telegram | feishu | discord...
- `credentials`: 加密的 JSON (Bot Token, App ID 等)

**ModelConfig**
- `provider`: openai | anthropic | azure
- `modelName`: gpt-4 | claude-3-opus...
- `apiKey`: 加密存储

---

## API 设计

### 公开端点

**GET /api/install/:token.sh** (或 .ps1)
- 返回轻量验证脚本
- 不修改数据库状态

**POST /api/verify-install**
```json
{
  "token": "uuid",
  "machineId": "xxx",
  "osType": "macos|linux|windows"
}
```
- 验证 token → 绑定机器码 → 返回真实安装脚本

### 管理端点 (需认证)

- `getLicenses`: 查询所有卡密
- `createLicense`: 创建卡密 (输入渠道配置 + AI 模型)
- `revokeLicense`: 撤销卡密

---

## 脚本生成逻辑

### 验证脚本 (第一阶段)

**Unix/macOS**:
```bash
#!/bin/bash
INSTALL_TOKEN="{token}"
API_BASE="{apiBase}"

get_machine_id() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/ { print $3; }' | tr -d '"'
  else
    cat /etc/machine-id
  fi
}

MACHINE_ID=$(get_machine_id)
response=$(curl -s -X POST "$API_BASE/api/verify-install" -H "Content-Type: application/json" -d "{\"token\":\"$INSTALL_TOKEN\",\"machineId\":\"$MACHINE_ID\",\"osType\":\"$(uname)\"}")
echo "$response" | jq -r '.script' | bash
```

**Windows**:
```powershell
$MachineId = (Get-WmiObject -Class Win32_ComputerSystemProduct).UUID
$response = Invoke-RestMethod -Uri "$API_BASE/api/verify-install" -Method Post -Body (@{token=$INSTALL_TOKEN; machineId=$MachineId; osType="windows"} | ConvertTo-Json)
Invoke-Expression $response.script
```

### 真实安装脚本 (第二阶段)

```bash
#!/bin/bash
npm install -g openclaw@latest

# 动态注入渠道配置
openclaw config set channels.telegram.token "{decrypted_token}"
openclaw config set channels.feishu.appId "{decrypted_appId}"

# 动态注入 AI 模型配置
openclaw config set models.default.provider "{provider}"
openclaw config set models.default.apiKey "{decrypted_apiKey}"

# 启动服务
openclaw onboard --install-daemon --skip-wizard
```

---

## 前端界面

### 页面结构

**仪表盘**
- 统计: 总卡密数、已使用/未使用
- 最近安装记录
- 渠道使用分布图

**卡密管理**
- 表格: 令牌、状态、机器码、渠道数、创建时间
- 操作: 复制安装命令、撤销

**创建卡密**
1. 选择通信渠道 (Telegram、飞书、Discord...)
2. 配置 AI 模型 (Provider、Model、API Key)
3. 生成 → 显示安装命令

**安装日志**
- 时间、卡密、机器码、IP、状态、错误信息

---

## 支持的通信渠道 (20+)

| 渠道 | 配置字段 | 库 |
|------|---------|-----|
| Telegram | botToken | grammY |
| WhatsApp | (动态配对) | Baileys |
| 飞书 | appId, appSecret | Feishu API |
| Discord | botToken | discord.js |
| Slack | botToken, signingSecret | Bolt |
| Google Chat | credentials JSON | Chat API |
| Signal | (signal-cli) | signal-cli |
| iMessage | (BlueBubbles) | BlueBubbles |
| IRC | server, channel | irc |
| Microsoft Teams | webhookUrl | Teams SDK |
| Matrix | homeserver, token | matrix-js-sdk |
| LINE | channelToken | LINE SDK |
| Mattermost | webhookUrl | API |
| ... | ... | ... |

---

## 项目结构

```
openclaw-manager/
├── main.wasp                 # Wasp 配置
├── .env.server               # 环境变量
├── src/
│   ├── api/install.ts        # 安装 API
│   ├── actions.ts            # createLicense, revokeLicense
│   ├── queries.ts            # getLicenses
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   └── License.tsx
│   └── utils/
│       ├── crypto.ts         # AES-256-GCM 加密
│       └── scriptGenerator.ts # 脚本生成器
└── README.md
```

---

## 开发里程碑

### Phase 1: 核心功能 (2周)
- [ ] Wasp 项目搭建
- [ ] 数据库设计
- [ ] 加密工具实现
- [ ] 二段式验证 API

### Phase 2: 脚本生成 (1周)
- [ ] Unix/Windows 脚本生成器
- [ ] 渠道配置逻辑
- [ ] AI 模型配置逻辑

### Phase 3: 管理后台 (1周)
- [ ] 卡密管理页面
- [ ] 创建卡密弹窗
- [ ] 仪表盘与日志

### Phase 4: 测试与部署 (1周)
- [ ] 单元测试
- [ ] E2E 测试
- [ ] Fly.io 部署

---

## 安全考量

**威胁防护**:
- 脚本 URL 被盗用 → 二段式验证 + 机器码绑定
- 中间人攻击 → 强制 HTTPS
- 数据库泄露 → AES-256-GCM 加密敏感信息
- 重放攻击 → 脚本时间戳验证 (5分钟)

**最佳实践**:
- 定期轮换加密密钥
- 启用数据库审计
- 限制管理员账号
- 日志记录敏感操作

---

## License

MIT
