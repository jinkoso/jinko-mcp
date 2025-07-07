/**
 * Unified telemetry middleware for MCP tool metrics collection
 */
import { UnifiedMetrics } from './unified-telemetry.js';

export interface ToolExecutionContext {
  toolName: string;
  params: any;
  startTime: number;
}

export class TelemetryMiddleware {
  private metrics: UnifiedMetrics;

  constructor(metrics: UnifiedMetrics) {
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
        const duration_ms = Date.now() - startTime;
        this.metrics.recordToolCall(toolName, duration_ms, 'success');
        return result;
      } catch (error) {
        const duration_ms = Date.now() - startTime;
        this.metrics.recordToolCall(toolName, duration_ms, 'error');
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
    const duration_ms = Date.now() - context.startTime;
    const status = error ? 'error' : 'success';
    this.metrics.recordToolCall(context.toolName, duration_ms, status);
  }

  /**
   * Record API call metrics
   */
  recordApiCall(endpoint: string, method: string, duration_ms: number, status: string): void {
    this.metrics.recordApiCall(endpoint, method, duration_ms, status);
  }

  /**
   * Record hotel search results count
   */
  recordHotelSearchResults(hotelCount: number): void {
    this.metrics.recordHotelSearchResults(hotelCount);
  }

  /**
   * Record hotel search call with detailed labels
   */
  recordHotelSearchCall(params: {
    location_name?: string;
    check_in_date: string;
    nights: number;
    total_travelers: number;
    status: string;
  }): void {
    this.metrics.recordHotelSearchCall(params);
  }
}