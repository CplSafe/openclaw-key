# ============================================
# OpenClaw All-in-One
# wasp build + vite build + nginx + node
# 使用者只需 docker compose up -d
# ============================================

# ---- 阶段1: 在容器内完成 wasp build ----
FROM node:22-alpine AS wasp-builder

# 使用阿里云镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

RUN apk add --no-cache python3 build-base libtool autoconf automake curl bash git

# 安装 Wasp CLI
RUN npm i -g @wasp.sh/wasp-cli@0.21.1

WORKDIR /app
COPY . .

# wasp build 生成 .wasp/out/
RUN wasp build

# ---- 阶段2: 构建服务端 bundle ----
FROM node:22-alpine AS server-builder

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

RUN apk add --no-cache python3 build-base libtool autoconf automake

WORKDIR /app

# 从 wasp-builder 复制产物
COPY --from=wasp-builder /app/src ./src
COPY --from=wasp-builder /app/.wasp/out/package.json ./
COPY --from=wasp-builder /app/.wasp/out/package-lock.json ./
COPY --from=wasp-builder /app/.wasp/out/tsconfig*.json ./
COPY --from=wasp-builder /app/.wasp/out/server .wasp/out/server
COPY --from=wasp-builder /app/.wasp/out/sdk .wasp/out/sdk
COPY --from=wasp-builder /app/.wasp/out/libs .wasp/out/libs
COPY --from=wasp-builder /app/.wasp/out/db .wasp/out/db

# 添加 Prisma binaryTargets (Wasp 生成的 schema.prisma 没有这个配置)
RUN sed -i 's/provider = "prisma-client-js"/provider = "prisma-client-js"\n  binaryTargets = ["native", "linux-musl-openssl-3.0.x", "linux-musl"]/' .wasp/out/db/schema.prisma

RUN npm install && cd .wasp/out/server && npm install
RUN cd .wasp/out/server && npx prisma generate --schema='../db/schema.prisma'
RUN cd .wasp/out/server && npm run bundle
RUN mkdir -p .wasp/out/server/node_modules

# ---- 阶段3: 构建前端静态文件 ----
FROM node:22-alpine AS web-builder

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

RUN apk add --no-cache python3 build-base

WORKDIR /app

# 复制整个项目 + wasp 产物 (vite 需要 wasp 插件)
COPY --from=wasp-builder /app /app

# 确保依赖装好
RUN npm install

# 构建时注入 API 地址
ARG API_BASE_URL=${API_BASE_URL:-http://localhost:3001}

# Vite 构建前端
RUN npx vite build --outDir /app/web-build

# ---- 阶段4: 最终生产镜像 ----
FROM node:22-alpine

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 安装运行时依赖 (openssl 是 Prisma 必需的)
RUN apk add --no-cache nginx supervisor curl openssl openssl-dev

WORKDIR /app

# 服务端
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/.wasp/out/server/node_modules .wasp/out/server/node_modules
COPY --from=server-builder /app/.wasp/out/server/bundle .wasp/out/server/bundle
COPY --from=server-builder /app/.wasp/out/server/package*.json .wasp/out/server/
COPY --from=server-builder /app/.wasp/out/db .wasp/out/db

# 前端静态文件
COPY --from=web-builder /app/web-build /usr/share/nginx/html

# 配置
COPY deploy/nginx.conf /etc/nginx/http.d/default.conf
COPY deploy/supervisord.conf /etc/supervisord.conf

ENV NODE_ENV=production

EXPOSE 80

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
