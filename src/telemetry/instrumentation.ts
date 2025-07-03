/**
 * OpenTelemetry metrics-only setup for MCP server with OTLP HTTP export
 */
import { metrics, Meter } from '@opentelemetry/api';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { TelemetryConfig, defaultTelemetryConfig } from './config.js';

export class MCPInstrumentation {
  private meterProvider: MeterProvider | null = null;
  private meter: Meter;
  private config: TelemetryConfig;

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...defaultTelemetryConfig, ...config };
    
    if (this.config.enabled && this.config.metrics.enabled) {
      this.initializeMetrics();
    }
    
    // Initialize meter (will use global provider if not initialized)
    this.meter = metrics.getMeter(this.config.serviceName, this.config.serviceVersion);
  }

  private initializeMetrics(): void {
    try {
      // Create resource
      const resource = resourceFromAttributes({
        [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
      });

      // Create OTLP metric exporter
      const metricExporter = new OTLPMetricExporter({
        url: `${this.config.exporterConfig.endpoint}/v1/metrics`,
        headers: this.config.exporterConfig.headers,
      });

      // Create metric reader
      const metricReader = new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: this.config.metrics.exportInterval,
      });

      // Create meter provider
      this.meterProvider = new MeterProvider({
        resource,
        readers: [metricReader],
      });

      // Set global meter provider
      metrics.setGlobalMeterProvider(this.meterProvider);

      process.stderr.write('OpenTelemetry Metrics initialized successfully\n');
      process.stderr.write(`Service: ${this.config.serviceName}\n`);
      process.stderr.write(`Exporting to: ${this.config.exporterConfig.endpoint}/v1/metrics\n`);
    } catch (error) {
      process.stderr.write(`Failed to initialize OpenTelemetry Metrics: ${error}\n`);
    }
  }

  getMeter(): Meter {
    return this.meter;
  }

  shutdown(): Promise<void> {
    if (this.meterProvider) {
      return this.meterProvider.shutdown();
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