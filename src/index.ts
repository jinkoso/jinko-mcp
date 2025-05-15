#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Import the server instance from the hotel-mcp module
import { get_server as get_customer_server } from './hotel-mcp/server/customer.js';
import { get_server as get_standard_server } from './hotel-mcp/server/standard.js';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Main functio should take an optional command line argument to choose the server type
async function main() {
  try {
    // Create stdio transport
    const transport = new StdioServerTransport();
    const serverType = process.argv[2] || "standard";
    if (serverType !== "customer" && serverType !== "standard") {
      console.error("Invalid server type. Use 'customer' or 'standard'.");
      process.exit(1);
    }
    let server: McpServer | null = null;
    if (serverType === "customer") {
      // Create customer server instance
      server = await get_customer_server();
    }
    if (serverType === "standard") {
      // Create standard server instance
      server = await get_standard_server();
    }

    if (!server) {
      console.error("Failed to create server instance.");
      process.exit(1);
    }

    // Connect server to transport
    await server.connect(transport);
    
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
