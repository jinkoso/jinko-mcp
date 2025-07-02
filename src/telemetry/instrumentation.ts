/**
 * Simplified OpenTelemetry instrumentation setup for MCP server
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, metrics, context, SpanStatusCode, SpanKind, Span, Tracer, Meter } from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';
import { TelemetryConfig, defaultTelemetryConfig } from './config.js';

export class MCPInstrumentation {
  private sdk: NodeSDK | null = null;
  private tracer: Tracer;
  private meter: Meter;
  private config: TelemetryConfig;

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...defaultTelemetryConfig, ...config };
    
    // Initialize basic tracer and meter first
    this.tracer = trace.getTracer(this.config.serviceName, this.config.serviceVersion);
    this.meter = metrics.getMeter(this.config.serviceName, this.config.serviceVersion);
    
    if (this.config.enabled) {
      this.initializeSDK();
    }
  }

  private initializeSDK(): void {
    try {
      this.sdk = new NodeSDK({
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': {
              enabled: false,
            },
          }),
        ],
      });

      this.sdk.start();
      console.log('OpenTelemetry SDK initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenTelemetry SDK:', error);
    }
  }

  getTracer(): Tracer {
    return this.tracer;
  }

  getMeter(): Meter {
    return this.meter;
  }

  createSpan(name: string, kind: SpanKind = SpanKind.INTERNAL): Span {
    return this.tracer.startSpan(name, { kind });
  }

  createToolSpan(toolName: string, trackingId: string): Span {
    const span = this.tracer.startSpan(`tool.${toolName}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'mcp.tool.name': toolName,
        'mcp.tracking_id': trackingId,
        'mcp.operation': 'tool_call',
      },
    });
    return span;
  }

  createApiSpan(endpoint: string, method: string, trackingId: string): Span {
    const span = this.tracer.startSpan(`api.${method.toLowerCase()}.${endpoint}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'http.method': method,
        'http.url': endpoint,
        'mcp.tracking_id': trackingId,
        'mcp.operation': 'api_call',
      },
    });
    return span;
  }

  async withSpan<T>(span: Span, fn: () => Promise<T>): Promise<T> {
    return context.with(trace.setSpan(context.active(), span), fn);
  }

  setSpanError(span: Span, error: Error): void {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }

  setSpanSuccess(span: Span): void {
    span.setStatus({ code: SpanStatusCode.OK });
  }

  generateTrackingId(): string {
    return uuidv4();
  }

  getCurrentTrackingId(): string | undefined {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      return activeSpan.spanContext().traceId;
    }
    return undefined;
  }

  shutdown(): Promise<void> {
    if (this.sdk) {
      return this.sdk.shutdown();
    }
    return Promise.resolve();
  }
}

// Global instance
let instrumentationInstance: MCPInstrumentation | null = null;

export function initializeInstrumentation(config?: Partial<TelemetryConfig>): MCPInstrumentation {
  if (!instrumentationInstance) {
    instrumentationInstance = new MCPInstrumentation(config);
  }
  return instrumentationInstance;
}

export function getInstrumentation(): MCPInstrumentation {
  if (!instrumentationInstance) {
    instrumentationInstance = new MCPInstrumentation();
  }
  return instrumentationInstance;
}