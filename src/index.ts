#!/usr/bin/env node

// Initialize telemetry first, before any other imports
import { initializeTelemetry, getLogger } from './telemetry/index.js';

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Import the server instance from the hotel-mcp module
import { get_server as get_standard_server } from './hotel-mcp/server/standard.js';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVICE_NAME } from './version.js';

// Initialize telemetry and logging
const telemetry = initializeTelemetry();
const logger = getLogger();

// Main function should take an optional command line argument to choose the server type
async function main() {
  const serverType = process.argv[2] || "standard";
  const startTime = Date.now();
  
  try {
    await logger.info('Starting MCP server', { 
      operation: 'server_startup',
      serverType,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform
    });
    
    // Create stdio transport
    const transport = new StdioServerTransport();
    if (serverType !== "customer" && serverType !== "standard") {
      console.error("Invalid server type. Use 'customer' or 'standard'.");
      process.exit(1);
    }
    let server: McpServer | null = null;
    server = await get_standard_server();

    if (!server) {
      console.error("Failed to create server instance.");
      process.exit(1);
    }

    // Connect server to transport
    await server.connect(transport);
    
    const initializationTime = Date.now() - startTime;
    
    // Send server initialization telemetry to log collector
    await logger.info('MCP server initialized successfully', {
      operation: 'server_initialized',
      serverType,
      initializationTime,
      status: 'ready',
      transport: 'stdio',
      telemetryEnabled: process.env.OTEL_ENABLED === 'true',
      serviceName: SERVICE_NAME,
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'not_configured'
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error('Error starting server', { 
      operation: 'server_initialization_failed',
      error: errorMessage,
      serverType: process.argv[2] || 'standard'
    });
    
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

// Export the standard server for use in other modules
const server = get_standard_server();
export { server };
