# ============================================
# OpenClaw 生产镜像
# 需要先运行 ./deploy.sh 准备构建产物
# ============================================

FROM node:22-alpine AS server-builder

RUN apk add --no-cache python3 build-base libtool autoconf automake

WORKDIR /app

# 复制 wasp build 产物（由 deploy.sh 预先准备）
COPY .wasp/out/src ./src
COPY .wasp/out/package.json .wasp/out/package-lock.json ./
COPY .wasp/out/tsconfig*.json ./
COPY .wasp/out/server .wasp/out/server
COPY .wasp/out/sdk .wasp/out/sdk
COPY .wasp/out/libs .wasp/out/libs
COPY .wasp/out/db .wasp/out/db
COPY src ./src

# 安装依赖并构建
RUN npm install && cd .wasp/out/server && npm install
RUN cd .wasp/out/server && npx prisma generate --schema='../db/schema.prisma'
RUN cd .wasp/out/server && npm run bundle
RUN mkdir -p .wasp/out/server/node_modules


FROM node:22-alpine AS production

RUN apk add --no-cache python3 nginx supervisor curl

ENV NODE_ENV=production

WORKDIR /app

# 服务端文件
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/.wasp/out/server/node_modules .wasp/out/server/node_modules
COPY --from=server-builder /app/.wasp/out/server/bundle .wasp/out/server/bundle
COPY --from=server-builder /app/.wasp/out/server/package*.json .wasp/out/server/
COPY --from=server-builder /app/.wasp/out/db .wasp/out/db

# 前端静态文件（由 deploy.sh 预先构建）
COPY web-build /usr/share/nginx/html

# 配置文件
COPY deploy/nginx.conf /etc/nginx/http.d/default.conf
COPY deploy/supervisord.conf /etc/supervisord.conf

EXPOSE 80

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
