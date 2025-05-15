/**
 * Main server setup for the hotel MCP server
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getFacilitiesByLanguage } from "../facilities.js";
import { loadMoreHotels, searchHotels } from "../tools/standard/search.js";
import { bookHotel } from "../tools/customer/booking.js";

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
 * Search for available hotels
 */
server.tool(
  "search-hotels",
  `Search for available hotels based on latitude, longitude, dates, and other criteria,
returning a list of hotels with the details, such as the lowest rate.
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
  "Load more hotels based on the next page token got from the previous search.",
  {
    next_page_token: z.string().describe("Next page token to load more hotels"),
  },
  loadMoreHotels
)

server.tool(
  "book-hotel",
  `Book a hotel with chosen hotel's ID and chosen rate's id.
  A checkout link will be returned to the user, which should be opened in a browser.
`,
  {
    hotel_id: z.string().describe("ID of the hotel to book"),
    rate_id: z.string().describe("ID of the room to book"),
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
