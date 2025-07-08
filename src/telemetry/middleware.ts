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
   * Wrap a tool function with metrics collection including latency
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
        await this.metrics.recordToolCallWithLatency(toolName, duration_ms, 'success');
        return result;
      } catch (error) {
        const duration_ms = Date.now() - startTime;
        await this.metrics.recordToolCallWithLatency(toolName, duration_ms, 'error');
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
   * Complete a tool execution context with latency tracking
   */
  async completeToolContext(context: ToolExecutionContext, result?: any, error?: Error): Promise<void> {
    const duration_ms = Date.now() - context.startTime;
    const status = error ? 'error' : 'success';
    await this.metrics.recordToolCallWithLatency(context.toolName, duration_ms, status);
  }

  /**
   * Record API call metrics with latency
   */
  async recordApiCall(endpoint: string, method: string, duration_ms: number, statusCode: number): Promise<void> {
    await this.metrics.recordApiCallWithLatency(endpoint, method, duration_ms, statusCode);
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

  /**
   * Instrument a fetch call with automatic telemetry
   */
  async instrumentedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const method = options.method || 'GET';
    const startTime = Date.now();

    try {
      const response = await fetch(url, options);
      const duration_ms = Date.now() - startTime;
      await this.recordApiCall(url, method, duration_ms, response.status);
      return response;
    } catch (error) {
      const duration_ms = Date.now() - startTime;
      await this.recordApiCall(url, method, duration_ms, 0); // 0 for network errors
      throw error;
    }
  }
}