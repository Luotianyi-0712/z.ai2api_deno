<div align="center">
  <img width="100" src="https://wsrv.nl/?url=https%3a%2f%2fz-cdn.chatglm.cn%2fz-ai%2fstatic%2flogo.svg&w=300&output=webp" />
  <h1>Z.AI OpenAI API 测试版 (快速更新网页接口，但是未经过充分验证)</h1>
  
  ![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
  ![Deno: 1.40+](https://img.shields.io/badge/deno-1.40+-green.svg)
  ![Oak](https://img.shields.io/badge/framework-Oak-009688.svg)
  ![Version: 1.2.0](https://img.shields.io/badge/version-1.2.0-brightgreen.svg)
  
  <p>轻量级 OpenAI API 兼容代理服务，通过 Claude Code Router 接入 Z.AI，支持 GLM-4.5 系列模型的完整功能。使用 Deno 和 Oak 框架重写，提供更好的性能和类型安全。</p>
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

## 📖 详细指南

### 支持的模型

| 模型 | 上游ID | 描述 | 特性 |
|------|--------|------|------|
| `GLM-4.5` | 0727-360B-API | 标准模型 | 通用对话，平衡性能 |
| `GLM-4.5-Thinking` | 0727-360B-API | 思考模型 | 显示推理过程，透明度高 |
| `GLM-4.5-Search` | 0727-360B-API | 搜索模型 | 实时网络搜索，信息更新 |
| `GLM-4.5-Air` | 0727-106B-API | 轻量模型 | 快速响应，高效推理 |
| `GLM-4.5V` | glm-4.5v | ❌ 暂不支持 |   |

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

**Q: 匿名模式是什么？**
A: 匿名模式使用临时 token，避免对话历史共享，保护隐私。

**Q: Function Call 如何工作？**
A: 通过智能提示注入实现，将工具定义转换为系统提示。

**Q: 支持哪些 OpenAI 功能？**
A: 支持聊天完成、模型列表、流式响应、工具调用等核心功能。

**Q: Function Call 如何优化？**
A: 改进了工具调用的请求响应结构，支持更复杂的工具链调用和并行执行。

**Q: 如何选择合适的模型？**
A: 
- **GLM-4.5**: 通用场景，性能和效果平衡
- **GLM-4.5-Thinking**: 需要了解推理过程的场景
- **GLM-4.5-Search**: 需要实时信息的场景
- **GLM-4.5-Air**: 高并发、低延迟要求的场景

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
│   │   └── sse_parser.ts          # SSE 流式解析器
├── deploy/                        # Docker 部署配置
├── main.ts                        # Oak 应用入口
├── deno.json                      # Deno 项目配置
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
