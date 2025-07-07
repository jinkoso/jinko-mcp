/**
 * Unified telemetry implementation using HTTP OTLP exports
 * Works in both Node.js and Cloudflare Workers environments
 */

import { VERSION_INFO } from '../version.js';

// OTLP Protocol Types
interface OTLPResource {
  attributes: Array<{ key: string; value: { stringValue?: string; intValue?: number } }>;
}

interface OTLPLogRecord {
  timeUnixNano: string;
  severityNumber: number;
  severityText: string;
  body: { stringValue: string };
  attributes: Array<{ key: string; value: { stringValue?: string; intValue?: number } }>;
}

interface OTLPMetricDataPoint {
  timeUnixNano: string;
  value: number;
  attributes: Array<{ key: string; value: { stringValue: string } }>;
}

interface OTLPMetric {
  name: string;
  description: string;
  unit?: string;
  sum?: {
    dataPoints: OTLPMetricDataPoint[];
    aggregationTemporality: number;
    isMonotonic: boolean;
  };
  histogram?: {
    dataPoints: Array<{
      timeUnixNano: string;
      count: string;
      sum: number;
      bucketCounts: string[];
      explicitBounds: number[];
      attributes: Array<{ key: string; value: { stringValue: string } }>;
    }>;
    aggregationTemporality: number;
  };
}

// Configuration
interface TelemetryConfig {
  endpoint: string;
  serviceName: string;
  serviceVersion: string;
  headers: Record<string, string>;
  timeout: number;
}

const defaultConfig: TelemetryConfig = {
  endpoint: 'https://log.api.jinko.so',
  serviceName: VERSION_INFO.name,
  serviceVersion: VERSION_INFO.version,
  headers: {},
  timeout: 10000,
};

// Log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

// Unified Logger
export class UnifiedLogger {
  private config: TelemetryConfig;
  private resource: OTLPResource;

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.resource = {
      attributes: [
        { key: 'service.name', value: { stringValue: this.config.serviceName } },
        { key: 'service.version', value: { stringValue: this.config.serviceVersion } },
        { key: 'telemetry.sdk.name', value: { stringValue: 'jinko-mcp-unified' } },
        { key: 'telemetry.sdk.version', value: { stringValue: this.config.serviceVersion } },
      ],
    };
  }

  private getSeverityNumber(level: LogLevel): number {
    switch (level) {
      case LogLevel.DEBUG: return 5;
      case LogLevel.INFO: return 9;
      case LogLevel.WARN: return 13;
      case LogLevel.ERROR: return 17;
      default: return 9;
    }
  }

  private createLogRecord(level: LogLevel, message: string, attributes: Record<string, any> = {}): OTLPLogRecord {
    const now = Date.now() * 1000000; // Convert to nanoseconds
    
    const otlpAttributes = Object.entries(attributes).map(([key, value]) => ({
      key,
      value: typeof value === 'string' 
        ? { stringValue: value }
        : { stringValue: String(value) }
    }));

    return {
      timeUnixNano: now.toString(),
      severityNumber: this.getSeverityNumber(level),
      severityText: level.toUpperCase(),
      body: { stringValue: message },
      attributes: otlpAttributes,
    };
  }

  private async sendLogs(logRecords: OTLPLogRecord[]): Promise<void> {
    const payload = {
      resourceLogs: [{
        resource: this.resource,
        scopeLogs: [{
          scope: {
            name: 'jinko-mcp-logger',
            version: this.config.serviceVersion,
          },
          logRecords,
        }],
      }],
    };

    try {
      const response = await fetch(`${this.config.endpoint}/v1/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Failed to send logs: ${response.status} ${response.statusText}`);
      } else {
        console.error(`Logs sent successfully: ${response.status}`);
      }
    } catch (error) {
      console.error('Error sending logs to OTLP collector:', error);
    }
  }

  async log(level: LogLevel, message: string, attributes: Record<string, any> = {}): Promise<void> {
    // Always log to console for immediate feedback
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      service: this.config.serviceName,
      version: this.config.serviceVersion,
      message,
      ...attributes,
    };

    // Send to OTLP collector
    const logRecord = this.createLogRecord(level, message, attributes);
    await this.sendLogs([logRecord]);
  }

  async debug(message: string, attributes: Record<string, any> = {}): Promise<void> {
    await this.log(LogLevel.DEBUG, message, attributes);
  }

  async info(message: string, attributes: Record<string, any> = {}): Promise<void> {
    await this.log(LogLevel.INFO, message, attributes);
  }

  async warn(message: string, attributes: Record<string, any> = {}): Promise<void> {
    await this.log(LogLevel.WARN, message, attributes);
  }

  async error(message: string, attributes: Record<string, any> = {}): Promise<void> {
    await this.log(LogLevel.ERROR, message, attributes);
  }

  // Convenience methods for MCP operations
  async logToolCall(toolName: string, params: any, message: string = 'Tool called'): Promise<void> {
    await this.info(message, {
      operation: 'tool_call',
      toolName,
      params: this.sanitizeParams(params),
    });
  }

  async logToolResult(toolName: string, duration: number, status: string, message: string = 'Tool completed'): Promise<void> {
    await this.info(message, {
      operation: 'tool_result',
      toolName,
      duration,
      status,
    });
  }

  async logApiCall(endpoint: string, method: string, message: string = 'API call started'): Promise<void> {
    await this.info(message, {
      operation: 'api_call_start',
      endpoint: this.sanitizeEndpoint(endpoint),
      method,
    });
  }

  async logApiResult(endpoint: string, method: string, duration: number, status: number, message?: string): Promise<void> {
    const logMessage = message || `API call completed: ${status}`;
    const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    
    await this.log(level, logMessage, {
      operation: 'api_call_result',
      endpoint: this.sanitizeEndpoint(endpoint),
      method,
      duration,
      status,
    });
  }

  async logError(error: Error, context: Record<string, any> = {}): Promise<void> {
    await this.error(error.message, {
      error_name: error.name,
      error_stack: error.stack,
      ...context,
    });
  }

  private sanitizeParams(params: any): any {
    if (!params) return {};
    
    const sanitized = { ...params };
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  private sanitizeEndpoint(endpoint: string): string {
    try {
      const url = new URL(endpoint);
      return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
      return endpoint.split('?')[0];
    }
  }
}

// Unified Metrics
export class UnifiedMetrics {
  private config: TelemetryConfig;
  private resource: OTLPResource;
  private counters: Map<string, { value: number; attributes: Record<string, string> }> = new Map();
  private histograms: Map<string, { values: number[]; attributes: Record<string, string> }> = new Map();

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.resource = {
      attributes: [
        { key: 'service.name', value: { stringValue: this.config.serviceName } },
        { key: 'service.version', value: { stringValue: this.config.serviceVersion } },
        { key: 'telemetry.sdk.name', value: { stringValue: 'jinko-mcp-unified' } },
        { key: 'telemetry.sdk.version', value: { stringValue: this.config.serviceVersion } },
      ],
    };

    // Start periodic export
    setInterval(() => this.exportMetrics(), 30000); // Export every 30 seconds
  }

  private createMetricKey(name: string, attributes: Record<string, string>): string {
    const attrStr = Object.entries(attributes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}|${attrStr}`;
  }

  incrementCounter(name: string, value: number = 1, attributes: Record<string, string> = {}): void {
    const key = this.createMetricKey(name, attributes);
    const existing = this.counters.get(key);
    
    if (existing) {
      existing.value += value;
    } else {
      this.counters.set(key, { value, attributes });
    }
  }

  recordHistogramValue(name: string, value: number, attributes: Record<string, string> = {}): void {
    const key = this.createMetricKey(name, attributes);
    const existing = this.histograms.get(key);
    
    if (existing) {
      existing.values.push(value);
    } else {
      this.histograms.set(key, { values: [value], attributes });
    }
  }

  private async exportMetrics(): Promise<void> {
    if (this.counters.size === 0 && this.histograms.size === 0) {
      return;
    }

    const metrics: OTLPMetric[] = [];
    const now = Date.now() * 1000000; // Convert to nanoseconds

    // Export counters
    const counterGroups = new Map<string, Array<{ key: string; data: { value: number; attributes: Record<string, string> } }>>();
    
    for (const [key, data] of this.counters.entries()) {
      const [name] = key.split('|');
      if (!counterGroups.has(name)) {
        counterGroups.set(name, []);
      }
      counterGroups.get(name)!.push({ key, data });
    }

    for (const [name, entries] of counterGroups.entries()) {
      const dataPoints: OTLPMetricDataPoint[] = entries.map(({ data }) => ({
        timeUnixNano: now.toString(),
        value: data.value,
        attributes: Object.entries(data.attributes).map(([k, v]) => ({
          key: k,
          value: { stringValue: v }
        })),
      }));

      metrics.push({
        name,
        description: `Counter metric: ${name}`,
        sum: {
          dataPoints,
          aggregationTemporality: 2, // Cumulative
          isMonotonic: true,
        },
      });
    }

    // Export histograms
    const histogramGroups = new Map<string, Array<{ key: string; data: { values: number[]; attributes: Record<string, string> } }>>();
    
    for (const [key, data] of this.histograms.entries()) {
      const [name] = key.split('|');
      if (!histogramGroups.has(name)) {
        histogramGroups.set(name, []);
      }
      histogramGroups.get(name)!.push({ key, data });
    }

    for (const [name, entries] of histogramGroups.entries()) {
      const dataPoints = entries.map(({ data }) => {
        const values = data.values;
        const count = values.length;
        const sum = values.reduce((a, b) => a + b, 0);
        
        // Simple bucket boundaries
        const bounds = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0];
        const bucketCounts = bounds.map(bound => 
          values.filter(v => v <= bound).length.toString()
        );
        bucketCounts.push(count.toString()); // +Inf bucket

        return {
          timeUnixNano: now.toString(),
          count: count.toString(),
          sum,
          bucketCounts,
          explicitBounds: bounds,
          attributes: Object.entries(data.attributes).map(([k, v]) => ({
            key: k,
            value: { stringValue: v }
          })),
        };
      });

      metrics.push({
        name,
        description: `Histogram metric: ${name}`,
        unit: name.includes('duration') ? 's' : undefined,
        histogram: {
          dataPoints,
          aggregationTemporality: 2, // Cumulative
        },
      });
    }

    // Send to OTLP collector
    const payload = {
      resourceMetrics: [{
        resource: this.resource,
        scopeMetrics: [{
          scope: {
            name: 'jinko-mcp-metrics',
            version: this.config.serviceVersion,
          },
          metrics,
        }],
      }],
    };

    try {
      const response = await fetch(`${this.config.endpoint}/v1/metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Failed to send metrics: ${response.status} ${response.statusText}`);
      } else {
        // Clear exported metrics
        this.counters.clear();
        this.histograms.clear();
      }
    } catch (error) {
      console.error('Error sending metrics to OTLP collector:', error);
    }
  }

  // Convenience methods for common metrics
  recordToolCall(toolName: string, duration: number, status: string): void {
    this.incrementCounter('mcp_tool_calls_total', 1, { tool_name: toolName, status });
    this.recordHistogramValue('mcp_tool_duration_seconds', duration, { tool_name: toolName, status });
  }

  // Async helper methods for OTLP export
  async recordCounter(name: string, value: number, attributes: Record<string, string> = {}): Promise<void> {
    this.incrementCounter(name, value, attributes);
    await this.exportMetrics();
  }

  async recordHistogram(name: string, value: number, attributes: Record<string, string> = {}): Promise<void> {
    this.recordHistogramValue(name, value, attributes);
    await this.exportMetrics();
  }

  private sanitizeEndpoint(endpoint: string): string {
    try {
      const url = new URL(endpoint);
      return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
      return endpoint.split('?')[0];
    }
  }

  // Hotel-specific metrics methods
  async recordHotelSearchCall(params: {
    location_name?: string;
    check_in_date: string;
    nights: number;
    total_travelers: number;
    status: string;
  }): Promise<void> {
    await this.recordCounter('hotel_search_calls_total', 1, {
      location: params.location_name || 'unknown',
      status: params.status
    });
    
    await this.recordHistogram('hotel_search_nights', params.nights, {
      location: params.location_name || 'unknown'
    });
    
    await this.recordHistogram('hotel_search_travelers', params.total_travelers, {
      location: params.location_name || 'unknown'
    });
  }

  async recordHotelSearchResults(count: number): Promise<void> {
    await this.recordHistogram('hotel_search_results_count', count);
    await this.recordCounter('hotel_search_results_total', count);
  }

  async recordApiCall(endpoint: string, method: string, duration: number, status: string): Promise<void> {
    await this.recordCounter('api_calls_total', 1, {
      endpoint: this.sanitizeEndpoint(endpoint),
      method,
      status
    });
    
    await this.recordHistogram('api_call_duration_ms', duration, {
      endpoint: this.sanitizeEndpoint(endpoint),
      method,
      status
    });
  }

  async shutdown(): Promise<void> {
    await this.exportMetrics();
  }
}

// Unified Instrumentation
export class UnifiedInstrumentation {
  private logger: UnifiedLogger;
  private metrics: UnifiedMetrics;

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.logger = new UnifiedLogger(config);
    this.metrics = new UnifiedMetrics(config);
    
  }

  getLogger(): UnifiedLogger {
    return this.logger;
  }

  getMetrics(): UnifiedMetrics {
    return this.metrics;
  }

  async shutdown(): Promise<void> {
    await this.metrics.shutdown();
  }
}