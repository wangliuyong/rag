# 公司内部文档 RAG 问答系统

基于 PDF/Word 制度文档的检索增强生成（RAG）问答：上传《员工手册》《差旅报销制度》等，员工可提问请假、报销、设备领用等问题，回答仅展示正文（不单独展示检索引用片段）。

## 技术栈

- **后端**：Fastify + TypeScript + SQLite + Qdrant + 通义千问（DashScope OpenAI 兼容接口）
- **前端**：Vue 3 + Vite + Element Plus + Pinia
- **包管理**：pnpm workspace

## 准备

1. Node.js >= 20，安装 [pnpm](https://pnpm.io/)
2. 复制环境变量：`cp .env.example .env`，填写 `DASHSCOPE_API_KEY`
3. 启动 Qdrant：`docker compose up -d`
4. 安装依赖：`pnpm install`  
   （首次若 `better-sqlite3` 未编译，请确认仓库根 `package.json` 中 `pnpm.onlyBuiltDependencies` 已包含 `better-sqlite3`，并重新执行 `pnpm install`。）

## 开发运行

终端 1（后端，默认 `http://localhost:3001`）：

```bash
pnpm dev:backend
```

终端 2（前端，默认 `http://localhost:5173`，已代理 `/api` 到后端）：

```bash
pnpm dev:frontend
```

浏览器打开 `http://localhost:5173`，使用 `.env` 中的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录。

## 生产构建

```bash
pnpm --filter frontend build
pnpm --filter backend build
node backend/dist/server.js
```

将前端 `frontend/dist` 静态资源可由 Nginx 托管，或后续扩展 Fastify 托管静态文件。

## API 摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录，返回 JWT |
| GET | `/api/documents` | 文档列表（需 JWT） |
| POST | `/api/documents` | multipart 上传 PDF/DOCX（需 JWT） |
| DELETE | `/api/documents/:id` | 删除文档与向量（需 JWT） |
| POST | `/api/documents/:id/reindex` | 重建索引（需 JWT） |
| POST | `/api/chat` | 流式问答 SSE（需 JWT，`Accept: text/event-stream`） |

## 模型说明

- 对话：`qwen-plus`（可通过环境变量 `CHAT_MODEL` 覆盖）
- 向量：`text-embedding-v3`（`EMBEDDING_MODEL` 可覆盖）

## 验收

1. 启动 Qdrant 与前后端后，在「文档管理」上传 PDF/DOCX。
2. 在「智能问答」用制度相关问题提问，检查回答是否与制度原文一致、未命中时是否拒答。
3. 参考 [examples/README.md](examples/README.md) 中的示例问题。

无需外设的本地快速校验（仅验证切分等逻辑）：

```bash
pnpm verify:local
```

## 许可证

MIT
