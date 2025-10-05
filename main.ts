/**
 * Main application entry point
 */

// JSR 导入
import { Application, Router } from "oak/mod.ts";
import { cors } from "jsr:@momiji/cors@^1.0.0";
import { config } from "./app/core/config.ts";
import { openaiRouter } from "./app/core/openai.ts";
import { dashboardRouter } from "./app/dashboard/router.ts";

// 创建 Oak 应用
const app = new Application();

// 添加 CORS 中间件
app.use(cors({
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  headers: ["Content-Type", "Authorization"],
}));

// 创建主路由
const router = new Router();

// 引入 OpenAI API 路由
router.use("/v1", openaiRouter.routes());
router.use("/v1", openaiRouter.allowedMethods());

// 引入 Dashboard 路由
router.use(dashboardRouter.routes());
router.use(dashboardRouter.allowedMethods());

// 根路径端点
router.get("/", (ctx) => {
  ctx.response.body = { message: "OpenAI Compatible API Server" };
});

// 处理 OPTIONS 请求
router.options("/", (ctx) => {
  ctx.response.status = 200;
});

// 使用路由
app.use(router.routes());
app.use(router.allowedMethods());

// 错误处理中间件
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error("Unhandled error:", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

// 启动服务器
const port = config.LISTEN_PORT;
console.log(`🚀 Server starting on http://0.0.0.0:${port}`);
console.log(`📖 API docs available at http://localhost:${port}/v1/models`);

await app.listen({ port });
