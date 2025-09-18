/**
 * Utility functions for the application
 */

import { config } from "../core/config.ts";

// 全局 UserAgent 实例，避免每次调用都创建新实例
let _userAgentInstance: any = null;

async function getUserAgentInstance() {
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

export function debugLog(message: string, ...args: any[]): void {
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
 */
export async function generateSignatureHeaders(
  token: string, 
  body: string = "", 
  method: string = "POST"
): Promise<Record<string, string>> {
  // 生成时间戳（毫秒）
  const timestamp = Date.now();
  
  // 生成签名字符串
  const signString = `${method}\n${timestamp}\n${body}`;
  
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
  
  debugLog(`🔐 生成签名: timestamp=${timestamp}, signature=${signatureHex.substring(0, 16)}...`);
  
  return {
    "X-Signature": signatureHex
  };
}

/**
 * 生成API请求的URL查询参数
 */
export function generateApiQueryParams(token: string, chatId: string): URLSearchParams {
  const timestamp = Date.now();
  const requestId = crypto.randomUUID();
  
  // 提取user_id (从token的payload中，如果是JWT格式)
  let userId = "";
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length === 3) {
      const payload = JSON.parse(atob(tokenParts[1]));
      userId = payload.id || "";
    }
  } catch (e) {
    // 如果解析失败，生成一个随机ID
    userId = crypto.randomUUID();
  }
  
  const params = new URLSearchParams({
    timestamp: timestamp.toString(),
    requestId: requestId,
    user_id: userId,
    version: "0.0.1",
    platform: "web",
    token: token,
    user_agent: encodeURIComponent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0"),
    language: "zh-CN",
    languages: "zh-CN,en,en-GB,en-US",
    timezone: "Asia/Shanghai",
    cookie_enabled: "true",
    screen_width: "1920",
    screen_height: "1080", 
    screen_resolution: "1920x1080",
    viewport_height: "900",
    viewport_width: "1200",
    viewport_size: "1200x900",
    color_depth: "24",
    pixel_ratio: "1.0",
    current_url: encodeURIComponent(`https://chat.z.ai/c/${chatId}`),
    pathname: encodeURIComponent(`/c/${chatId}`),
    search: "",
    hash: "",
    host: "chat.z.ai",
    hostname: "chat.z.ai",
    protocol: "https:",
    referrer: "",
    title: encodeURIComponent("Chat with Z.ai - Free AI Chatbot powered by GLM-4.5"),
    timezone_offset: "-480",
    local_time: new Date().toISOString(),
    utc_time: new Date().toUTCString(),
    is_mobile: "false",
    is_touch: "false",
    max_touch_points: "10",
    browser_name: "Chrome",
    os_name: "Windows",
    signature_timestamp: timestamp.toString()
  });
  
  return params;
}

export function generateRequestIds(): [string, string] {
  /**Generate unique IDs for chat and message*/
  const timestamp = Math.floor(Date.now() / 1000);
  const chatId = `${timestamp * 1000}-${timestamp}`;
  const msgId = String(timestamp * 1000000);
  return [chatId, msgId];
}

export async function getBrowserHeaders(refererChatId: string = ""): Promise<Record<string, string>> {
  /**Get browser headers for API requests with dynamic User-Agent*/
  
  // 获取 UserAgent 实例
  const ua = await getUserAgentInstance();
  
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
    "Accept": "*/*",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "zh-CN",
    "Connection": "keep-alive",
    "Content-Type": "application/json",
    "Host": "chat.z.ai",
    "Origin": "https://chat.z.ai",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": userAgent,
    "X-FE-Version": "prod-fe-1.0.84",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
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
  const headers = await getBrowserHeaders();
  headers["Referer"] = `${config.CLIENT_HEADERS['Origin']}/`;
  
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

export async function getAuthToken(): Promise<string> {
  /**Get authentication token (anonymous or fixed)*/
  if (config.ANONYMOUS_MODE) {
    try {
      const token = await getAnonymousToken();
      debugLog(`匿名token获取成功: ${token.substring(0, 10)}...`);
      return token;
    } catch (error) {
      debugLog(`匿名token获取失败，回退固定token: ${error}`);
    }
  }
  
  return config.BACKUP_TOKEN;
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
  upstreamReq: any,
  chatId: string,
  authToken: string
): Promise<Response> {
  /**Call upstream API with proper headers and URL params (based on real Z.AI format)*/
  const headers = await getBrowserHeaders(chatId);
  headers["Authorization"] = `Bearer ${authToken}`;
  headers["Referer"] = `https://chat.z.ai/c/${chatId}`;
  
  // 生成请求体JSON字符串
  const bodyJson = JSON.stringify(upstreamReq);
  headers["Content-Length"] = bodyJson.length.toString();
  
  // 生成URL查询参数
  const queryParams = generateApiQueryParams(authToken, chatId);
  const fullUrl = `${config.API_ENDPOINT}?${queryParams.toString()}`;
  
  // 生成签名头部
  const signatureHeaders = await generateSignatureHeaders(authToken, bodyJson, "POST");
  Object.assign(headers, signatureHeaders);
  
  debugLog(`调用上游API: ${fullUrl}`);
  debugLog(`上游请求体长度: ${bodyJson.length}`);
  
  const response = await fetch(fullUrl, {
    method: "POST",
    headers,
    body: bodyJson,
    signal: AbortSignal.timeout(60000),
  });
  
  debugLog(`上游响应状态: ${response.status}`);
  return response;
}
