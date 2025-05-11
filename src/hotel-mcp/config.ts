/**
 * Configuration constants for the hotel MCP server
 */
import path from "path";

/**
 * Base URL for the travel BFF API
 */
export const API_BASE_URL = "https://api.dev.jinkotravel.com";

/**
 * Path to the facilities JSON file
 */
export const FACILITIES_PATH = path.resolve(process.cwd(), "facilities.json");

/**
 * Maximum number of attempts to poll for quote status
 */
export const MAX_QUOTE_POLL_ATTEMPTS = 30;

/**
 * Interval between quote status poll attempts in milliseconds
 */
export const QUOTE_POLL_INTERVAL_MS = 2000;

/**
 * Default market for the MCP server
 */
export const DEFAULT_MARKET = "fr";

/**
 * Default currency for the MCP server
 */
export const DEFAULT_CURRENCY = "EUR";

/**
 * Default country code for the MCP server
 */
export const DEFAULT_COUNTRY_CODE = "fr";