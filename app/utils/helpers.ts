/**
 * Utility functions for the application
 */

import { config } from "../core/config.ts";
import { backupTokenManager, AuthTokenInfo } from "../core/token_manager.ts";

// 全局 UserAgent 实例，避免每次调用都创建新实例
let _userAgentInstance: Record<string, string> | null = null;

function getUserAgentInstance() {
  if (_userAgentInstance === null) {
    // 使用简单的随机User-Agent生成
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
    ];
    _userAgentInstance = {
      chrome: userAgents[0],
      edge: userAgents[1],
      firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
      safari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
      random: userAgents[Math.floor(Math.random() * userAgents.length)]
    };
  }
  return _userAgentInstance;
}

export function debugLog(message: string, ...args: unknown[]): void {
  /**Log debug message if debug mode is enabled*/
  if (config.DEBUG_LOGGING) {
    if (args.length > 0) {
      console.log(`[DEBUG] ${message}`, ...args);
    } else {
      console.log(`[DEBUG] ${message}`);
    }
  }
}

/**
 * 生成API请求所需的签名头部
 * 签名参数逻辑实现
 */
export async function generateSignatureHeaders(
  token: string, 
  body: string = "", 
  method: string = "POST"
): Promise<Record<string, string>> {
  // 生成时间戳（毫秒）
  const timestamp = Date.now().toString();
  
  // 生成16位随机nonce
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  const nonce = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  
  // 生成签名字符串: method + "\n" + timestamp + "\n" + nonce + "\n" + body
  const signString = `${method}\n${timestamp}\n${nonce}\n${body}`;
  
  // 使用HMAC-SHA256生成签名
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(token),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signString)
  );
  
  // 将签名转换为十六进制字符串
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  debugLog(`🔐 生成签名头部: timestamp=${timestamp}, nonce=${nonce.substring(0, 8)}..., signature=${signatureHex.substring(0, 16)}...`);
  
  return {
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Signature": signatureHex
  };
}

export function generateRequestIds(): [string, string] {
  /**Generate unique IDs for chat and message*/
  const timestamp = Math.floor(Date.now() / 1000);
  const chatId = `${timestamp * 1000}-${timestamp}`;
  const msgId = String(timestamp * 1000000);
  return [chatId, msgId];
}

export function getBrowserHeaders(refererChatId: string = ""): Record<string, string> {
  /**Get browser headers for API requests with dynamic User-Agent*/
  
  // 获取 UserAgent 实例
  const ua = getUserAgentInstance();
  
  // 随机选择一个浏览器类型，偏向使用 Chrome 和 Edge
  const browserChoices = ['chrome', 'chrome', 'chrome', 'edge', 'edge', 'firefox', 'safari'];
  const browserType = browserChoices[Math.floor(Math.random() * browserChoices.length)];
  
  let userAgent: string;
  try {
    // 根据浏览器类型获取 User-Agent
    switch (browserType) {
      case 'chrome':
        userAgent = ua.chrome;
        break;
      case 'edge':
        userAgent = ua.edge;
        break;
      case 'firefox':
        userAgent = ua.firefox;
        break;
      case 'safari':
        userAgent = ua.safari;
        break;
      default:
        userAgent = ua.random;
    }
  } catch {
    // 如果获取失败，使用随机 User-Agent
    userAgent = ua.random;
  }
  
  // 提取浏览器版本信息
  let chromeVersion = "139"; // 默认版本
  let edgeVersion = "139";
  
  if (userAgent.includes("Chrome/")) {
    try {
      chromeVersion = userAgent.split("Chrome/")[1].split(".")[0];
    } catch {
      // 忽略错误
    }
  }
  
  let secChUa: string | undefined;
  if (userAgent.includes("Edg/")) {
    try {
      edgeVersion = userAgent.split("Edg/")[1].split(".")[0];
      // Edge 基于 Chromium，使用 Edge 特定的 sec-ch-ua
      secChUa = `"Microsoft Edge";v="${edgeVersion}", "Chromium";v="${chromeVersion}", "Not_A Brand";v="24"`;
    } catch {
      secChUa = `"Not_A Brand";v="8", "Chromium";v="${chromeVersion}", "Google Chrome";v="${chromeVersion}"`;
    }
  } else if (userAgent.includes("Firefox/")) {
    // Firefox 不使用 sec-ch-ua
    secChUa = undefined;
  } else {
    // Chrome 或其他基于 Chromium 的浏览器
    secChUa = `"Not_A Brand";v="8", "Chromium";v="${chromeVersion}", "Google Chrome";v="${chromeVersion}"`;
  }
  
  // 构建动态 Headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "User-Agent": userAgent,
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-US;q=0.7",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "X-FE-Version": "prod-fe-1.0.79",
    "Origin": config.CLIENT_HEADERS["Origin"],
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };
  
  // 只有基于 Chromium 的浏览器才添加 sec-ch-ua
  if (secChUa) {
    headers["sec-ch-ua"] = secChUa;
  }
  
  // 添加 Referer
  if (refererChatId) {
    headers["Referer"] = `${config.CLIENT_HEADERS['Origin']}/c/${refererChatId}`;
  }
  
  // 调试日志
  if (config.DEBUG_LOGGING) {
    debugLog(`使用 User-Agent: ${userAgent.substring(0, 100)}...`);
  }
  
  return headers;
}

export async function getAnonymousToken(): Promise<string> {
  /**Get anonymous token for authentication*/
  const headers = getBrowserHeaders();
  headers["Accept"] = "*/*";
  headers["Accept-Language"] = "zh-CN,zh;q=0.9";
  headers["Referer"] = `${config.CLIENT_HEADERS['Origin']}/`;
  
  // 为获取token添加签名头部（使用临时token）
  const tempToken = "anonymous";
  const signatureHeaders = await generateSignatureHeaders(tempToken, "", "GET");
  Object.assign(headers, signatureHeaders);
  
  try {
    const response = await fetch(
      `${config.CLIENT_HEADERS['Origin']}/api/v1/auths/`,
      {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(10000),
      }
    );
    
    if (!response.ok) {
      throw new Error(`anon token status=${response.status}`);
    }
    
    const data = await response.json();
    const token = data.token;
    if (!token) {
      throw new Error("anon token empty");
    }
    
    return token;
  } catch (error) {
    debugLog(`获取匿名token失败: ${error}`);
    throw error;
  }
}

export async function getAuthToken(): Promise<AuthTokenInfo> {
  /**Get authentication token (anonymous or fixed)*/
  if (config.ANONYMOUS_MODE) {
    try {
      const token = await getAnonymousToken();
      debugLog(`匿名token获取成功: ${token.substring(0, 10)}...`);
      return {
        token,
        source: "anonymous",
        displayToken: token,
      };
    } catch (error) {
      debugLog(`匿名token获取失败，回退固定token: ${error}`);
    }
  }

  const backupToken = backupTokenManager.getNextToken() ?? config.BACKUP_TOKEN;
  if (!backupToken) {
    throw new Error("No backup token configured");
  }

  return {
    token: backupToken,
    source: "backup",
    displayToken: backupTokenManager.getMaskedToken(backupToken),
  };
}

export function transformThinkingContent(content: string): string {
  /**Transform thinking content according to configuration*/
  // Remove summary tags
  content = content.replace(/<summary>[\s\S]*?<\/summary>/g, '');
  // Clean up remaining tags
  content = content.replace(/<\/thinking>/g, "").replace(/<Full>/g, "").replace(/<\/Full>/g, "");
  content = content.trim();
  
  if (config.THINKING_PROCESSING === "think") {
    content = content.replace(/<details[^>]*>/g, '<span>');
    content = content.replace(/<\/details>/g, "</span>");
  } else if (config.THINKING_PROCESSING === "strip") {
    content = content.replace(/<details[^>]*>/g, '');
    content = content.replace(/<\/details>/g, "");
  }
  
  // Remove line prefixes
  content = content.replace(/^> /gm, '');
  content = content.replace(/\n> /g, "\n");
  
  return content.trim();
}

export async function callUpstreamApi(
  upstreamReq: Record<string, unknown>,
  chatId: string,
  authToken: string
): Promise<Response> {
  /**Call upstream API with proper headers*/
  const headers = getBrowserHeaders(chatId);
  headers["Authorization"] = `Bearer ${authToken}`;
  
  // 生成请求体JSON字符串用于签名
  const bodyJson = JSON.stringify(upstreamReq);
  
  // 生成签名头部
  const signatureHeaders = await generateSignatureHeaders(authToken, bodyJson, "POST");
  Object.assign(headers, signatureHeaders);
  
  debugLog(`调用上游API: ${config.API_ENDPOINT}`);
  debugLog(`上游请求体: ${bodyJson}`);
  
  const response = await fetch(config.API_ENDPOINT, {
    method: "POST",
    headers,
    body: bodyJson,
    signal: AbortSignal.timeout(60000),
  });
  
  debugLog(`上游响应状态: ${response.status}`);
  return response;
}

export async function fetchModelsFromAPI(): Promise<unknown[]> {
  /**Fetch latest models from Z.AI API with anonymous token*/
  try {
    // 首先获取匿名 token
    const authToken = await getAnonymousToken();
    debugLog(`使用匿名token获取模型: ${authToken.substring(0, 10)}...`);

    const headers = getBrowserHeaders();
    headers["Accept"] = "application/json";
    headers["Authorization"] = `Bearer ${authToken}`;
    headers["User-Agent"] = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

    const response = await fetch("https://chat.z.ai/api/models", {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      debugLog(`获取模型列表失败: ${response.status}`);
      return [];
    }

    const data = await response.json();
    debugLog(`成功获取到模型信息: ${JSON.stringify(data, null, 2)}`);
    
    return data.data || [];
  } catch (error) {
    debugLog(`获取模型列表异常: ${error}`);
    return [];
  }
}
