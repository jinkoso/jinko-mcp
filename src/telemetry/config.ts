/**
 * OpenTelemetry configuration for the MCP server - Metrics only
 */

import { VERSION, SERVICE_NAME } from '../version.js';

export interface TelemetryConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  exporterConfig: {
    endpoint: string;
    headers: Record<string, string>;
    timeout: number;
  };
  metrics: {
    enabled: boolean;
    exportInterval: number;
  };
}

export const defaultTelemetryConfig: TelemetryConfig = {
  enabled: process.env.OTEL_ENABLED === 'true' || process.env.MCP_TELEMETRY_ENABLED === 'true' || process.env.OTEL_SDK_DISABLED !== 'true',
  serviceName: process.env.OTEL_SERVICE_NAME || SERVICE_NAME,
  serviceVersion: process.env.OTEL_SERVICE_VERSION || VERSION,
  exporterConfig: {
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://log.api.jinko.so',
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS 
      ? parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS)
      : {},
    timeout: parseInt(process.env.OTEL_EXPORTER_OTLP_TIMEOUT || '10000'),
  },
  metrics: {
    enabled: process.env.MCP_TELEMETRY_METRICS_ENABLED !== 'false',
    exportInterval: parseInt(process.env.MCP_TELEMETRY_EXPORT_INTERVAL || '5000'),
  },
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