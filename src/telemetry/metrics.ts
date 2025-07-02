/**
 * Custom metrics collection for MCP server
 */
import { Meter, Counter, Histogram, Gauge } from '@opentelemetry/api';

export class MCPMetrics {
  private meter: Meter;
  
  // Request metrics
  private requestCounter!: Counter;
  private requestDuration!: Histogram;
  private requestSize!: Histogram;
  private responseSize!: Histogram;
  
  // Tool metrics
  private toolCallCounter!: Counter;
  private toolDuration!: Histogram;
  private toolErrorCounter!: Counter;
  
  // API metrics
  private apiCallCounter!: Counter;
  private apiDuration!: Histogram;
  private apiErrorCounter!: Counter;
  
  // Connection metrics
  private activeConnections!: Gauge;
  private connectionDuration!: Histogram;
  private connectionErrorCounter!: Counter;
  
  // Business metrics
  private hotelSearchCounter!: Counter;
  private hotelBookingCounter!: Counter;
  private placeAutocompleteCounter!: Counter;
  private facilitiesRequestCounter!: Counter;

  constructor(meter: Meter) {
    this.meter = meter;
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Request metrics
    this.requestCounter = this.meter.createCounter('mcp_requests_total', {
      description: 'Total number of MCP requests',
    });

    this.requestDuration = this.meter.createHistogram('mcp_request_duration_seconds', {
      description: 'Duration of MCP requests in seconds',
      unit: 's',
    });

    this.requestSize = this.meter.createHistogram('mcp_request_size_bytes', {
      description: 'Size of MCP requests in bytes',
      unit: 'By',
    });

    this.responseSize = this.meter.createHistogram('mcp_response_size_bytes', {
      description: 'Size of MCP responses in bytes',
      unit: 'By',
    });

    // Tool metrics
    this.toolCallCounter = this.meter.createCounter('mcp_tool_calls_total', {
      description: 'Total number of tool calls',
    });

    this.toolDuration = this.meter.createHistogram('mcp_tool_duration_seconds', {
      description: 'Duration of tool executions in seconds',
      unit: 's',
    });

    this.toolErrorCounter = this.meter.createCounter('mcp_tool_errors_total', {
      description: 'Total number of tool execution errors',
    });

    // API metrics
    this.apiCallCounter = this.meter.createCounter('mcp_api_calls_total', {
      description: 'Total number of backend API calls',
    });

    this.apiDuration = this.meter.createHistogram('mcp_api_duration_seconds', {
      description: 'Duration of backend API calls in seconds',
      unit: 's',
    });

    this.apiErrorCounter = this.meter.createCounter('mcp_api_errors_total', {
      description: 'Total number of backend API errors',
    });

    // Connection metrics
    this.activeConnections = this.meter.createGauge('mcp_active_connections', {
      description: 'Number of active MCP connections',
    });

    this.connectionDuration = this.meter.createHistogram('mcp_connection_duration_seconds', {
      description: 'Duration of MCP connections in seconds',
      unit: 's',
    });

    this.connectionErrorCounter = this.meter.createCounter('mcp_connection_errors_total', {
      description: 'Total number of connection errors',
    });

    // Business metrics
    this.hotelSearchCounter = this.meter.createCounter('mcp_hotel_searches_total', {
      description: 'Total number of hotel search operations',
    });

    this.hotelBookingCounter = this.meter.createCounter('mcp_hotel_bookings_total', {
      description: 'Total number of hotel booking operations',
    });

    this.placeAutocompleteCounter = this.meter.createCounter('mcp_place_autocomplete_total', {
      description: 'Total number of place autocomplete operations',
    });

    this.facilitiesRequestCounter = this.meter.createCounter('mcp_facilities_requests_total', {
      description: 'Total number of facilities requests',
    });
  }

  // Request metrics methods
  recordRequest(method: string, duration: number, status: string, requestSize?: number, responseSize?: number): void {
    const labels = { method, status };
    
    this.requestCounter.add(1, labels);
    this.requestDuration.record(duration, labels);
    
    if (requestSize !== undefined) {
      this.requestSize.record(requestSize, labels);
    }
    
    if (responseSize !== undefined) {
      this.responseSize.record(responseSize, labels);
    }
  }

  // Tool metrics methods
  recordToolCall(toolName: string, duration: number, status: string, trackingId?: string): void {
    const labels = { tool_name: toolName, status, tracking_id: trackingId || 'unknown' };
    
    this.toolCallCounter.add(1, labels);
    this.toolDuration.record(duration, labels);
    
    if (status === 'error') {
      this.toolErrorCounter.add(1, labels);
    }
  }

  // API metrics methods
  recordApiCall(endpoint: string, method: string, duration: number, status: string, trackingId?: string): void {
    const labels = { 
      endpoint: this.sanitizeEndpoint(endpoint), 
      method, 
      status, 
      tracking_id: trackingId || 'unknown' 
    };
    
    this.apiCallCounter.add(1, labels);
    this.apiDuration.record(duration, labels);
    
    if (status === 'error') {
      this.apiErrorCounter.add(1, labels);
    }
  }

  // Connection metrics methods
  recordConnection(action: 'connect' | 'disconnect', duration?: number): void {
    if (action === 'connect') {
      this.activeConnections.record(1);
    } else {
      this.activeConnections.record(-1);
      if (duration !== undefined) {
        this.connectionDuration.record(duration, { action });
      }
    }
  }

  recordConnectionError(errorType: string): void {
    this.connectionErrorCounter.add(1, { error_type: errorType });
  }

  // Business metrics methods
  recordHotelSearch(searchType: string, resultCount: number, trackingId?: string): void {
    this.hotelSearchCounter.add(1, { 
      search_type: searchType, 
      tracking_id: trackingId || 'unknown' 
    });
  }

  recordHotelBooking(bookingStatus: string, trackingId?: string): void {
    this.hotelBookingCounter.add(1, { 
      status: bookingStatus, 
      tracking_id: trackingId || 'unknown' 
    });
  }

  recordPlaceAutocomplete(resultCount: number, trackingId?: string): void {
    this.placeAutocompleteCounter.add(1, { 
      tracking_id: trackingId || 'unknown' 
    });
  }

  recordFacilitiesRequest(language: string, trackingId?: string): void {
    this.facilitiesRequestCounter.add(1, { 
      language, 
      tracking_id: trackingId || 'unknown' 
    });
  }

  // Utility methods
  private sanitizeEndpoint(endpoint: string): string {
    // Remove dynamic parts from endpoint for better metric grouping
    return endpoint
      .replace(/\/\d+/g, '/{id}')
      .replace(/\/[a-f0-9-]{36}/g, '/{uuid}')
      .replace(/\/[a-f0-9]{32}/g, '/{hash}');
  }

  // Get current active connections count
  getCurrentActiveConnections(): number {
    // This would need to be tracked separately in a real implementation
    return 0;
  }
}