<div align="center">
  <img width="100" src="https://wsrv.nl/?url=https%3a%2f%2fz-cdn.chatglm.cn%2fz-ai%2fstatic%2flogo.svg&w=300&output=webp" />
  <h1>Z.AI OpenAI API 代理服务 (Deno版)</h1>
  
  ![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
  ![Deno: 1.40+](https://img.shields.io/badge/deno-1.40+-green.svg)
  ![Oak](https://img.shields.io/badge/framework-Oak-009688.svg)
  ![Version: 1.2.0](https://img.shields.io/badge/version-1.2.0-brightgreen.svg)
  
  <p>轻量级 OpenAI API 兼容代理服务，通过 Claude Code Router 接入 Z.AI，支持 GLM-4.5 和 GLM-4.6 系列模型的完整功能。使用 Deno 和 Oak 框架重写，提供更好的性能和类型安全。</p>
</div>


## ✨ 核心特性

- 🔌 **完全兼容 OpenAI API** - 无缝集成现有应用
- 🤖 **Claude Code 支持** - 通过 Claude Code Router 接入 Claude Code (**CCR 工具请升级到 v1.0.47 以上**)
- 🚀 **高性能流式响应** - Server-Sent Events (SSE) 支持
- 🛠️ **增强工具调用** - 改进的 Function Call 实现
- 🧠 **思考模式支持** - 智能处理模型推理过程
- 🔍 **搜索模型集成** - GLM-4.5-Search 网络搜索能力
- 🐳 **Docker 部署** - 一键容器化部署
- 🛡️ **会话隔离** - 匿名模式保护隐私
- 🔧 **灵活配置** - 环境变量灵活配置
- 📊 **多模型映射** - 智能上游模型路由
- ⚡ **Deno 运行时** - 原生 TypeScript 支持，更好的性能

## 🚀 快速开始


### Deno Deploy部署

Deno Deploy是一个全球分布式的边缘计算平台，非常适合部署Deno应用。

[![Deploy to Deno](https://deno.com/deploy.svg)](https://dash.deno.com/new_project)
#### 步骤：

1. **准备代码**
   - Fork本仓库，顺便点个小心心

2. **登录Deno Deploy**
   - 访问 [https://dash.deno.com/](https://dash.deno.com/)
   - 使用GitHub账号登录

3. **创建新项目**
   - 点击"New Project"按钮
   - 选择你的GitHub仓库
   - 选择包含`main.ts`文件

4. **配置环境变量**
   - 在项目设置中，添加环境变量
     - 具体配置见env.example

5. **部署**
   - 点击"Deploy"按钮
   - 等待部署完成


### 基础使用

#### OpenAI API 客户端

```typescript
import OpenAI from 'openai';

// 初始化客户端
const client = new OpenAI({
  baseURL: "http://localhost:8080/v1",
  apiKey: "your-auth-token"  // 替换为你的 AUTH_TOKEN
});

// 普通对话
const response = await client.chat.completions.create({
  model: "GLM-4.5",
  messages: [{ role: "user", content: "你好，介绍一下 TypeScript" }],
  stream: false
});

console.log(response.choices[0].message.content);
```

### Docker 部署

使用仓库根目录提供的 `Dockerfile` 可以快速构建镜像：

```bash
docker build -t zai2api .
docker run --name zai2api -p 8080:8080 \
  -e AUTH_TOKEN=your-auth-token \
  -e BACKUP_TOKEN="token1,token2" \
  zai2api
```

> 仍可使用 `deploy` 目录中的示例 `docker-compose.yml` 进行编排部署。

### 监控面板

- 访问 `http://<host>:8080/dashboard` 打开监控控制台，登录密码与 `AUTH_TOKEN` 相同。
- 实时查看总请求数、成功/失败统计与平均响应时间，支持自动刷新或手动刷新。
- 最近 100 条请求详细信息（时间、方法、路径、状态、耗时、客户端 IP、使用的 Token）一目了然。
- 在 Backup Token 管理界面中可以查看每个 Token 的成功/失败次数，并可在线添加或删除，立即生效。

## 📖 详细指南

### 支持的模型(支持Z.AI全部公开API模型，模型跟随上游更新自动适配)

| 模型                         | 上游ID           | 描述         | 特性                   |
| -------------------------- | -------------- | ---------- | -------------------- |
| `GLM-4.5`                  | 0727-360B-API  | 标准模型       | 通用对话，平衡性能            |
| `GLM-4.5-Thinking`         | 0727-360B-API  | 思考模型       | 显示推理过程，透明度高          |
| `GLM-4.5-Search`           | 0727-360B-API  | 搜索模型       | 实时网络搜索，信息更新          |
| `GLM-4.5-Air`              | 0727-106B-API  | 轻量模型       | 快速响应，高效推理，低资源占用      |
| `GLM-4.6`                  | GLM-4-6-API-V1 | 新版标准模型     | 通用对话，性能优化，升级版稳定性     |
| `GLM-4.6-Thinking`         | GLM-4-6-API-V1 | 新版思考模型     | 显示推理过程，透明度更高         |
| `GLM-4.6-Search`           | GLM-4-6-API-V1 | 新版搜索模型     | 实时网络搜索，更新频率更快        |
| `GLM-4.5V`                 | glm-4.5v       | 多模态模型      | 🎯 全方位理解：图像、视频、文档、音频 |
| `GLM-4.1V-Thinking-FlashX` | main_chat      | 实验型多模态思考模型 | 快速推理 + 图像/文档理解       |
| `glm-4-flash`              | main_chat      | 极速对话模型     | 响应速度极快，适合高并发场景       |
| `deep-research`            | glm-4.5v       | 深度研究模型     | 长时推理，多模态增强分析         |
| `zero`                     | main_chat      | 轻量实验模型     | 极简架构，测试用             |
| `0727-360B-API`            | glm-4.5        | 基础大模型接口    | 通用对话、代码生成、工具调用       |
| `0727-106B-API`            | glm-4.5        | 轻量大模型接口    | 快速推理，资源友好            |
| `0808-360B-DR`             | deep-research  | 专用研究接口     | 面向科研与复杂任务            |



### Function Call 功能

```typescript
// 定义工具
const tools = [{
  type: "function",
  function: {
    name: "get_weather",
    description: "获取天气信息",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "城市名称" }
      },
      required: ["city"]
    }
  }
}];

// 使用工具
const response = await client.chat.completions.create({
  model: "GLM-4.5",
  messages: [{ role: "user", content: "北京天气怎么样？" }],
  tools: tools,
  tool_choice: "auto"
});
```

### 流式响应

```typescript
const response = await client.chat.completions.create({
  model: "GLM-4.5-Thinking",
  messages: [{ role: "user", content: "解释量子计算" }],
  stream: true
});

for await (const chunk of response) {
  const content = chunk.choices[0].delta.content;
  const reasoning = chunk.choices[0].delta.reasoning_content;
  
  if (content) {
    process.stdout.write(content);
  }
  if (reasoning) {
    console.log(`\n🤔 思考: ${reasoning}\n`);
  }
}
```

## ⚙️ 配置说明

### 环境变量配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `AUTH_TOKEN` | `sk-your-api-key` | 客户端认证密钥 |
| `API_ENDPOINT` | `https://chat.z.ai/api/chat/completions` | 上游 API 地址 |
| `LISTEN_PORT` | `8080` | 服务监听端口 |
| `PRIMARY_MODEL` | `GLM-4.5` | 主要模型名称 |
| `THINKING_MODEL` | `GLM-4.5-Thinking` | 思考模型名称 |
| `SEARCH_MODEL` | `GLM-4.5-Search` | 搜索模型名称 |
| `AIR_MODEL` | `GLM-4.5-Air` | Air 模型名称 |
| `PRIMARY_MODEL_NEW` | `GLM-4.6` | 新版主要模型名称 |
| `THINKING_MODEL_NEW` | `GLM-4.6-Thinking` | 新版思考模型名称 |
| `SEARCH_MODEL_NEW` | `GLM-4.6-Search` | 新版搜索模型名称 |
| `DEBUG_LOGGING` | `true` | 调试日志开关 |
| `THINKING_PROCESSING` | `think` | 思考内容处理策略 |
| `ANONYMOUS_MODE` | `true` | 匿名模式开关 |
| `TOOL_SUPPORT` | `true` | Function Call 功能开关 |
| `SKIP_AUTH_TOKEN` | `false` | 跳过认证令牌验证 |
| `SCAN_LIMIT` | `200000` | 扫描限制 |
| `BACKUP_TOKEN` | `eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...` | Z.ai 固定访问令牌 |

### 思考内容处理策略

- `think` - 转换为 `<thinking>` 标签（OpenAI 兼容）
- `strip` - 移除思考内容
- `raw` - 保留原始格式


## ❓ 常见问题

**Q: 如何获取 AUTH_TOKEN？**
A: `AUTH_TOKEN` 为自己自定义的api key，在环境变量中配置，需要保证客户端与服务端一致。

**Q: 如何通过 Claude Code 使用本服务？**

A: 创建 [zai.js](https://gist.githubusercontent.com/musistudio/b35402d6f9c95c64269c7666b8405348/raw/f108d66fa050f308387938f149a2b14a295d29e9/gistfile1.txt) 这个ccr插件放在`./.claude-code-router/plugins`目录下，配置 `./.claude-code-router/config.json` 指向本服务地址，使用 `AUTH_TOKEN` 进行认证。

示例配置：
```json
{
  "LOG": false,
  "LOG_LEVEL": "debug",
  "CLAUDE_PATH": "",
  "HOST": "127.0.0.1",
  "PORT": 3456,
  "APIKEY": "",
  "API_TIMEOUT_MS": "600000",
  "PROXY_URL": "",
  "transformers": [
    {
      "name": "zai",
      "path": "C:\\Users\\Administrator\\.claude-code-router\\plugins\\zai.js",
      "options": {}
    }
  ],
  "Providers": [
    {
      "name": "GLM",
      "api_base_url": "http://127.0.0.1:8080/v1/chat/completions",
      "api_key": "sk-your-api-key",
      "models": [
        "GLM-4.5",
        "GLM-4.5-Air"
      ],
      "transformers": {
        "use": [
          "zai"
        ]
      }
    }
  ],
  "StatusLine": {
    "enabled": false,
    "currentStyle": "default",
    "default": {
      "modules": []
    },
    "powerline": {
      "modules": []
    }
  },
  "Router": {
    "default": "GLM,GLM-4.5",
    "background": "GLM,GLM-4.5",
    "think": "GLM,GLM-4.5",
    "longContext": "GLM,GLM-4.5",
    "longContextThreshold": 60000,
    "webSearch": "GLM,GLM-4.5",
    "image": "GLM,GLM-4.5"
  },
  "CUSTOM_ROUTER_PATH": ""
}
```

**Q: 支持哪些 OpenAI 功能？**
A: 支持聊天完成、模型列表、流式响应、工具调用等核心功能。

**Q: 如何自定义配置？**
A: 通过环境变量配置，推荐使用 `.env` 文件。

## 🔑 获取 Z.ai API Token

要使用完整的多模态功能，需要获取正式的 Z.ai API Token：

### 方式 1: 通过 Z.ai 网站

1. 访问 [Z.ai 官网](https://chat.z.ai)
2. 注册账户并登录，进入 [Z.ai API Keys](https://z.ai/manage-apikey/apikey-list) 设置页面，在该页面设置 _**个人 API Token**_
3. 将 Token 放置在 `BACKUP_TOKEN` 环境变量中

### 方式 2: 浏览器开发者工具（临时方案）

1. 打开 [Z.ai 聊天界面](https://chat.z.ai)
2. 按 F12 打开开发者工具
3. 切换到 "Application" 或 "存储" 标签
4. 查看 Local Storage 中的认证 token
5. 复制 token 值设置为环境变量

> ⚠️ **注意**: 方式 2 获取的 token 可能有时效性，建议使用方式 1 获取长期有效的 API Token。
> ❗ **重要提示**: 多模态模型需要**官方 Z.ai API 非匿名 Token**，匿名 token 不支持多媒体处理。


## 🏗️ 技术架构

```
┌──────────────┐      ┌─────────────────────────┐      ┌─────────────────┐
│   OpenAI     │      │                         │      │                 │
│  Client      │────▶│    Oak Server (Deno)    │────▶│   Z.AI API      │
└──────────────┘      │                         │      │                 │
┌──────────────┐      │ ┌─────────────────────┐ │      │ ┌─────────────┐ │
│ Claude Code  │      │ │ /v1/chat/completions│ │      │ │0727-360B-API│ │
│   Router     │────▶│ └─────────────────────┘ │      │ └─────────────┘ │
└──────────────┘      │ ┌─────────────────────┐ │      │ ┌─────────────┐ │
                      │ │    /v1/models       │ │────▶│ │0727-106B-API│ │
                      │ └─────────────────────┘ │      │ └─────────────┘ │
                      │ ┌─────────────────────┐ │      │                 │
                      │ │  Enhanced Tools     │ │      └─────────────────┘
                      │ └─────────────────────┘ │
                      └─────────────────────────┘
                           OpenAI Compatible API
```

### 项目结构

```
z.ai2api-deno/
├── app/
│   ├── core/
│   │   ├── config.ts              # 配置管理
│   │   ├── openai.ts              # OpenAI API 实现
│   │   └── response_handlers.ts   # 响应处理器
│   ├── models/
│   │   └── schemas.ts             # Zod 模型定义
│   ├── utils/
│   │   ├── helpers.ts             # 辅助函数
│   │   ├── tools.ts               # 增强工具调用处理
│   │   ├── model_fetcher.ts       # 自动获取模型列表
│   │   └── sse_parser.ts          # SSE 流式解析器
├── deploy/                        # Docker 部署配置
├── main.ts                        # Oak 应用入口
├── deno.json                      # Deno 项目配置
├── deno.lock
└── README.md                      # 项目文档
```

## 🆚 Deno vs Python 版本对比

| 特性 | Python 版本 | Deno 版本 |
|------|-------------|-----------|
| 运行时 | Python 3.8+ | Deno 1.40+ |
| 框架 | FastAPI | Oak |
| 类型系统 | Pydantic | Zod |
| 包管理 | pip/uv | 内置 |
| 启动速度 | 较慢 | 更快 |
| 内存占用 | 较高 | 较低 |
| 类型安全 | 运行时验证 | 编译时检查 |
| 部署大小 | 较大 | 更小 |

## 🤝 贡献指南

我们欢迎所有形式的贡献！
请确保代码符合 Deno 标准，并更新相关文档。

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## ⚠️ 免责声明

- 本项目与 Z.AI 官方无关
- 使用前请确保遵守 Z.AI 服务条款
- 请勿用于商业用途或违反使用条款的场景
- 项目仅供学习和研究使用

---

<div align="center">
Made with ❤️ by the Linux.do community fork
</div>
