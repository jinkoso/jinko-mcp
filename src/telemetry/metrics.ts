/**
 * Simplified metrics collection for MCP server - Essential metrics only
 */
import { Meter, Counter, Histogram } from '@opentelemetry/api';

export class MCPMetrics {
  private meter: Meter;
  
  // Tool metrics - Required
  private toolCallCounter!: Counter;
  private toolDuration!: Histogram;
  
  // API metrics - Required  
  private apiCallCounter!: Counter;
  private apiDuration!: Histogram;

  constructor(meter: Meter) {
    this.meter = meter;
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Tool metrics - Usage count and latency
    this.toolCallCounter = this.meter.createCounter('mcp_tool_calls_total', {
      description: 'Total number of tool calls',
    });

    this.toolDuration = this.meter.createHistogram('mcp_tool_duration_seconds', {
      description: 'Duration of tool executions in seconds',
      unit: 's',
    });

    // Backend API metrics - Usage count and latency
    this.apiCallCounter = this.meter.createCounter('mcp_api_calls_total', {
      description: 'Total number of backend API calls',
    });

    this.apiDuration = this.meter.createHistogram('mcp_api_duration_seconds', {
      description: 'Duration of backend API calls in seconds',
      unit: 's',
    });
  }

  // Tool metrics methods - Usage count and latency
  recordToolCall(toolName: string, duration: number, status: string): void {
    const labels = { tool_name: toolName, status };
    
    this.toolCallCounter.add(1, labels);
    this.toolDuration.record(duration, labels);
  }

  // Backend API metrics methods - Usage count and latency
  recordApiCall(endpoint: string, method: string, duration: number, status: string): void {
    const labels = { 
      endpoint: this.sanitizeEndpoint(endpoint), 
      method, 
      status
    };
    
    this.apiCallCounter.add(1, labels);
    this.apiDuration.record(duration, labels);
  }

  // Utility methods
  private sanitizeEndpoint(endpoint: string): string {
    // Remove dynamic parts from endpoint for better metric grouping
    return endpoint
      .replace(/\/\d+/g, '/{id}')
      .replace(/\/[a-f0-9-]{36}/g, '/{uuid}')
      .replace(/\/[a-f0-9]{32}/g, '/{hash}');
  }
}