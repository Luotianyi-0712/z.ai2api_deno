import { config } from "./config.ts";

export type TokenSource = "anonymous" | "backup";

export interface AuthTokenInfo {
  token: string;
  source: TokenSource;
  displayToken: string;
}

interface TokenStats {
  success: number;
  failure: number;
}

export interface BackupTokenStatus {
  token: string;
  success: number;
  failure: number;
}

function normalizeToken(token: string): string {
  return token.trim();
}

function maskToken(token: string): string {
  if (token.length <= 10) {
    return token;
  }
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

class BackupTokenManager {
  private tokens: string[] = [];
  private currentIndex = 0;
  private readonly stats: Map<string, TokenStats> = new Map();

  constructor(initialTokens: string) {
    this.setTokensFromString(initialTokens);
  }

  private updateConfigValue(): void {
    config.BACKUP_TOKEN = this.tokens.join(",");
  }

  private ensureStats(token: string): void {
    if (!this.stats.has(token)) {
      this.stats.set(token, { success: 0, failure: 0 });
    }
  }

  setTokensFromString(tokenString: string): void {
    const parsedTokens = tokenString
      .split(",")
      .map(normalizeToken)
      .filter(token => token.length > 0);

    this.tokens = parsedTokens;
    this.currentIndex = 0;

    for (const token of parsedTokens) {
      this.ensureStats(token);
    }

    this.updateConfigValue();
  }

  getTokens(): string[] {
    return [...this.tokens];
  }

  addToken(token: string): boolean {
    const normalized = normalizeToken(token);
    if (!normalized || this.tokens.includes(normalized)) {
      return false;
    }
    this.tokens.push(normalized);
    this.ensureStats(normalized);
    this.updateConfigValue();
    return true;
  }

  removeToken(token: string): boolean {
    const normalized = normalizeToken(token);
    const index = this.tokens.indexOf(normalized);
    if (index === -1) {
      return false;
    }

    this.tokens.splice(index, 1);

    if (this.tokens.length === 0) {
      this.currentIndex = 0;
    } else if (index <= this.currentIndex && this.currentIndex > 0) {
      this.currentIndex = (this.currentIndex - 1) % this.tokens.length;
    }

    this.stats.delete(normalized);
    this.updateConfigValue();
    return true;
  }

  getNextToken(): string | null {
    if (this.tokens.length === 0) {
      return null;
    }

    const token = this.tokens[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
    return token;
  }

  recordResult(token: string, success: boolean): void {
    const stats = this.stats.get(token);
    if (!stats) {
      return;
    }
    if (success) {
      stats.success += 1;
    } else {
      stats.failure += 1;
    }
  }

  getStatus(): BackupTokenStatus[] {
    return this.tokens.map(token => {
      const stats = this.stats.get(token) ?? { success: 0, failure: 0 };
      return {
        token,
        success: stats.success,
        failure: stats.failure,
      };
    });
  }

  getMaskedToken(token: string): string {
    return maskToken(token);
  }
}

export const backupTokenManager = new BackupTokenManager(config.BACKUP_TOKEN);

export function formatTokenDisplay(token: string, source: TokenSource): string {
  if (source === "anonymous") {
    return token;
  }
  return maskToken(token);
}
