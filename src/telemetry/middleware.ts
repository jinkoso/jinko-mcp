/**
 * Simplified telemetry middleware for MCP tool metrics collection
 */
import { MCPMetrics } from './metrics.js';

export interface ToolExecutionContext {
  toolName: string;
  params: any;
  startTime: number;
}

export class TelemetryMiddleware {
  private metrics: MCPMetrics;

  constructor(metrics: MCPMetrics) {
    this.metrics = metrics;
  }

  /**
   * Wrap a tool function with metrics collection
   */
  instrumentTool<T extends (...args: any[]) => Promise<any>>(
    toolName: string,
    toolFunction: T
  ): T {
    return (async (...args: any[]) => {
      const startTime = Date.now();

      try {
        const result = await toolFunction.apply(this, args);
        const duration = (Date.now() - startTime) / 1000;
        this.metrics.recordToolCall(toolName, duration, 'success');
        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        this.metrics.recordToolCall(toolName, duration, 'error');
        throw error;
      }
    }) as T;
  }

  /**
   * Create a tool execution context for manual instrumentation
   */
  createToolContext(toolName: string, params: any): ToolExecutionContext {
    return {
      toolName,
      params,
      startTime: Date.now(),
    };
  }

  /**
   * Complete a tool execution context
   */
  completeToolContext(context: ToolExecutionContext, result?: any, error?: Error): void {
    const duration = (Date.now() - context.startTime) / 1000;
    const status = error ? 'error' : 'success';
    this.metrics.recordToolCall(context.toolName, duration, status);
  }

  /**
   * Record API call metrics
   */
  recordApiCall(endpoint: string, method: string, duration: number, status: string): void {
    this.metrics.recordApiCall(endpoint, method, duration, status);
  }
}