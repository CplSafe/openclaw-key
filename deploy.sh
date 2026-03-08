#!/bin/bash
set -e

echo "============================================"
echo "   OpenClaw 许可证管理系统 - 一键部署"
echo "============================================"
echo ""

# ---- 检查依赖 ----
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ 未安装 $1"
        return 1
    fi
    return 0
}

# 检查 Docker
if ! check_command docker; then
    echo "正在自动安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker 2>/dev/null || true
    systemctl start docker 2>/dev/null || true
    echo "✅ Docker 安装完成"
fi

if ! docker compose version &> /dev/null; then
    echo "❌ 需要 Docker Compose V2，请安装后重试"
    exit 1
fi

echo "✅ Docker 环境检查通过"
echo ""

# ---- 生成配置文件 ----
ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    echo "📝 首次部署，生成配置..."

    ENCRYPTION_KEY=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    DB_PASSWORD=$(openssl rand -hex 16 2>/dev/null || node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")

    PUBLIC_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo "localhost")

    read -p "🔌 访问端口 [默认 3000]: " APP_PORT
    APP_PORT=${APP_PORT:-3000}

    read -p "🌐 访问地址 [默认 http://${PUBLIC_IP}:${APP_PORT}]: " API_BASE_URL
    API_BASE_URL=${API_BASE_URL:-http://${PUBLIC_IP}:${APP_PORT}}

    cat > "$ENV_FILE" << EOF
# OpenClaw 配置 - $(date '+%Y-%m-%d %H:%M:%S')
DB_PASSWORD=${DB_PASSWORD}
APP_PORT=${APP_PORT}
API_BASE_URL=${API_BASE_URL}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
JWT_SECRET=${JWT_SECRET}
EOF

    echo "✅ 配置文件已生成"
    echo ""
else
    echo "ℹ️  使用已有配置: ${ENV_FILE}"
    source "$ENV_FILE"
    echo ""
fi

# ---- 步骤1: Wasp 构建 ----
if check_command wasp; then
    echo "🔨 步骤 1/3: Wasp 构建服务端..."
    wasp build
    echo "✅ 服务端构建完成"
else
    echo "⚠️  未安装 Wasp CLI，尝试安装..."
    npm i -g @wasp.sh/wasp-cli@0.21.1
    echo "🔨 步骤 1/3: Wasp 构建服务端..."
    wasp build
    echo "✅ 服务端构建完成"
fi
echo ""

# ---- 步骤2: 前端构建 ----
echo "🔨 步骤 2/3: 构建前端静态文件..."
npm install 2>/dev/null

# 使用 Vite 构建前端（Wasp 通过 vite 插件提供路由等）
REACT_APP_API_URL="${API_BASE_URL}" npx vite build --outDir web-build 2>&1 || {
    echo "⚠️  Vite 构建失败，尝试备用方式..."
    # 备用：从 wasp start 开发服务器缓存中获取
    if [ -d ".wasp/out/web-app/build" ]; then
        cp -r .wasp/out/web-app/build web-build
    else
        echo "❌ 前端构建失败，请检查错误"
        exit 1
    fi
}
echo "✅ 前端构建完成"
echo ""

# ---- 步骤3: Docker 部署 ----
echo "🐳 步骤 3/3: Docker 构建并启动..."
docker compose up -d --build
echo ""

# ---- 完成 ----
source "$ENV_FILE" 2>/dev/null
echo "============================================"
echo "   ✅ 部署完成！"
echo "============================================"
echo ""
echo "🌐 访问地址:  ${API_BASE_URL}"
echo "👤 默认账号:  admin"
echo "🔑 默认密码:  admin123456"
echo ""
echo "⚠️  请登录后立即在「账号设置」中修改默认密码！"
echo ""
echo "常用命令:"
echo "  查看日志:  docker compose logs -f app"
echo "  重启服务:  docker compose restart app"
echo "  停止服务:  docker compose down"
echo "  更新部署:  git pull && ./deploy.sh"
echo ""
