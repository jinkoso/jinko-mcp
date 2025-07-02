/**
 * Structured logging with trace correlation for MCP server
 */
import { trace, context } from '@opentelemetry/api';

export interface LogContext {
  traceId?: string;
  spanId?: string;
  trackingId?: string;
  operation?: string;
  toolName?: string;
  endpoint?: string;
  method?: string;
  [key: string]: any;
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export class MCPLogger {
  private serviceName: string;
  private correlateTraces: boolean;

  constructor(serviceName: string = 'mcp-server', correlateTraces: boolean = true) {
    this.serviceName = serviceName;
    this.correlateTraces = correlateTraces;
  }

  private getTraceContext(): { traceId?: string; spanId?: string } {
    if (!this.correlateTraces) {
      return {};
    }

    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
      };
    }
    return {};
  }

  private formatLogEntry(level: LogLevel, message: string, context: LogContext = {}): string {
    const timestamp = new Date().toISOString();
    const traceContext = this.getTraceContext();
    
    const logEntry = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      ...traceContext,
      ...context,
    };

    return JSON.stringify(logEntry);
  }

  error(message: string, context: LogContext = {}): void {
    console.error(this.formatLogEntry(LogLevel.ERROR, message, context));
  }

  warn(message: string, context: LogContext = {}): void {
    console.warn(this.formatLogEntry(LogLevel.WARN, message, context));
  }

  info(message: string, context: LogContext = {}): void {
    console.info(this.formatLogEntry(LogLevel.INFO, message, context));
  }

  debug(message: string, context: LogContext = {}): void {
    console.debug(this.formatLogEntry(LogLevel.DEBUG, message, context));
  }

  // Convenience methods for common MCP operations
  logToolCall(toolName: string, trackingId: string, params: any, message: string = 'Tool called'): void {
    this.info(message, {
      operation: 'tool_call',
      toolName,
      trackingId,
      params: this.sanitizeParams(params),
    });
  }

  logToolResult(toolName: string, trackingId: string, duration: number, status: string, message: string = 'Tool completed'): void {
    this.info(message, {
      operation: 'tool_result',
      toolName,
      trackingId,
      duration,
      status,
    });
  }

  logApiCall(endpoint: string, method: string, trackingId: string, message: string = 'API call initiated'): void {
    this.info(message, {
      operation: 'api_call',
      endpoint,
      method,
      trackingId,
    });
  }

  logApiResult(endpoint: string, method: string, trackingId: string, duration: number, status: number, message: string = 'API call completed'): void {
    this.info(message, {
      operation: 'api_result',
      endpoint,
      method,
      trackingId,
      duration,
      status,
    });
  }

  logProtocolOperation(operation: string, details: any = {}, message: string = 'Protocol operation'): void {
    this.info(message, {
      operation: 'protocol',
      protocolOperation: operation,
      ...details,
    });
  }

  logError(error: Error, context: LogContext = {}): void {
    this.error(error.message, {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  }

  // Sanitize sensitive parameters for logging
  private sanitizeParams(params: any): any {
    if (!params || typeof params !== 'object') {
      return params;
    }

    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'authorization'];
    const sanitized = { ...params };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

// Global logger instance
let globalLogger: MCPLogger | null = null;

/**
 * Get or create the global logger instance
 */
export function getLogger(serviceName?: string, correlateTraces?: boolean): MCPLogger {
  if (!globalLogger) {
    globalLogger = new MCPLogger(serviceName, correlateTraces);
  }
  return globalLogger;
}

/**
 * Initialize logging - should be called early in the application lifecycle
 */
export function initializeLogging(serviceName?: string, correlateTraces?: boolean): MCPLogger {
  globalLogger = new MCPLogger(serviceName, correlateTraces);
  return globalLogger;
}