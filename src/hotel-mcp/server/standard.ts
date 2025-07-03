/**
 * Main server setup for the hotel MCP server
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getFacilitiesByLanguage } from "../facilities.js";
import { getHotelDetails, loadMoreHotels, searchHotels } from "../tools/standard/search.js";
import { bookHotel } from "../tools/standard/booking.js";
import { autocompletePlaces } from "../tools/standard/places.js";
import { initializeTelemetryMiddleware, initializeLogging } from "../../telemetry/index.js";


// Initialize telemetry
const logger = initializeLogging('hotel-booking-mcp');
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
 * Find normalized place by user's input
 */
server.tool(
  "find-place",
  `Use this tool to convert a user's location query into standardized place information with coordinates.
This is essential when you need latitude and longitude for hotel searches but only have a text description.
The tool accepts city names, hotel names, landmarks, or other location identifiers and returns a list of 
matching places with their details and precise coordinates.
`,
{
  query: z.string().describe("User's input for place search"),
  language: z.string().optional().default("en").describe("Language for the place search"),
},
telemetryMiddleware.instrumentTool("find-place", autocompletePlaces)
);

/**
 * Search for available hotels
 */
server.tool(
  "search-hotels",
  `Search for available hotels based on location coordinates and booking requirements.
This tool returns a paginated list of hotels with their key details including name, address, 
star rating, price range, and available room types. Each hotel includes summary information 
about amenities and available rates.

The results are limited to 50 hotels per request. If more results are available, you can 
retrieve them using the load-more-hotels tool with the returned session_id.
`,
  {
    latitude: z.number().describe("Latitude of the location"),
    longitude: z.number().describe("Longitude of the location"),
    check_in_date: z.string().default("2025-06-25").describe("Check-in date (YYYY-MM-DD)"),
    check_out_date: z.string().default("2025-06-26").describe("Check-out date (YYYY-MM-DD)"),
    adults: z.number().min(1).default(2).describe("Number of adults"),
    children: z.number().min(0).default(0).describe("Number of children"),
    search_context: z.string().optional().describe(
      "A summary of the search context which will be used by the server to better make the recommendation"),
    facilities: z.array(z.number()).optional().describe(
      "Facility IDs to filter hotels by, the IDs can be inferred with facilities resource."
    ),
  },
  telemetryMiddleware.instrumentTool("search-hotels", searchHotels)
);

server.tool(
  "load-more-hotels",
  `Retrieve additional hotel results from a previous search using the session_id.
This tool continues pagination from a previous search-hotels request, returning the next 
batch of hotels with the same format and details as the original search.

The response format matches search-hotels and includes information about whether 
further pagination is possible.
`,
  {
    session_id: z.string().describe("Session ID from a previous search-hotels or load-more-hotels response"),
  },
  telemetryMiddleware.instrumentTool("load-more-hotels", loadMoreHotels)
)

/**
 * Get detailed information about a specific hotel by ID
 */
server.tool(
  "get-hotel-details",
  `Retrieve comprehensive details about a specific hotel identified by its ID.
This tool provides more extensive information than what's available in search results,
including complete descriptions, all available room types, detailed rate information,
cancellation policies, and full amenity lists.

Use this tool when a user expresses interest in a specific hotel from search results
to provide them with all available options and complete booking information.
`,
  {
    session_id: z.string().describe("The session ID from a previous search"),
    hotel_id: z.string().describe("ID of the hotel to get details for"),
  },
  telemetryMiddleware.instrumentTool("get-hotel-details", getHotelDetails)
);

server.tool(
  "book-hotel",
  `Initiate a hotel booking process for a specific hotel and rate option.

IMPORTANT WORKFLOW:
1. Before calling this tool, you MUST present a specific hotel's all available rate options to the user using get-hotel-details
2. The user MUST select a specific rate option they want to book
3. This tool will generate a secure payment link that the user needs to open in their browser to complete the booking

The response includes a payment_link that must be prominently displayed to the user, along with
booking details such as hotel name, check-in/out dates, and total price.
`,
  {
    session_id: z.string().describe("The session ID from a previous search"),
    hotel_id: z.string().describe("ID of the hotel to book"),
    rate_id: z.string().describe("ID of the specific rate option the user has selected"),
  },
  telemetryMiddleware.instrumentTool("book-hotel", bookHotel),
);

/**
 * Get a list of hotel facilities in the specified language
 */
server.tool(
  "get-facilities",
  `IMPORTANT: ALWAYS USE THIS TOOL FIRST when a user mentions ANY specific hotel amenities or requirements.

This tool must be called BEFORE search-hotels whenever the user mentions requirements like:
- Pet-friendly or traveling with pets/dogs/cats
- WiFi or internet access
- Swimming pools
- Parking (free or paid)
- Air conditioning or heating
- Fitness center or gym
- Restaurant or room service
- Family rooms
- Non-smoking rooms
- Any other specific hotel features

The tool returns facility IDs that MUST be used with the search-hotels tool's facilities parameter
to properly filter hotels. Without using this tool first, searches will not correctly filter for 
user-requested amenities.

Example workflow:
1. User asks for "pet-friendly hotels in Paris"
2. Call get-facilities to find the facility_id for "Pets allowed"
3. Use that facility_id in the search-hotels facilities parameter
`,
  {
    language: z.string().default("en").describe("Language code for facility names (en, es, it, he, ar, de)"),
  },
  async (params) => {
    const lang = params.language || "en";
    // Create a mock URL for the getFacilitiesByLanguage function
    const uri = new URL(`hotel://facilities/${lang}`);
    const result = await getFacilitiesByLanguage(uri, lang);
    
    // Extract the facilities from the result
    let facilities = [];
    try {
      facilities = JSON.parse(result.contents[0].text);
    } catch (e) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: "Failed to parse facilities data"
          })
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          status: "success",
          facilities: facilities,
          message: `Retrieved ${facilities.length} hotel facilities in ${lang} language. 
IMPORTANT: You MUST identify the facility_id values that match the user's requirements and include them in the facilities parameter of the search-hotels tool. 
For example, if the user wants pet-friendly hotels, find the facility_id for "Pets allowed" in this list and include it in your search-hotels call.`
        })
      }]
    };
  }
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

export function get_sync_server() {
  return server;
}
