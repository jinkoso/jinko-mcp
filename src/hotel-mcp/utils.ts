/**
 * Utility functions for the hotel MCP server
 */
import fs from "fs";
import yaml from "js-yaml";
import { API_BASE_URL, FACILITIES_PATH, MAX_QUOTE_POLL_ATTEMPTS, QUOTE_POLL_INTERVAL_MS } from "./config.js";
import { session } from "./state.js";

/**
 * Load facilities data from JSON file
 * @returns Array of facility objects
 */
export function loadFacilitiesData(): any[] {
  try {
    if (fs.existsSync(FACILITIES_PATH)) {
      const data = fs.readFileSync(FACILITIES_PATH, "utf-8");
      return JSON.parse(data);
    } else {
      console.warn("facilities.json not found at:", FACILITIES_PATH);
    }
  } catch (error) {
    console.error("Error loading facilities data:", error);
  }
  return []; // Return empty array on error or if file not found
}

/**
 * Make API request to the travel BFF API
 * @param endpoint API endpoint path
 * @param method HTTP method
 * @param body Request body (optional)
 * @returns Response data or null on error
 */
export async function makeApiRequest<T>(
  endpoint: string,
  method: string = "GET",
  body?: any
): Promise<T | null> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  
  // Add context information to headers if available in session
  if (session.conversation_id) {
    headers["X-Conversation-ID"] = session.conversation_id;
  }
  if (session.market) {
    headers["X-Market"] = session.market;
  }
  if (session.language) {
    headers["X-Language"] = session.language;
  }
  if (session.currency) {
    headers["X-Currency"] = session.currency;
  }
  if (session.country_code) {
    headers["X-Country-Code"] = session.country_code;
  }

  try {
    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Error making API request to ${endpoint}:`, error);
    return null;
  }
}

/**
 * Create a YAML response for MCP tools
 * @param data Object to convert to YAML
 * @returns MCP response object with YAML content
 */
export function createYamlResponse(data: any): { [x: string]: unknown; content: { type: "text"; text: string; }[] } {
  const yamlString = yaml.dump(data, {
    indent: 2,
    lineWidth: -1, // Don't wrap lines
    noRefs: true,   // Don't use references
  });

  return {
    content: [
      {
        type: "text" as const,
        text: yamlString,
      },
    ],
  };
}

/**
 * Create a JSON response for MCP tools
 * @param data Object to include in JSON
 * @returns MCP response object with JSON content
 */
export function createJsonResponse(data: any): { [x: string]: unknown; content: { type: "text"; text: string; }[] } {
  const jsonString = JSON.stringify(data, null);
  return {
    content: [
      {
        type: "text" as const,
        text: jsonString,
      },
    ],
  };
}

/**
 * Poll for quote status until it's ready or times out
 * @param quoteId ID of the quote to poll for
 * @returns Quote result or null if still processing
 */
export async function pollForQuoteStatus(quoteId: string): Promise<any | null> {
  let quoteStatus = "processing";
  let quoteResult = null;
  let attempts = 0;

  while (quoteStatus === "processing" && attempts < MAX_QUOTE_POLL_ATTEMPTS) {
    attempts++;

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, QUOTE_POLL_INTERVAL_MS));

    // Poll quote status
    const pullResponse = await makeApiRequest<any>(
      `/api/v1/booking/quote/pull/${quoteId}`,
      "GET"
    );

    if (!pullResponse) {
      continue;
    }

    quoteStatus = pullResponse.status;
    if (quoteStatus === "success") {
      quoteResult = pullResponse.quote;
      break;
    } else if (quoteStatus === "failed") {
      throw new Error(`Quote generation failed: ${pullResponse.error || "Unknown error"}`);
    }
  }

  return quoteResult;
}