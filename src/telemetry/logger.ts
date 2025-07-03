/**
 * Simplified structured logging for MCP server
 */

export interface LogContext {
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

  constructor(serviceName: string = 'mcp-server') {
    this.serviceName = serviceName;
  }

  private formatLogEntry(level: LogLevel, message: string, context: LogContext = {}): string {
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      ...context,
    };

    return JSON.stringify(logEntry);
  }

  error(message: string, context: LogContext = {}): void {
    process.stderr.write(this.formatLogEntry(LogLevel.ERROR, message, context) + '\n');
  }

  warn(message: string, context: LogContext = {}): void {
    process.stderr.write(this.formatLogEntry(LogLevel.WARN, message, context) + '\n');
  }

  info(message: string, context: LogContext = {}): void {
    process.stderr.write(this.formatLogEntry(LogLevel.INFO, message, context) + '\n');
  }

  debug(message: string, context: LogContext = {}): void {
    process.stderr.write(this.formatLogEntry(LogLevel.DEBUG, message, context) + '\n');
  }

  // Convenience methods for common MCP operations
  logToolCall(toolName: string, params: any, message: string = 'Tool called'): void {
    this.info(message, {
      operation: 'tool_call',
      toolName,
      params: this.sanitizeParams(params),
    });
  }

  logToolResult(toolName: string, duration: number, status: string, message: string = 'Tool completed'): void {
    this.info(message, {
      operation: 'tool_result',
      toolName,
      duration,
      status,
    });
  }

  logApiCall(endpoint: string, method: string, message: string = 'API call initiated'): void {
    this.info(message, {
      operation: 'api_call',
      endpoint,
      method,
    });
  }

  logApiResult(endpoint: string, method: string, duration: number, status: number, message: string = 'API call completed'): void {
    this.info(message, {
      operation: 'api_result',
      endpoint,
      method,
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
export function getLogger(serviceName?: string): MCPLogger {
  if (!globalLogger) {
    globalLogger = new MCPLogger(serviceName);
  }
  return globalLogger;
}

/**
 * Initialize logging - should be called early in the application lifecycle
 */
export function initializeLogging(serviceName?: string): MCPLogger {
  globalLogger = new MCPLogger(serviceName);
  return globalLogger;
}