import { formatTokenDisplay, TokenSource } from "./token_manager.ts";

export interface RequestLogEntry {
  timestamp: number;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  success: boolean;
  clientIp: string;
  tokenDisplay: string;
  tokenSource: TokenSource | "none";
}

export interface MetricsSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
}

class MetricsManager {
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private totalResponseTime = 0;
  private readonly recentRequests: RequestLogEntry[] = [];
  private readonly maxRecent = 100;

  recordRequest(entry: Omit<RequestLogEntry, "tokenDisplay"> & { token: string; tokenSource: TokenSource | "none" }): void {
    const tokenDisplay = entry.tokenSource === "none"
      ? "-"
      : formatTokenDisplay(entry.token, entry.tokenSource === "none" ? "backup" : entry.tokenSource);

    const logEntry: RequestLogEntry = {
      timestamp: entry.timestamp,
      method: entry.method,
      path: entry.path,
      status: entry.status,
      durationMs: entry.durationMs,
      success: entry.success,
      clientIp: entry.clientIp,
      tokenDisplay,
      tokenSource: entry.tokenSource,
    };

    this.totalRequests += 1;
    if (entry.success) {
      this.successfulRequests += 1;
    } else {
      this.failedRequests += 1;
    }
    this.totalResponseTime += entry.durationMs;

    this.recentRequests.unshift(logEntry);
    if (this.recentRequests.length > this.maxRecent) {
      this.recentRequests.pop();
    }
  }

  getSummary(): MetricsSummary {
    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      averageResponseTime: this.totalRequests === 0
        ? 0
        : Number((this.totalResponseTime / this.totalRequests).toFixed(2)),
    };
  }

  getRecentRequests(): RequestLogEntry[] {
    return [...this.recentRequests];
  }
}

export const metricsManager = new MetricsManager();
