/**
 * Hotel booking tools for the hotel MCP server
 */
import { createJsonResponse } from "../../utils.js";

/**
 * Book a hotel by creating a quote and returning payment link
 */
export async function bookHotel(params: { hotel_id: string; rate_id: string }) {
  

  return createJsonResponse({
    status: "error",});
}