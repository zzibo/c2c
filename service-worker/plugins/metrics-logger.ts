/**
 * Metrics Logger Plugin
 *
 * Collects SW performance metrics and syncs to analytics.
 * Integrates with existing /api/analytics/sw-logs endpoint.
 */

export interface MetricsData {
  cacheHits: number;
  cacheMisses: number;
  networkRequests: number;
  networkFailures: number;
  evictions: number;
  uptime: number;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  metadata?: Record<string, any>;
}

export class MetricsLogger {
  private metrics: MetricsData;
  private logs: LogEntry[];
  private startTime: number;
  private maxLogs: number;
  private logLevel: 'debug' | 'info' | 'warn' | 'error';
  private flushInterval: number;

  constructor(options: {
    maxLogs?: number;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    flushIntervalMs?: number;
  } = {}) {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      networkRequests: 0,
      networkFailures: 0,
      evictions: 0,
      uptime: 0,
    };
    this.logs = [];
    this.startTime = Date.now();
    this.maxLogs = options.maxLogs || 100;
    this.logLevel = options.logLevel || 'info';
    this.flushInterval = options.flushIntervalMs || 60000; // 1 minute

    // Auto-flush periodically
    this.startAutoFlush();
  }

  private shouldLog(level: string): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  private addLog(
    level: 'debug' | 'info' | 'warn' | 'error',
    category: string,
    message: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      metadata,
    };

    this.logs.push(entry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console log for development
    const emoji = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' };
    console.log(`${emoji[level]} [${category}] ${message}`, metadata || '');
  }

  debug(category: string, message: string, metadata?: Record<string, any>): void {
    this.addLog('debug', category, message, metadata);
  }

  info(category: string, message: string, metadata?: Record<string, any>): void {
    this.addLog('info', category, message, metadata);
  }

  warn(category: string, message: string, metadata?: Record<string, any>): void {
    this.addLog('warn', category, message, metadata);
  }

  error(category: string, message: string, metadata?: Record<string, any>): void {
    this.addLog('error', category, message, metadata);
  }

  recordCacheHit(url: string, hit: boolean): void {
    if (hit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
  }

  recordNetworkRequest(url: string, success: boolean, durationMs: number): void {
    this.metrics.networkRequests++;
    if (!success) {
      this.metrics.networkFailures++;
    }

    if (durationMs > 1000) {
      this.warn('PERFORMANCE', 'Slow network request', { url, duration: `${durationMs}ms` });
    }
  }

  recordEviction(url: string): void {
    this.metrics.evictions++;
    this.debug('CACHE', 'Entry evicted', { url });
  }

  getMetrics(): MetricsData {
    return {
      ...this.metrics,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  async flush(): Promise<void> {
    if (this.logs.length === 0) return;

    try {
      const payload = {
        metrics: this.getMetrics(),
        logs: this.logs,
        timestamp: new Date().toISOString(),
      };

      // Send to analytics endpoint
      const response = await fetch('/api/analytics/sw-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        this.info('METRICS', 'Flushed logs to analytics', {
          logCount: this.logs.length,
        });
        this.logs = []; // Clear logs after successful flush
      } else {
        this.warn('METRICS', 'Failed to flush logs', {
          status: response.status,
        });
      }
    } catch (error) {
      this.error('METRICS', 'Flush failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private startAutoFlush(): void {
    setInterval(() => {
      this.flush().catch(() => {
        // Silent fail - will retry on next interval
      });
    }, this.flushInterval);
  }

  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
    this.info('CONFIG', `Log level changed to: ${level}`);
  }
}

// Singleton instance
export const logger = new MetricsLogger({
  logLevel: 'info',
  flushIntervalMs: 60000, // 1 minute
});
