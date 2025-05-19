/**
 * Main server setup for the hotel MCP server
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getFacilitiesByLanguage } from "../facilities.js";
import { getHotelDetails, loadMoreHotels, searchHotels } from "../tools/standard/search.js";
import { bookHotel } from "../tools/standard/booking.js";
import { autocompletePlaces } from "../tools/standard/places.js";

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
 * Find normalized place by user's input
 */
server.tool(
  "find-place",
  `If there isn't coordinate information, this tools can be used to 
find normalized place by user's input. The input can be a city name, hotel name, or other location names.
The result will be a list of places with their details and coordinates.
`,
{
  query: z.string().describe("User's input for place search"),
  language: z.string().optional().default("en").describe("Language for the place search"),
},
autocompletePlaces
);

/**
 * Search for available hotels
 */
server.tool(
  "search-hotels",
  `Search for available hotels based on latitude, longitude, dates, and other criteria,
returning a list of hotels with the details and all the available rooms and rates.
More hotels can be loaded with the next page token and load-more-hotels tool.
`,
  {
    latitude: z.number().describe("Latitude of the location"),
    longitude: z.number().describe("Longitude of the location"),
    check_in_date: z.string().default("2025-06-25").describe("Check-in date (YYYY-MM-DD)"),
    check_out_date: z.string().default("2025-06-26").describe("Check-out date (YYYY-MM-DD)"),
    adults: z.number().min(1).default(2).describe("Number of adults"),
    children: z.number().min(0).default(0).describe("Number of children"),
    facilities: z.array(z.number()).optional().describe(
      "Facility IDs to filter hotels by, the IDs can be inferred with facilities resource."
    ),
  },
  searchHotels
);

server.tool(
  "load-more-hotels",
  `Load more hotels based on the next page token got from previous query.
returning a list of hotels with the details and all the available rooms and rates.
More hotels can be loaded with the next page token and load-more-hotels tool.
`,
  {
    session_id: z.string().describe("Next page token to load more hotels"),
  },
  loadMoreHotels
)

/**
 * Get detailed information about a specific hotel by ID
 */
server.tool(
  "get-hotel-details",
  "Get detailed information about a specific hotel by ID, which are found by search-hotel method. This tools can be used to get more rates of a hotel that user is interested in.",
  {
    session_id: z.string().describe("The id of search session"),
    hotel_id: z.string().describe("ID of the hotel to get details for"),
  },
  getHotelDetails
);

server.tool(
  "book-hotel",
  `Book a hotel with chosen hotel's ID and chosen rate's id.
Before make the booking, all the rate of the chosen hotel should be present to the user,
and the user should choose one of them.
A checkout link will be returned to the user, which should be opened in a browser.
`,
  {
    session_id: z.string().describe("The id of search session"),
    hotel_id: z.string().describe("ID of the hotel to book"),
    rate_id: z.string().describe("ID of the rate to book"),
  },
  bookHotel,
);

// ========== Register Resources ==========
const supportedLanguages = ['en', 'es', 'it', 'he', 'ar', 'de'];

supportedLanguages.forEach(lang => {
  server.resource(
    `Hotel Facilities (${lang})`,
    `hotel://facilities/${lang}`,
    {
      description: `Hotel facilities translated to ${lang}`,
      mimeType: "application/json"
    },
    (uri) => getFacilitiesByLanguage(uri, lang)
  );
});

export async function get_server() {
  return server;
}
