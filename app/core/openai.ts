/**
 * OpenAI API endpoints
 */

import { Router } from "oak/mod.ts";
import { config } from "./config.ts";
import { 
  Message, UpstreamRequest,
  ModelsResponse, OpenAIRequestSchema
} from "../models/schemas.ts";
import { debugLog, generateRequestIds, getAuthToken } from "../utils/helpers.ts";
import { processMessagesWithTools, contentToString } from "../utils/tools.ts";
import { StreamResponseHandler, NonStreamResponseHandler } from "./response_handlers.ts";
import { getAvailableModels } from "../utils/model_fetcher.ts";
import { metricsManager } from "./metrics.ts";
import { backupTokenManager } from "./token_manager.ts";

export const openaiRouter = new Router();

openaiRouter.get("/models", async (ctx) => {
  /**List available models with automatic fetching*/
  try {
    const availableModels = await getAvailableModels();
    
    const response: ModelsResponse = {
      object: "list",
      data: availableModels.map(model => ({
        id: model.id,
        object: "model",
        created: model.created || Math.floor(Date.now() / 1000),
        owned_by: model.owned_by || "z.ai"  
      }))
    };
    
    debugLog(`返回 ${availableModels.length} 个可用模型`);
    ctx.response.body = response;
  } catch (error) {
    debugLog(`获取模型列表失败: ${error}`);
    
    // 回退到默认模型列表
    const currentTime = Math.floor(Date.now() / 1000);
    const response: ModelsResponse = {
      object: "list",
      data: [
        {
          id: config.PRIMARY_MODEL,
          object: "model",
          created: currentTime,
          owned_by: "z.ai"
        },
        {
          id: config.THINKING_MODEL,
          object: "model",
          created: currentTime,
          owned_by: "z.ai"
        },
        {
          id: config.SEARCH_MODEL,
          object: "model",
          created: currentTime,
          owned_by: "z.ai"
        },
        {
          id: config.AIR_MODEL,
          object: "model",
          created: currentTime,
          owned_by: "z.ai"
        },
        {
          id: config.PRIMARY_MODEL_NEW,
          object: "model",
          created: currentTime,
          owned_by: "z.ai"
        },
        {
          id: config.THINKING_MODEL_NEW,
          object: "model",
          created: currentTime,
          owned_by: "z.ai"
        },
        {
          id: config.SEARCH_MODEL_NEW,
          object: "model",
          created: currentTime,
          owned_by: "z.ai"
        },
      ]
    };
    ctx.response.body = response;
  }
});

openaiRouter.post("/chat/completions", async (ctx) => {
  /**Handle chat completion requests*/
  debugLog("收到chat completions请求");

  const requestStart = performance.now();
  const clientIp = ctx.request.ip ||
    ctx.request.headers.get("x-forwarded-for") ||
    ctx.request.headers.get("x-real-ip") ||
    "unknown";
  let tokenInfo: Awaited<ReturnType<typeof getAuthToken>> | null = null;
  let metricsRecorded = false;

  const finalizeMetrics = (status: number, success: boolean) => {
    if (metricsRecorded) {
      return;
    }
    metricsRecorded = true;
    const duration = Number((performance.now() - requestStart).toFixed(2));
    metricsManager.recordRequest({
      timestamp: Date.now(),
      method: ctx.request.method,
      path: ctx.request.url.pathname,
      status,
      durationMs: duration,
      success,
      clientIp,
      token: tokenInfo?.token ?? "",
      tokenSource: tokenInfo?.source ?? "none",
    });

    if (tokenInfo?.source === "backup") {
      backupTokenManager.recordResult(tokenInfo.token, success);
    }
  };

  try {
    // Get authorization header
    const authorization = ctx.request.headers.get("authorization");

    // Validate API key (skip if SKIP_AUTH_TOKEN is enabled)
    if (!config.SKIP_AUTH_TOKEN) {
      if (!authorization || !authorization.startsWith("Bearer ")) {
        debugLog("缺少或无效的Authorization头");
        ctx.response.status = 401;
        ctx.response.body = { error: "Missing or invalid Authorization header" };
        finalizeMetrics(401, false);
        return;
      }

      const apiKey = authorization.substring(7);
      if (apiKey !== config.AUTH_TOKEN) {
        debugLog(`无效的API key: ${apiKey}`);
        ctx.response.status = 401;
        ctx.response.body = { error: "Invalid API key" };
        finalizeMetrics(401, false);
        return;
      }

      debugLog(`API key验证通过，AUTH_TOKEN=${apiKey.substring(0, 8)}......`);
    } else {
      debugLog("SKIP_AUTH_TOKEN已启用，跳过API key验证");
    }

    // Parse and validate request body
    const requestBody = await ctx.request.body().value;
    const request = OpenAIRequestSchema.parse(requestBody);

    debugLog(`请求解析成功 - 模型: ${request.model}, 流式: ${request.stream}, 消息数: ${request.messages.length}`);

    // Generate IDs
    const [chatId, msgId] = generateRequestIds();

    // Process messages with tools
    const processedMessages = processMessagesWithTools(
      request.messages.map(m => ({ ...m })),
      request.tools,
      request.tool_choice
    );

    // Convert back to Message objects
    const upstreamMessages: Message[] = [];
    for (const msg of processedMessages) {
      const content = contentToString(msg.content);

      upstreamMessages.push({
        role: msg.role,
        content: content,
        reasoning_content: msg.reasoning_content
      });
    }

    // Determine model features
    const isThinking = request.model === config.THINKING_MODEL;
    const isSearch = request.model === config.SEARCH_MODEL;
    const isAir = request.model === config.AIR_MODEL;
    const isNewThinking = request.model === config.THINKING_MODEL_NEW;
    const isNewSearch = request.model === config.SEARCH_MODEL_NEW;
    const searchMcp = isSearch || isNewSearch ? "deep-web-search" : "";

    // Determine upstream model ID based on requested model
    let upstreamModelId: string;
    let upstreamModelName: string;
    if (isAir) {
      upstreamModelId = "0727-106B-API"; // AIR model upstream ID
      upstreamModelName = "GLM-4.5-Air";
    } else if (request.model === config.PRIMARY_MODEL_NEW || isNewThinking || isNewSearch) {
      upstreamModelId = "GLM-4-6-API-V1"; // New GLM-4.6 model upstream ID
      if (isNewThinking) {
        upstreamModelName = "GLM-4.6-Thinking";
      } else if (isNewSearch) {
        upstreamModelName = "GLM-4.6-Search";
      } else {
        upstreamModelName = "GLM-4.6";
      }
    } else {
      upstreamModelId = "0727-360B-API"; // Default upstream model ID
      upstreamModelName = "GLM-4.5";
    }

    // Build upstream request
    const upstreamReq: UpstreamRequest = {
      stream: true, // Always use streaming from upstream
      chat_id: chatId,
      id: msgId,
      model: upstreamModelId, // Dynamic upstream model ID
      messages: upstreamMessages,
      params: {},
      features: {
        enable_thinking: isThinking || isNewThinking,
        web_search: isSearch || isNewSearch,
        auto_web_search: isSearch || isNewSearch,
      },
      background_tasks: {
        title_generation: false,
        tags_generation: false,
      },
      mcp_servers: searchMcp ? [searchMcp] : [],
      model_item: {
        id: upstreamModelId,
        name: upstreamModelName,
        owned_by: "openai"
      },
      tool_servers: [],
      variables: {
        "{{USER_NAME}}": "User",
        "{{USER_LOCATION}}": "Unknown",
        "{{CURRENT_DATETIME}}": new Date().toISOString().replace('T', ' ').substring(0, 19),
      }
    };

    // Get authentication token
    tokenInfo = await getAuthToken();
    const authToken = tokenInfo.token;

    // Check if tools are enabled and present
    const hasTools = (config.TOOL_SUPPORT &&
                    request.tools &&
                    request.tools.length > 0 &&
                    request.tool_choice !== "none");

    // Handle response based on stream flag
    if (request.stream) {
      const handler = new StreamResponseHandler(
        upstreamReq,
        chatId,
        authToken,
        hasTools,
        (result) => {
          if (!result.success) {
            finalizeMetrics(result.status, false);
          }
        },
      );

      // Set SSE headers
      ctx.response.headers.set("Content-Type", "text/event-stream");
      ctx.response.headers.set("Cache-Control", "no-cache");
      ctx.response.headers.set("Connection", "keep-alive");
      ctx.response.headers.set("Access-Control-Allow-Origin", "*");

      // Create a readable stream with better error handling
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of handler.handle()) {
              controller.enqueue(new TextEncoder().encode(chunk));
            }
            if (!metricsRecorded) {
              finalizeMetrics(200, true);
            }
            controller.close();
          } catch (error) {
            debugLog(`流式响应处理错误: ${error}`);
            // 发送错误信息到客户端
            try {
              const errorChunk = `data: {"error": {"message": "Stream processing error", "type": "internal_error"}}\n\n`;
              controller.enqueue(new TextEncoder().encode(errorChunk));
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            } catch (controllerError) {
              debugLog(`控制器错误: ${controllerError}`);
            }
            finalizeMetrics(500, false);
            controller.close();
          }
        },
        cancel() {
          debugLog("客户端取消了流式响应");
          finalizeMetrics(499, false);
        }
      });

      ctx.response.body = stream;
    } else {
      try {
        const handler = new NonStreamResponseHandler(
          upstreamReq,
          chatId,
          authToken,
          hasTools,
          (result) => {
            if (!result.success) {
              finalizeMetrics(result.status, false);
            }
          },
        );
        const response = await handler.handle();

        // Copy response properties
        ctx.response.status = response.status;
        ctx.response.headers = response.headers;
        ctx.response.body = await response.text();
        if (!metricsRecorded) {
          finalizeMetrics(response.status, response.ok);
        }
      } catch (nonStreamError) {
        debugLog(`非流式响应处理错误: ${nonStreamError}`);
        ctx.response.status = 500;
        ctx.response.body = { error: `Non-stream processing error: ${nonStreamError}` };
        finalizeMetrics(500, false);
      }
    }

  } catch (error) {
    debugLog(`外层请求处理错误: ${error}`);
    console.error("Error stack:", error);

    // 只有在响应还没有开始时才设置错误响应
    if (!ctx.response.body) {
      ctx.response.status = 500;
      ctx.response.body = { error: `Internal server error: ${error}` };
      finalizeMetrics(ctx.response.status ?? 500, false);
    } else if (!metricsRecorded) {
      finalizeMetrics(ctx.response.status ?? 500, false);
      debugLog("响应已开始，无法设置错误状态");
    }
  }
});
