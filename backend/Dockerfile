FROM node:20-alpine

WORKDIR /app

# 安装构建依赖（用于 better-sqlite3）
RUN apk add --no-cache python3 make g++

# 复制 package.json
COPY package.json ./

# 安装依赖
RUN npm install --production

# 复制源代码
COPY . .

# 创建存储目录
RUN mkdir -p storage/uploads

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "src/server.js"]
