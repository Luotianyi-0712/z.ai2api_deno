/**
 * Response handlers for streaming and non-streaming responses
 */

import { config } from "./config.ts";
import { 
  Delta, OpenAIResponse, 
  UpstreamRequest, UpstreamData, UpstreamError,
  UpstreamDataSchema
} from "../models/schemas.ts";
import { debugLog, callUpstreamApi, transformThinkingContent } from "../utils/helpers.ts";
import { SSEParser } from "../utils/sse_parser.ts";
import { extractToolInvocations, removeToolJsonContent } from "../utils/tools.ts";

type UpstreamResultCallback = (result: { success: boolean; status: number }) => void;

export function createOpenAIResponseChunk(
  model: string,
  delta?: Delta,
  finishReason?: string
): OpenAIResponse {
  /**Create OpenAI response chunk for streaming*/
  return {
    id: `chatcmpl-${Math.floor(Date.now() / 1000)}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      delta: delta || {},
      finish_reason: finishReason
    }]
  };
}

export async function* handleUpstreamError(error: UpstreamError): AsyncGenerator<string, void, unknown> {
  /**Handle upstream error response*/
  debugLog(`上游错误: code=${error.code}, detail=${error.detail}`);
  
  // Send end chunk
  const endChunk = createOpenAIResponseChunk(
    config.PRIMARY_MODEL,
    undefined,
    "stop"
  );
  yield `data: ${JSON.stringify(endChunk)}\n\n`;
  yield "data: [DONE]\n\n";
}

export abstract class ResponseHandler {
  protected upstreamReq: UpstreamRequest;
  protected chatId: string;
  protected authToken: string;
  
  constructor(upstreamReq: UpstreamRequest, chatId: string, authToken: string) {
    this.upstreamReq = upstreamReq;
    this.chatId = chatId;
    this.authToken = authToken;
  }
  
  protected async _callUpstream(): Promise<Response> {
    /**Call upstream API with error handling*/
    try {
      return await callUpstreamApi(this.upstreamReq, this.chatId, this.authToken);
    } catch (error) {
      debugLog(`调用上游失败: ${error}`);
      throw error;
    }
  }
  
  protected _handleUpstreamError(response: Response): void {
    /**Handle upstream error response*/
    debugLog(`上游返回错误状态: ${response.status}`);
    if (config.DEBUG_LOGGING) {
      response.text().then(text => {
        debugLog(`上游错误响应: ${text}`);
      });
    }
  }
}

export class StreamResponseHandler extends ResponseHandler {
  private hasTools: boolean;
  private bufferedContent: string = "";
  private toolCalls: unknown[] | null = null;
  private streamEnded: boolean = false; // 防止重复结束流
  private readonly resultCallback?: UpstreamResultCallback;
  private notifiedResult = false;

  constructor(
    upstreamReq: UpstreamRequest,
    chatId: string,
    authToken: string,
    hasTools: boolean = false,
    resultCallback?: UpstreamResultCallback,
  ) {
    super(upstreamReq, chatId, authToken);
    this.hasTools = hasTools;
    this.resultCallback = resultCallback;
  }

  private notifyResult(success: boolean, status: number): void {
    if (this.notifiedResult) {
      return;
    }
    this.notifiedResult = true;
    this.resultCallback?.({ success, status });
  }
  
  async *handle(): AsyncGenerator<string, void, unknown> {
    /**Handle streaming response*/
    debugLog(`开始处理流式响应 (chat_id=${this.chatId})`);
    
    let response: Response;
    try {
      response = await this._callUpstream();
    } catch {
      this.notifyResult(false, 502);
      yield "data: {\"error\": \"Failed to call upstream\"}\n\n";
      return;
    }

    if (!response.ok) {
      this._handleUpstreamError(response);
      this.notifyResult(false, response.status);
      yield "data: {\"error\": \"Upstream error\"}\n\n";
      return;
    }
    
    // Send initial role chunk
    const firstChunk = createOpenAIResponseChunk(
      config.PRIMARY_MODEL,
      { role: "assistant" }
    );
    yield `data: ${JSON.stringify(firstChunk)}\n\n`;
    
    // Process stream
    debugLog("开始读取上游SSE流");
    const sentInitialAnswer = false;
    
    const parser = new SSEParser(response, config.DEBUG_LOGGING);
    try {
      for await (const event of parser.iterJsonData((data: unknown) => {
        // Validate with schema
        return UpstreamDataSchema.parse(data);
      })) {
        const upstreamData = event.data as UpstreamData;
        
        // Check for errors
        if (this._hasError(upstreamData)) {
          const error = this._getError(upstreamData);
          this.notifyResult(false, 502);
          if (!this.streamEnded) {
            yield* handleUpstreamError(error);
            this.streamEnded = true;
          }
          break;
        }
        
        debugLog(`解析成功 - 类型: ${upstreamData.type}, 阶段: ${upstreamData.data.phase}, ` +
                 `内容长度: ${upstreamData.data.delta_content.length}, 完成: ${upstreamData.data.done}`);
        
        // Process content
        yield* this._processContent(upstreamData, sentInitialAnswer);
        
        // Check if done
        if ((upstreamData.data.done || upstreamData.data.phase === "done") && !this.streamEnded) {
          debugLog("检测到流结束信号");
          yield* this._sendEndChunk();
          this.streamEnded = true;
          break;
        }
      }
    } catch (streamError) {
      debugLog(`流处理异常: ${streamError}`);
      // 确保在异常情况下也能正确结束流
      this.notifyResult(false, 500);
      if (!this.streamEnded) {
        try {
          const errorChunk = createOpenAIResponseChunk(
            config.PRIMARY_MODEL,
            undefined,
            "stop"
          );
          yield `data: ${JSON.stringify(errorChunk)}\n\n`;
          yield "data: [DONE]\n\n";
          this.streamEnded = true;
          debugLog("异常情况下强制结束流");
        } catch (endError) {
          debugLog(`结束流时发生错误: ${endError}`);
        }
      }
    } finally {
      await parser[Symbol.asyncDispose]();
      // 最后的保护：确保无论如何都标记为已结束
      if (!this.streamEnded) {
        this.streamEnded = true;
        debugLog("在finally块中标记流为已结束");
      }
    }
  }
  
  private _hasError(upstreamData: UpstreamData): boolean {
    /**Check if upstream data contains error*/
    return Boolean(
      upstreamData.error || 
      upstreamData.data.error || 
      (upstreamData.data.inner && upstreamData.data.inner.error)
    );
  }
  
  private _getError(upstreamData: UpstreamData): UpstreamError {
    /**Get error from upstream data*/
    return (
      upstreamData.error || 
      upstreamData.data.error || 
      (upstreamData.data.inner?.error || null)
    )!;
  }
  
  private async *_processContent(
    upstreamData: UpstreamData, 
    sentInitialAnswer: boolean
  ): AsyncGenerator<string, void, unknown> {
    /**Process content from upstream data*/
    const content = upstreamData.data.delta_content || upstreamData.data.edit_content;
    
    if (!content) {
      return;
    }
    
    // Transform thinking content
    let processedContent = content;
    if (upstreamData.data.phase === "thinking") {
      processedContent = transformThinkingContent(content);
    }
    
    // Buffer content if tools are enabled
    if (this.hasTools) {
      this.bufferedContent += processedContent;
    } else {
      // Handle initial answer content
      if (!sentInitialAnswer && 
          upstreamData.data.edit_content && 
          upstreamData.data.phase === "answer") {
        
        const extractedContent = this._extractEditContent(upstreamData.data.edit_content);
        if (extractedContent) {
          debugLog(`发送普通内容: ${extractedContent}`);
          const chunk = createOpenAIResponseChunk(
            config.PRIMARY_MODEL,
            { content: extractedContent }
          );
          yield `data: ${JSON.stringify(chunk)}\n\n`;
          sentInitialAnswer = true;
        }
      }
      
      // Handle delta content
      if (upstreamData.data.delta_content) {
        if (processedContent) {
          if (upstreamData.data.phase === "thinking") {
            debugLog(`发送思考内容: ${processedContent}`);
            const chunk = createOpenAIResponseChunk(
              config.PRIMARY_MODEL,
              { reasoning_content: processedContent }
            );
            yield `data: ${JSON.stringify(chunk)}\n\n`;
          } else {
            debugLog(`发送普通内容: ${processedContent}`);
            const chunk = createOpenAIResponseChunk(
              config.PRIMARY_MODEL,
              { content: processedContent }
            );
            yield `data: ${JSON.stringify(chunk)}\n\n`;
          }
        }
      }
    }
  }
  
  private _extractEditContent(editContent: string): string {
    /**Extract meaningful content from edit_content HTML*/
    const blocks = editContent.split(/<glm_block view=""[^>]*>/);
    if (blocks.length > 1) {
      return blocks[1];
    }
    const parts = editContent.split("</details>");
    return parts.length > 1 ? parts[1] : "";
  }
  
  private async *_sendEndChunk(): AsyncGenerator<string, void, unknown> {
    /**Send end chunk and DONE signal (with duplicate protection)*/
    if (this.streamEnded) {
      debugLog("流已结束，跳过重复的结束信号");
      return;
    }
    
    let finishReason = "stop";
    
    if (this.hasTools) {
      // Try to extract tool calls from buffered content
      this.toolCalls = extractToolInvocations(this.bufferedContent);
      
      if (this.toolCalls) {
        // Send tool calls with proper format
        for (let i = 0; i < this.toolCalls.length; i++) {
          const tc = this.toolCalls[i] as Record<string, unknown>;
          const toolCallDelta = {
            index: i,
            id: tc.id,
            type: tc.type || "function",
            function: tc.function || {},
          };
          
          const outChunk = createOpenAIResponseChunk(
            config.PRIMARY_MODEL,
            { tool_calls: [toolCallDelta] }
          );
          yield `data: ${JSON.stringify(outChunk)}\n\n`;
        }
        
        finishReason = "tool_calls";
      } else {
        // Send regular content
        const trimmedContent = removeToolJsonContent(this.bufferedContent);
        if (trimmedContent) {
          const contentChunk = createOpenAIResponseChunk(
            config.PRIMARY_MODEL,
            { content: trimmedContent }
          );
          yield `data: ${JSON.stringify(contentChunk)}\n\n`;
        }
      }
    }
    
    // Send final chunk
    const endChunk = createOpenAIResponseChunk(
      config.PRIMARY_MODEL,
      undefined,
      finishReason
    );
    yield `data: ${JSON.stringify(endChunk)}\n\n`;
    yield "data: [DONE]\n\n";
    this.streamEnded = true;
    debugLog("流式响应完成");
    this.notifyResult(true, 200);
  }
}

export class NonStreamResponseHandler extends ResponseHandler {
  private hasTools: boolean;
  private readonly resultCallback?: UpstreamResultCallback;
  private notifiedResult = false;

  constructor(
    upstreamReq: UpstreamRequest,
    chatId: string,
    authToken: string,
    hasTools: boolean = false,
    resultCallback?: UpstreamResultCallback,
  ) {
    super(upstreamReq, chatId, authToken);
    this.hasTools = hasTools;
    this.resultCallback = resultCallback;
  }

  private notifyResult(success: boolean, status: number): void {
    if (this.notifiedResult) {
      return;
    }
    this.notifiedResult = true;
    this.resultCallback?.({ success, status });
  }
  
  async handle(): Promise<Response> {
    /**Handle non-streaming response*/
    debugLog(`开始处理非流式响应 (chat_id=${this.chatId})`);
    
    let response: Response;
    try {
      response = await this._callUpstream();
    } catch (error) {
      debugLog(`调用上游失败: ${error}`);
      this.notifyResult(false, 502);
      return new Response(
        JSON.stringify({ error: "Failed to call upstream" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      this._handleUpstreamError(response);
      this.notifyResult(false, response.status);
      return new Response(
        JSON.stringify({ error: "Upstream error" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Collect full response
    const fullContent: string[] = [];
    debugLog("开始收集完整响应内容");
    
    const parser = new SSEParser(response, config.DEBUG_LOGGING);
    try {
      for await (const event of parser.iterJsonData((data: unknown) => {
        return UpstreamDataSchema.parse(data);
      })) {
        const upstreamData = event.data as UpstreamData;
        
        if (upstreamData.data.delta_content) {
          let content = upstreamData.data.delta_content;
          
          if (upstreamData.data.phase === "thinking") {
            content = transformThinkingContent(content);
          }
          
          if (content) {
            fullContent.push(content);
          }
        }
        
        if (upstreamData.data.done || upstreamData.data.phase === "done") {
          debugLog("检测到完成信号，停止收集");
          break;
        }
      }
    } finally {
      await parser[Symbol.asyncDispose]();
    }
    
    const finalContent = fullContent.join("");
    debugLog(`内容收集完成，最终长度: ${finalContent.length}`);
    
    // Handle tool calls for non-streaming
    let toolCalls: unknown[] | null = null;
    let finishReason = "stop";
    let messageContent: string | null = finalContent;
    
    if (this.hasTools) {
      toolCalls = extractToolInvocations(finalContent);
      if (toolCalls) {
        // Content must be null when tool_calls are present (OpenAI spec)
        messageContent = null;
        finishReason = "tool_calls";
        debugLog(`提取到工具调用: ${JSON.stringify(toolCalls)}`);
      } else {
        // Remove tool JSON from content
        messageContent = removeToolJsonContent(finalContent);
        if (!messageContent) {
          messageContent = finalContent; // 保留原内容如果清理后为空
        }
      }
    }
    
    // Build response
    const responseData: OpenAIResponse = {
      id: `chatcmpl-${Math.floor(Date.now() / 1000)}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: config.PRIMARY_MODEL,
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: messageContent || undefined,
          tool_calls: toolCalls as Record<string, unknown>[] | undefined
        },
        finish_reason: finishReason
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
    
    debugLog("非流式响应发送完成");
    const finalResponse = new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

    this.notifyResult(true, 200);
    return finalResponse;
  }
}
