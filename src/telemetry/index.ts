/**
 * Main telemetry module exports
 */
export { MCPInstrumentation, getInstrumentation, initializeInstrumentation } from './instrumentation.js';
export { MCPMetrics } from './metrics.js';
export { MCPLogger, getLogger, initializeLogging, LogLevel, LogContext } from './logger.js';
export { TelemetryMiddleware, ToolExecutionContext } from './middleware.js';
export { TelemetryConfig, defaultTelemetryConfig } from './config.js';

// Re-export commonly used OpenTelemetry types
export { Span, SpanStatusCode, SpanKind } from '@opentelemetry/api';