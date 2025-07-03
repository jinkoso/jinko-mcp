/**
 * OpenTelemetry-integrated structured logging for MCP server
 */

import { logs } from '@opentelemetry/api-logs';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

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
  private otelLogger: any;
  private loggerProvider: LoggerProvider | null = null;

  constructor(serviceName: string = 'mcp-server') {
    this.serviceName = serviceName;
    this.initializeOTelLogging();
  }

  private initializeOTelLogging(): void {
    try {
      // Create resource with service information
      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.serviceName,
        [ATTR_SERVICE_VERSION]: '1.0.0',
      });

      // Create OTLP log exporter
      const logExporter = new OTLPLogExporter({
        url: 'https://log.api.jinko.so/v1/logs',
        headers: {},
      });

      // Create logger provider
      this.loggerProvider = new LoggerProvider({
        resource,
      });

      // Add the exporter to the provider
      this.loggerProvider.addLogRecordProcessor(
        new BatchLogRecordProcessor(logExporter)
      );

      // Register the provider
      logs.setGlobalLoggerProvider(this.loggerProvider);

      // Get the logger
      this.otelLogger = logs.getLogger(this.serviceName, '1.0.0');

      console.error(`OpenTelemetry Logs initialized successfully`);
      console.error(`Service: ${this.serviceName} Exporting to: https://log.api.jinko.so/v1/logs`);
    } catch (error) {
      console.error('Failed to initialize OpenTelemetry logging:', error);
      this.otelLogger = null;
    }
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

  private getSeverityNumber(level: LogLevel): number {
    switch (level) {
      case LogLevel.DEBUG: return 5;
      case LogLevel.INFO: return 9;
      case LogLevel.WARN: return 13;
      case LogLevel.ERROR: return 17;
      default: return 9;
    }
  }

  private emitOTelLog(level: LogLevel, message: string, context: LogContext = {}): void {
    if (!this.otelLogger) return;

    try {
      this.otelLogger.emit({
        severityNumber: this.getSeverityNumber(level),
        severityText: level.toUpperCase(),
        body: message,
        attributes: {
          'service.name': this.serviceName,
          ...context,
        },
      });
    } catch (error) {
      // Silently fail to avoid logging loops
    }
  }

  error(message: string, context: LogContext = {}): void {
    // Emit to both stderr (for local debugging) and OpenTelemetry
    process.stderr.write(this.formatLogEntry(LogLevel.ERROR, message, context) + '\n');
    this.emitOTelLog(LogLevel.ERROR, message, context);
  }

  warn(message: string, context: LogContext = {}): void {
    process.stderr.write(this.formatLogEntry(LogLevel.WARN, message, context) + '\n');
    this.emitOTelLog(LogLevel.WARN, message, context);
  }

  info(message: string, context: LogContext = {}): void {
    process.stderr.write(this.formatLogEntry(LogLevel.INFO, message, context) + '\n');
    this.emitOTelLog(LogLevel.INFO, message, context);
  }

  debug(message: string, context: LogContext = {}): void {
    process.stderr.write(this.formatLogEntry(LogLevel.DEBUG, message, context) + '\n');
    this.emitOTelLog(LogLevel.DEBUG, message, context);
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

  // Cleanup method for proper shutdown
  async shutdown(): Promise<void> {
    if (this.loggerProvider) {
      try {
        await this.loggerProvider.shutdown();
        console.error('OpenTelemetry logging shutdown completed');
      } catch (error) {
        console.error('Error during OpenTelemetry logging shutdown:', error);
      }
    }
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