/**
 * Telemetry middleware for MCP tool instrumentation
 */
import { MCPInstrumentation } from './instrumentation.js';
import { MCPMetrics } from './metrics.js';
import { MCPLogger } from './logger.js';
import { Span } from '@opentelemetry/api';

export interface ToolExecutionContext {
  toolName: string;
  params: any;
  trackingId: string;
  span: Span;
  startTime: number;
}

export class TelemetryMiddleware {
  private instrumentation: MCPInstrumentation;
  private metrics: MCPMetrics;
  private logger: MCPLogger;

  constructor(instrumentation: MCPInstrumentation, metrics: MCPMetrics, logger: MCPLogger) {
    this.instrumentation = instrumentation;
    this.metrics = metrics;
    this.logger = logger;
  }

  /**
   * Wrap a tool function with telemetry instrumentation
   */
  instrumentTool<T extends (...args: any[]) => Promise<any>>(
    toolName: string,
    toolFunction: T
  ): T {
    return (async (...args: any[]) => {
      const startTime = Date.now();
      const trackingId = this.instrumentation.generateTrackingId();
      const span = this.instrumentation.createToolSpan(toolName, trackingId);
      
      // Add tool parameters to span
      span.setAttributes({
        'mcp.tool.params': JSON.stringify(this.sanitizeParams(args[0] || {})),
      });

      const context: ToolExecutionContext = {
        toolName,
        params: args[0] || {},
        trackingId,
        span,
        startTime,
      };

      this.logger.logToolCall(toolName, trackingId, context.params);

      try {
        const result = await this.instrumentation.withSpan(span, async () => {
          return await toolFunction.apply(this, args);
        });

        const duration = (Date.now() - startTime) / 1000;
        this.metrics.recordToolCall(toolName, duration, 'success', trackingId);
        this.logger.logToolResult(toolName, trackingId, duration, 'success');

        // Record business metrics based on tool type
        this.recordBusinessMetrics(toolName, context.params, result, trackingId);

        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        this.metrics.recordToolCall(toolName, duration, 'error', trackingId);
        this.logger.logToolResult(toolName, trackingId, duration, 'error');
        this.logger.logError(error as Error, { toolName, trackingId });
        throw error;
      }
    }) as T;
  }

  /**
   * Create a tool execution context for manual instrumentation
   */
  createToolContext(toolName: string, params: any): ToolExecutionContext {
    const startTime = Date.now();
    const trackingId = this.instrumentation.generateTrackingId();
    const span = this.instrumentation.createToolSpan(toolName, trackingId);
    
    // Add tool parameters to span
    span.setAttributes({
      'mcp.tool.params': JSON.stringify(this.sanitizeParams(params)),
    });

    return {
      toolName,
      params,
      trackingId,
      span,
      startTime,
    };
  }

  /**
   * Complete a tool execution context
   */
  completeToolContext(context: ToolExecutionContext, result?: any, error?: Error): void {
    const duration = (Date.now() - context.startTime) / 1000;
    const status = error ? 'error' : 'success';

    try {
      if (error) {
        context.span.recordException(error);
        this.logger.logError(error, { 
          toolName: context.toolName, 
          trackingId: context.trackingId 
        });
      }

      this.metrics.recordToolCall(context.toolName, duration, status, context.trackingId);
      this.logger.logToolResult(context.toolName, context.trackingId, duration, status);

      if (!error && result) {
        this.recordBusinessMetrics(context.toolName, context.params, result, context.trackingId);
      }
    } finally {
      context.span.end();
    }
  }

  /**
   * Record business-specific metrics based on tool type
   */
  private recordBusinessMetrics(toolName: string, params: any, result: any, trackingId: string): void {
    switch (toolName) {
      case 'search-hotels':
        this.metrics.recordHotelSearch('search', this.extractHotelCount(result), trackingId);
        break;
      case 'load-more-hotels':
        this.metrics.recordHotelSearch('load_more', this.extractHotelCount(result), trackingId);
        break;
      case 'book-hotel':
        this.metrics.recordHotelBooking(this.extractBookingStatus(result), trackingId);
        break;
      case 'find-place':
        this.metrics.recordPlaceAutocomplete(this.extractPlaceCount(result), trackingId);
        break;
      case 'get-facilities':
        this.metrics.recordFacilitiesRequest(params.language || 'en', trackingId);
        break;
    }
  }

  /**
   * Extract hotel count from search results
   */
  private extractHotelCount(result: any): number {
    try {
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        return data.hotels?.length || 0;
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return 0;
  }

  /**
   * Extract booking status from booking result
   */
  private extractBookingStatus(result: any): string {
    try {
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        return data.status || 'unknown';
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return 'unknown';
  }

  /**
   * Extract place count from autocomplete results
   */
  private extractPlaceCount(result: any): number {
    try {
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        return data.places?.length || 0;
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return 0;
  }

  /**
   * Sanitize sensitive parameters for telemetry
   */
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