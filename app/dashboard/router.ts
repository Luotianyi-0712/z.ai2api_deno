import { Router, Context } from "oak/mod.ts";
import { config } from "../core/config.ts";
import { metricsManager } from "../core/metrics.ts";
import { backupTokenManager } from "../core/token_manager.ts";

const SESSION_COOKIE = "dashboard_session";
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const sessions = new Map<string, number>();

function cleanupSessions(): void {
  const now = Date.now();
  for (const [sessionId, expiry] of sessions.entries()) {
    if (expiry <= now) {
      sessions.delete(sessionId);
    }
  }
}

async function getSessionId(ctx: Context): Promise<string | null> {
  cleanupSessions();
  const sessionId = await ctx.cookies.get(SESSION_COOKIE);
  if (!sessionId) {
    return null;
  }
  const expiry = sessions.get(sessionId);
  if (!expiry || expiry <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return sessionId;
}

async function ensureSession(ctx: Context): Promise<boolean> {
  const sessionId = await getSessionId(ctx);
  if (!sessionId) {
    return false;
  }
  const nextExpiry = Date.now() + SESSION_DURATION;
  sessions.set(sessionId, nextExpiry);
  await ctx.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "Strict",
    maxAge: SESSION_DURATION / 1000,
  });
  return true;
}

function createSession(): string {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, Date.now() + SESSION_DURATION);
  return sessionId;
}

function renderLoginPage(errorMessage = ""): string {
  const errorSection = errorMessage
    ? `<p class="error">${errorMessage}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Dashboard 登录</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .login-card { background: white; padding: 32px; border-radius: 16px; box-shadow: 0 20px 45px rgba(15, 23, 42, 0.15); width: 360px; }
    h1 { margin: 0 0 24px; font-size: 24px; color: #111827; text-align: center; }
    label { display: block; margin-bottom: 8px; color: #374151; font-weight: 600; }
    input[type="password"] { width: 100%; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 16px; transition: border-color 0.2s, box-shadow 0.2s; }
    input[type="password"]:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2); }
    button { margin-top: 16px; width: 100%; padding: 12px; border: none; border-radius: 10px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
    button:hover { transform: translateY(-1px); box-shadow: 0 15px 30px rgba(99, 102, 241, 0.3); }
    .error { margin-top: 16px; color: #ef4444; text-align: center; }
  </style>
</head>
<body>
  <div class="login-card">
    <h1>管理面板登录</h1>
    ${errorSection}
    <form method="post" action="/dashboard/login">
      <label for="password">访问密码</label>
      <input type="password" id="password" name="password" placeholder="请输入AUTH_TOKEN" required />
      <button type="submit">登录</button>
    </form>
  </div>
</body>
</html>`;
}

const dashboardPage = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>API 监控面板</title>
  <style>
    :root {
      color-scheme: light dark;
    }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      margin: 0;
      padding: 24px;
    }
    h1 {
      margin: 0;
      font-size: 28px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-top: 24px;
    }
    .card {
      background: rgba(30, 41, 59, 0.85);
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(12px);
    }
    .card h2 {
      margin: 0 0 12px;
      font-size: 18px;
      color: #cbd5f5;
    }
    .stat {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .stat-label {
      color: #94a3b8;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 14px;
    }
    th, td {
      padding: 8px 10px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
      text-align: left;
    }
    th {
      color: #cbd5f5;
      font-weight: 600;
      background: rgba(30, 41, 59, 0.6);
    }
    tbody tr:hover {
      background: rgba(59, 130, 246, 0.12);
    }
    .status-success {
      color: #34d399;
    }
    .status-failure {
      color: #f87171;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-top: 16px;
    }
    .toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 13px;
      background: rgba(148, 163, 184, 0.2);
      color: #e2e8f0;
    }
    input[type="checkbox"] {
      width: 18px;
      height: 18px;
    }
    button.primary {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none;
      color: white;
      padding: 8px 14px;
      border-radius: 999px;
      cursor: pointer;
      font-weight: 600;
    }
    button.secondary {
      background: transparent;
      border: 1px solid rgba(148, 163, 184, 0.4);
      color: #e2e8f0;
      padding: 8px 14px;
      border-radius: 999px;
      cursor: pointer;
    }
    .token-form {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .token-form input {
      flex: 1 1 240px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.3);
      background: rgba(15, 23, 42, 0.6);
      color: #f8fafc;
    }
    .message {
      margin-top: 12px;
      font-size: 14px;
    }
    .message.error { color: #f87171; }
    .message.success { color: #34d399; }
    .message.warning { color: #fbbf24; }
    .section-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .token-table-wrapper {
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <header>
    <h1>API 监控面板</h1>
    <div class="controls">
      <span class="tag">匿名模式: <strong id="modeStatus">-</strong></span>
      <span class="tag">上次更新: <strong id="lastUpdated">-</strong></span>
      <label class="toggle"><input type="checkbox" id="autoRefresh" checked /> 自动刷新</label>
      <button type="button" class="secondary" id="manualRefresh">立即刷新</button>
      <form method="post" action="/dashboard/logout" style="display:inline">
        <button type="submit" class="secondary">退出登录</button>
      </form>
    </div>
    <p id="statusMessage" class="message" role="status"></p>
  </header>

  <section class="grid" id="summaryCards">
    <div class="card">
      <h2>总请求数</h2>
      <div class="stat" id="totalRequests">0</div>
      <div class="stat-label">Total Requests</div>
    </div>
    <div class="card">
      <h2>成功请求</h2>
      <div class="stat status-success" id="successRequests">0</div>
      <div class="stat-label">Successful</div>
    </div>
    <div class="card">
      <h2>失败请求</h2>
      <div class="stat status-failure" id="failedRequests">0</div>
      <div class="stat-label">Failed</div>
    </div>
    <div class="card">
      <h2>平均响应时间 (ms)</h2>
      <div class="stat" id="avgResponse">0</div>
      <div class="stat-label">Average Response Time</div>
    </div>
  </section>

  <section class="card" style="margin-top:24px;">
    <div class="section-title">
      <h2>Backup Token 管理</h2>
    </div>
    <p id="tokenInfo" class="stat-label">当前共有 <span id="tokenCount">0</span> 个可用 token。</p>
    <div class="token-form">
      <input type="text" id="newToken" placeholder="输入新的 backup token" />
      <button type="button" class="primary" id="addTokenBtn">添加 Token</button>
    </div>
    <p id="tokenMessage" class="message" role="status"></p>
    <div class="token-table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Token</th>
            <th>成功次数</th>
            <th>失败次数</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody id="tokenTableBody"></tbody>
      </table>
    </div>
  </section>

  <section class="card" style="margin-top:24px;">
    <div class="section-title">
      <h2>最近请求 (最多 100 条)</h2>
      <span class="stat-label" id="requestCount">0 条记录</span>
    </div>
    <div style="overflow-x:auto;">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>方法</th>
            <th>路径</th>
            <th>状态码</th>
            <th>耗时 (ms)</th>
            <th>结果</th>
            <th>客户端 IP</th>
            <th>Token</th>
          </tr>
        </thead>
        <tbody id="requestTableBody"></tbody>
      </table>
    </div>
  </section>

  <script>
    const autoRefreshCheckbox = document.getElementById('autoRefresh');
    const manualRefreshBtn = document.getElementById('manualRefresh');
    const statusMessage = document.getElementById('statusMessage');
    const tokenTableBody = document.getElementById('tokenTableBody');
    const tokenMessage = document.getElementById('tokenMessage');
    const newTokenInput = document.getElementById('newToken');
    const addTokenBtn = document.getElementById('addTokenBtn');
    let refreshTimer = null;

    function formatTime(ts) {
      try {
        return new Date(ts).toLocaleString();
      } catch {
        return ts;
      }
    }

    function getErrorMessage(error) {
      if (error && typeof error === 'object' && 'message' in error && error.message) {
        return error.message;
      }
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }

    function setStatus(message, type = '') {
      statusMessage.textContent = message;
      statusMessage.className = 'message ' + type;
    }

    async function fetchData() {
      try {
        const response = await fetch('/dashboard/api/data', { credentials: 'same-origin' });
        if (!response.ok) {
          throw new Error('无法获取监控数据');
        }
        const data = await response.json();
        updateSummary(data.summary);
        updateMode(data.anonymousMode);
        updateTokens(data.backupTokens);
        updateRequests(data.recentRequests);
        document.getElementById('lastUpdated').textContent = formatTime(data.updatedAt);
        setStatus('数据已更新。', 'success');
      } catch (error) {
        console.error(error);
        setStatus(getErrorMessage(error), 'error');
      }
    }

    function updateSummary(summary) {
      document.getElementById('totalRequests').textContent = summary.totalRequests;
      document.getElementById('successRequests').textContent = summary.successfulRequests;
      document.getElementById('failedRequests').textContent = summary.failedRequests;
      document.getElementById('avgResponse').textContent = summary.averageResponseTime;
    }

    function updateMode(isAnonymous) {
      document.getElementById('modeStatus').textContent = isAnonymous ? '开启' : '关闭';
    }

    function updateTokens(tokens) {
      tokenTableBody.innerHTML = '';
      document.getElementById('tokenCount').textContent = tokens.length;
      if (tokens.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = '暂无配置的 backup token';
        cell.style.textAlign = 'center';
        row.appendChild(cell);
        tokenTableBody.appendChild(row);
        return;
      }
      for (const token of tokens) {
        const row = document.createElement('tr');
        row.innerHTML = \`
          <td style="word-break: break-all;">\${token.token}</td>
          <td class="status-success">\${token.success}</td>
          <td class="status-failure">\${token.failure}</td>
          <td><button type="button" class="secondary" data-token="\${encodeURIComponent(token.token)}">删除</button></td>
        \`;
        tokenTableBody.appendChild(row);
      }
    }

    function updateRequests(requests) {
      const requestTableBody = document.getElementById('requestTableBody');
      requestTableBody.innerHTML = '';
      document.getElementById('requestCount').textContent = requests.length + ' 条记录';
      if (requests.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 8;
        cell.textContent = '暂无请求记录';
        cell.style.textAlign = 'center';
        row.appendChild(cell);
        requestTableBody.appendChild(row);
        return;
      }
      for (const req of requests) {
        const row = document.createElement('tr');
        const statusClass = req.success ? 'status-success' : 'status-failure';
        row.innerHTML = \`
          <td>\${formatTime(req.timestamp)}</td>
          <td>\${req.method}</td>
          <td>\${req.path}</td>
          <td class="\${statusClass}">\${req.status}</td>
          <td>\${req.durationMs}</td>
          <td class="\${statusClass}">\${req.success ? '成功' : '失败'}</td>
          <td>\${req.clientIp}</td>
          <td>\${req.tokenDisplay}</td>
        \`;
        requestTableBody.appendChild(row);
      }
    }

    function startAutoRefresh() {
      if (refreshTimer) return;
      refreshTimer = setInterval(fetchData, 5000);
    }

    function stopAutoRefresh() {
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
    }

    autoRefreshCheckbox.addEventListener('change', () => {
      if (autoRefreshCheckbox.checked) {
        startAutoRefresh();
        setStatus('自动刷新已开启。');
      } else {
        stopAutoRefresh();
        setStatus('自动刷新已关闭。', 'warning');
      }
    });

    manualRefreshBtn.addEventListener('click', () => {
      fetchData();
    });

    addTokenBtn.addEventListener('click', async () => {
      const token = newTokenInput.value.trim();
      if (!token) {
        tokenMessage.textContent = '请输入有效的 token。';
        tokenMessage.className = 'message error';
        return;
      }
      try {
        const res = await fetch('/dashboard/api/tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ token })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: '添加失败' }));
          throw new Error(err.error || '添加失败');
        }
        newTokenInput.value = '';
        tokenMessage.textContent = 'Token 添加成功。';
        tokenMessage.className = 'message success';
        const data = await res.json();
        updateTokens(data.tokens);
        setStatus('Token 列表已更新。');
      } catch (error) {
        tokenMessage.textContent = getErrorMessage(error);
        tokenMessage.className = 'message error';
      }
    });

    tokenTableBody.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const encoded = target.dataset.token;
      if (!encoded) return;
      if (!confirm('确定要删除该 token 吗？')) return;
      try {
        const res = await fetch('/dashboard/api/tokens', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ token: decodeURIComponent(encoded) })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: '删除失败' }));
          throw new Error(err.error || '删除失败');
        }
        const data = await res.json();
        updateTokens(data.tokens);
        tokenMessage.textContent = 'Token 删除成功。';
        tokenMessage.className = 'message success';
        setStatus('Token 列表已更新。');
      } catch (error) {
        tokenMessage.textContent = getErrorMessage(error);
        tokenMessage.className = 'message error';
      }
    });

    fetchData();
    startAutoRefresh();
  </script>
</body>
</html>`;

export const dashboardRouter = new Router();

dashboardRouter.get("/dashboard", async (ctx) => {
  const authed = await ensureSession(ctx);
  ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
  if (!authed) {
    ctx.response.body = renderLoginPage();
    return;
  }
  ctx.response.body = dashboardPage;
});

dashboardRouter.post("/dashboard/login", async (ctx) => {
  const body = ctx.request.body({ type: "form" });
  const form = await body.value;
  const password = form.get("password") ?? "";
  if (password === config.AUTH_TOKEN) {
    const sessionId = createSession();
    await ctx.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "Strict",
      maxAge: SESSION_DURATION / 1000,
    });
    ctx.response.redirect("/dashboard");
    return;
  }

  ctx.response.status = 401;
  ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
  ctx.response.body = renderLoginPage("密码错误，请重试。");
});

dashboardRouter.post("/dashboard/logout", async (ctx) => {
  const sessionId = await ctx.cookies.get(SESSION_COOKIE);
  if (sessionId) {
    sessions.delete(sessionId);
  }
  await ctx.cookies.delete(SESSION_COOKIE);
  ctx.response.redirect("/dashboard");
});

dashboardRouter.use("/dashboard/api", async (ctx, next) => {
  const authed = await ensureSession(ctx);
  if (!authed) {
    ctx.response.status = 401;
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = { error: "Unauthorized" };
    return;
  }
  await next();
});

dashboardRouter.get("/dashboard/api/data", (ctx) => {
  const summary = metricsManager.getSummary();
  const requests = metricsManager.getRecentRequests();
  ctx.response.headers.set("Content-Type", "application/json");
  ctx.response.body = {
    summary,
    anonymousMode: config.ANONYMOUS_MODE,
    backupTokens: backupTokenManager.getStatus(),
    recentRequests: requests,
    updatedAt: new Date().toISOString(),
  };
});

dashboardRouter.post("/dashboard/api/tokens", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const token = (body?.token ?? "").trim();
    if (!token) {
      ctx.response.status = 400;
      ctx.response.headers.set("Content-Type", "application/json");
      ctx.response.body = { error: "Token 不能为空" };
      return;
    }
    const added = backupTokenManager.addToken(token);
    if (!added) {
      ctx.response.status = 409;
      ctx.response.headers.set("Content-Type", "application/json");
      ctx.response.body = { error: "Token 已存在或无效" };
      return;
    }
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = { success: true, tokens: backupTokenManager.getStatus() };
  } catch (error) {
    ctx.response.status = 400;
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = { error: `无法解析请求: ${error}` };
  }
});

dashboardRouter.delete("/dashboard/api/tokens", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const token = (body?.token ?? "").trim();
    if (!token) {
      ctx.response.status = 400;
      ctx.response.headers.set("Content-Type", "application/json");
      ctx.response.body = { error: "Token 不能为空" };
      return;
    }
    const removed = backupTokenManager.removeToken(token);
    if (!removed) {
      ctx.response.status = 404;
      ctx.response.headers.set("Content-Type", "application/json");
      ctx.response.body = { error: "未找到指定 token" };
      return;
    }
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = { success: true, tokens: backupTokenManager.getStatus() };
  } catch (error) {
    ctx.response.status = 400;
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = { error: `无法解析请求: ${error}` };
  }
});
