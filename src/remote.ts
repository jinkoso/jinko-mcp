// Update the import path to the correct location of McpAgent
import { McpAgent } from "agents/mcp";
import { get_sync_server } from './hotel-mcp/server/standard.js';


// Define our MCP agent with tools
export class JinkoMCP extends McpAgent {
	server = get_sync_server()

	async init() {}
}

type Env = Record<string, unknown>;

// Add a minimal ExecutionContext type if not available from a library
type ExecutionContext = {
	waitUntil(promise: Promise<any>): void;
	passThroughOnException?(): void;
};

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			// @ts-ignore
			return JinkoMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			// @ts-ignore
			return JinkoMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
