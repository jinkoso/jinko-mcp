/**
 * Unified telemetry module exports
 * Single implementation that works in all environments
 */

import { 
  UnifiedInstrumentation, 
  UnifiedLogger, 
  UnifiedMetrics, 
  LogLevel 
} from './unified-telemetry.js';

export { 
  UnifiedInstrumentation, 
  UnifiedLogger, 
  UnifiedMetrics, 
  LogLevel 
};

export { TelemetryMiddleware } from './middleware.js';

// Configuration
export interface TelemetryConfig {
  endpoint?: string;
  serviceName?: string;
  serviceVersion?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

// Default configuration from environment
export const defaultTelemetryConfig: TelemetryConfig = {
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://log.api.jinko.so',
  headers: process.env.OTEL_EXPORTER_OTLP_HEADERS 
    ? parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS)
    : {},
  timeout: parseInt(process.env.OTEL_EXPORTER_OTLP_TIMEOUT || '10000'),
};

function parseHeaders(headersString: string): Record<string, string> {
  const headers: Record<string, string> = {};
  headersString.split(',').forEach(header => {
    const [key, value] = header.split('=');
    if (key && value) {
      headers[key.trim()] = value.trim();
    }
  });
  return headers;
}

// Global telemetry instance
let globalInstrumentation: UnifiedInstrumentation | null = null;

export function initializeTelemetry(config: TelemetryConfig = {}): UnifiedInstrumentation {
  if (!globalInstrumentation) {
    const finalConfig = { ...defaultTelemetryConfig, ...config };
    globalInstrumentation = new UnifiedInstrumentation(finalConfig);
  }
  return globalInstrumentation;
}

export function getTelemetry(): UnifiedInstrumentation {
  if (!globalInstrumentation) {
    return initializeTelemetry();
  }
  return globalInstrumentation;
}

export function getLogger(): UnifiedLogger {
  return getTelemetry().getLogger();
}

export function getMetrics(): UnifiedMetrics {
  return getTelemetry().getMetrics();
}