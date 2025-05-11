/**
 * Resource handlers for the hotel MCP server
 */
import { loadFacilitiesData, createYamlResponse } from "./utils.js";

/**
 * Get facilities resource
 */
export async function getFacilitiesResource(uri: URL) {
  const facilitiesData = loadFacilitiesData();
  const yamlString = JSON.stringify(facilitiesData);
  
  return {
    contents: [
      {
        text: yamlString,
        uri: uri.toString(),
        mimeType: "application/json"
      }
    ]
  };
}