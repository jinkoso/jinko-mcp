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
  conversation_id: "",
  user_ip_address: "127.0.0.1",
  market: "fr",
  currency: "EUR",
  country_code: "fr",
};