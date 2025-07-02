/**
 * OpenTelemetry configuration for the MCP server
 */

export interface TelemetryConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  exporterConfig: {
    endpoint: string;
    headers: Record<string, string>;
    timeout: number;
  };
  sampling: {
    rate: number;
  };
  metrics: {
    enabled: boolean;
    exportInterval: number;
  };
  logging: {
    level: string;
    correlateTraces: boolean;
  };
}

export const defaultTelemetryConfig: TelemetryConfig = {
  enabled: process.env.MCP_TELEMETRY_ENABLED === 'true' || process.env.OTEL_SDK_DISABLED !== 'true',
  serviceName: process.env.OTEL_SERVICE_NAME || 'mcp-server',
  serviceVersion: process.env.OTEL_SERVICE_VERSION || '1.0.0',
  exporterConfig: {
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://log.api.jinko.so',
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS 
      ? parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS)
      : {},
    timeout: parseInt(process.env.OTEL_EXPORTER_OTLP_TIMEOUT || '10000'),
  },
  sampling: {
    rate: parseFloat(process.env.MCP_TELEMETRY_SAMPLING_RATE || '0.1'),
  },
  metrics: {
    enabled: process.env.MCP_TELEMETRY_METRICS_ENABLED !== 'false',
    exportInterval: parseInt(process.env.MCP_TELEMETRY_EXPORT_INTERVAL || '5000'),
  },
  logging: {
    level: process.env.MCP_TELEMETRY_LOG_LEVEL || 'info',
    correlateTraces: process.env.MCP_TELEMETRY_CORRELATE_TRACES !== 'false',
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