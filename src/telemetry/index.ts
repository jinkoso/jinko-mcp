/**
 * Main telemetry module exports - Metrics only
 */
export { MCPInstrumentation, getInstrumentation, initializeInstrumentation } from './instrumentation.js';
export { MCPMetrics } from './metrics.js';
export { MCPLogger, getLogger, LogLevel, LogContext } from './logger.js';
export { TelemetryMiddleware, ToolExecutionContext } from './middleware.js';
export { TelemetryConfig, defaultTelemetryConfig } from './config.js';

// Import the classes for internal use
import { MCPInstrumentation, initializeInstrumentation } from './instrumentation.js';
import { MCPMetrics } from './metrics.js';
import { TelemetryMiddleware } from './middleware.js';

// Global telemetry middleware instance
let globalTelemetryMiddleware: TelemetryMiddleware | null = null;

export function initializeTelemetryMiddleware(): TelemetryMiddleware {
  if (!globalTelemetryMiddleware) {
    const instrumentation = initializeInstrumentation();
    const metrics = new MCPMetrics(instrumentation.getMeter());
    globalTelemetryMiddleware = new TelemetryMiddleware(metrics);
  }
  return globalTelemetryMiddleware;
}

export function getTelemetryMiddleware(): TelemetryMiddleware {
  if (!globalTelemetryMiddleware) {
    return initializeTelemetryMiddleware();
  }
  return globalTelemetryMiddleware;
}