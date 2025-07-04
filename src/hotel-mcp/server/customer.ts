/**
 * Main server setup for the hotel MCP server
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Import tool implementations
import { createSession } from "../tools/customer/places.js";
import { searchHotels, getHotelDetails } from "../tools/customer/search.js";
import { bookHotel } from "../tools/customer/booking.js";
import { initializeTelemetryMiddleware, initializeLogging } from "../../telemetry/index.js";

// // Import resource handlers
// import { getFacilitiesResource } from "./resources.js";

// // Import utilities
// import { loadFacilitiesData } from "./utils.js";

// ========== Server Setup ==========
// // Load facilities data
// const facilitiesData = loadFacilitiesData();

// Initialize telemetry
const logger = initializeLogging('hotel-booking-mcp-customer');
const telemetryMiddleware = initializeTelemetryMiddleware();

// Create server instance
const server = new McpServer({
  name: "hotel-booking-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {
      list: true,
      read: true,
    },
    tools: {},
  },
});

// ========== Register Tools ==========
/**
 * Create a new session and normalize place for hotel search
 */
server.tool(
  "create-session",
  "Create a new booking session and normalize place for hotel search",
  {
    place: z.string().describe("Location where user wants to search for hotels (e.g., 'New York', 'Paris', 'Tokyo')"),
    raw_request: z.string().optional().describe("Summary of user's requirements in free text"),
    language: z.string().optional().describe("The language used by user, the language value should follow ISO 639, like en, fr, zh etc."),
    currency: z.string().optional().describe("Currency code (e.g., 'EUR', 'USD')"),
    country_code: z.string().optional().describe("Country code (e.g., 'fr', 'us')"),
  },
  telemetryMiddleware.instrumentTool("create-session", createSession)
);

// /**
//  * Get place suggestions based on user input
//  */
// server.tool(
//   "autocomplete-place",
//   "Get place suggestions based on user input",
//   {
//     query: z.string().describe("User's input for place search (e.g., 'New York', 'Paris', 'Tokyo')"),
//     language: z.string().optional().describe("The language used by user."),
//   },
//   autocompletePlaces
// );

// /**
//  * Confirm a place from the suggestions for hotel search
//  */
// server.tool(
//   "confirm-place",
//   "Confirm a place from the suggestions for hotel search",
//   {
//     place_id: z.string().describe("ID of the place to confirm from the suggestions"),
//   },
//   confirmPlace
// );

/**
 * Search for available hotels
 */
server.tool(
  "search-hotels",
  "Search for available hotels based on location, dates, and other criteria, returning a list of hotels with the details, such as the lowest price.",
  {
    place_id: z.string().optional().describe("Optional place ID to override the default selected place"),
    check_in_date: z.string().default("2025-06-25").describe("Check-in date (YYYY-MM-DD)"),
    check_out_date: z.string().default("2025-06-26").describe("Check-out date (YYYY-MM-DD)"),
    adults: z.number().min(1).default(2).describe("Number of adults"),
    children: z.number().min(0).default(0).describe("Number of children"),
    facilities: z.array(z.number()).optional().describe(
      "Facility IDs to filter hotels by, the IDs can be inferred with facilities resource."
    ),
  },
  telemetryMiddleware.instrumentTool("search-hotels", searchHotels)
);

/**
 * Get detailed information about a specific hotel by ID
 */
server.tool(
  "get-hotel-details",
  "Get detailed information about a specific hotel by ID, which are found by search-hotel method. This tools can be used to get more rates of a hotel that user is interested in.",
  {
    hotel_id: z.string().describe("ID of the hotel to get details for"),
  },
  telemetryMiddleware.instrumentTool("get-hotel-details", getHotelDetails)
);

/**
 * Book a hotel by creating a quote and returning payment link
 */
server.tool(
  "book-hotel",
  "Book a hotel by creating a quote and returning payment link",
  {
    hotel_id: z.string().describe("ID of the hotel to book"),
    rate_id: z.string().describe("ID of the room to book"),
  },
  telemetryMiddleware.instrumentTool("book-hotel", bookHotel)
);

// // ========== Register Resources ==========
// /**
//  * Register facilities as resources
//  * This exposes the facilities.json data as a resource in the MCP server
//  */
// server.resource(
//   "Hotel Facilities",
//   "hotel:///facilities",
//   {
//     description: "List of all available hotel facilities with translations",
//     mimeType: "application/json"
//   },
//   getFacilitiesResource
// );

export async function get_server() {
  return server;
}
