#!/bin/bash
set -e

echo "📦 构建 Wasp 应用..."
wasp build

echo "🚀 部署到 Fly.io..."
cd .wasp/build

if ! fly status > /dev/null 2>&1; then
  echo "初始化 Fly.io 应用..."
  fly launch --name openclaw-manager --region hkg --no-deploy
fi

echo "设置环境变量..."
fly secrets set \
  ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" \
  JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"

echo "部署应用..."
fly deploy

echo "✅ 部署完成!"
echo "访问: https://openclaw-manager.fly.dev"
