/**
 * State management for the hotel MCP server
 */
import { SessionData } from "./types.js";

/**
 * Initialize session
 */
export const session: SessionData = {
  hotels: {},
  placeSuggestions: [],
  confirmedPlace: null,
  language: "en",
};