# ============================================
# OpenClaw All-in-One Docker
# 前端: 8080, 后端: 8081
# ============================================

# ---- 阶段1: 在容器内完成 wasp build ----
FROM node:22-alpine AS wasp-builder

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

RUN apk add --no-cache python3 build-base libtool autoconf automake curl bash git

RUN npm i -g @wasp.sh/wasp-cli@0.21.1

WORKDIR /app
COPY . .

RUN wasp build

# ---- 阶段2: 构建服务端 bundle ----
FROM node:22-alpine AS server-builder

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

RUN apk add --no-cache python3 build-base libtool autoconf automake

WORKDIR /app

COPY --from=wasp-builder /app/src ./src
COPY --from=wasp-builder /app/.wasp/out/package.json ./
COPY --from=wasp-builder /app/.wasp/out/package-lock.json ./
COPY --from=wasp-builder /app/.wasp/out/tsconfig*.json ./
COPY --from=wasp-builder /app/.wasp/out/server .wasp/out/server
COPY --from=wasp-builder /app/.wasp/out/sdk .wasp/out/sdk
COPY --from=wasp-builder /app/.wasp/out/libs .wasp/out/libs
COPY --from=wasp-builder /app/.wasp/out/db .wasp/out/db

# 添加 Prisma binaryTargets
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

COPY --from=wasp-builder /app /app

RUN npm install

# 设置 API 地址环境变量
ENV REACT_APP_API_URL=http://47.242.255.149:8081

# Vite 构建前端
RUN npx vite build --outDir /app/web-build

# 替换打包后的 JS 文件中的 localhost:3001
RUN find /app/web-build -name "*.js" -exec sed -i 's|http://localhost:3001|http://47.242.255.149:8081|g' {} \;

# ---- 阶段4: 最终生产镜像 ----
FROM node:22-alpine

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

RUN apk add --no-cache nginx supervisor curl openssl openssl-dev

WORKDIR /app

COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/.wasp/out/server/node_modules .wasp/out/server/node_modules
COPY --from=server-builder /app/.wasp/out/server/bundle .wasp/out/server/bundle
COPY --from=server-builder /app/.wasp/out/server/package*.json .wasp/out/server/
COPY --from=server-builder /app/.wasp/out/db .wasp/out/db

COPY --from=web-builder /app/web-build /usr/share/nginx/html

COPY deploy/nginx.conf /etc/nginx/http.d/default.conf
COPY deploy/supervisord.conf /etc/supervisord.conf

ENV NODE_ENV=production

EXPOSE 80
EXPOSE 8081

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
