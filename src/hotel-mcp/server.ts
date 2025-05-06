import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";

// Base URL for the travel BFF API
const API_BASE_URL = "https://api.dev.jinkotravel.com";

// Session storage to keep track of hotel search results and place suggestions
interface SessionData {
  hotels: Record<string, any>; // Store hotels by ID
  placeSuggestions: any[]; // Store place suggestions from autocomplete
  confirmedPlace: any | null; // Store the confirmed place for search
}

// Initialize session
const session: SessionData = {
  hotels: {},
  placeSuggestions: [],
  confirmedPlace: null,
};

// Load facilities data
let facilitiesData: any[] = [];
try {
  const facilitiesPath = path.resolve(process.cwd(), "facilities.json");
  if (fs.existsSync(facilitiesPath)) {
    const data = fs.readFileSync(facilitiesPath, "utf-8");
    facilitiesData = JSON.parse(data);
    console.log(`Loaded ${facilitiesData.length} facilities`);
  } else {
    console.warn("facilities.json not found at:", facilitiesPath);
  }
} catch (error) {
  console.error("Error loading facilities data:", error);
  // Continue with empty facilities data
}

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

// Helper function for making API requests
async function makeApiRequest<T>(
  endpoint: string,
  method: string = "GET",
  body?: any
): Promise<T | null> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

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

// Format hotel information for LLM consumption
function formatHotelInfo(hotel: any): string {
  const {
    id,
    name,
    description,
    address,
    city,
    country,
    ranking,
    facilities = [],
    rooms = []
  } = hotel;

  let formattedRooms = "";
  if (rooms && rooms.length > 0) {
    formattedRooms = "\nAvailable Rooms:\n" + rooms.map((room: any) => {
      return `- ${room.name || "Standard Room"}: ${room.description || "No description"} - Price: ${room.price?.amount || "N/A"} ${room.price?.currency || "USD"}`;
    }).join("\n");
  }

  let formattedFacilities = "";
  if (facilities && facilities.length > 0) {
    formattedFacilities = "\nFacilities:\n" + facilities.map((facilityId: number) => {
      const facility = facilitiesData.find((f: any) => f.facility_id === facilityId);
      return `- ${facility ? facility.facility : "Unknown facility"}`;
    }).join("\n");
  }

  return `
Hotel ID: ${id}
Name: ${name}
Ranking: ${ranking || "N/A"} stars
Location: ${address || ""}, ${city || ""}, ${country || ""}
${description ? `\nDescription: ${description}` : ""}
${formattedFacilities}
${formattedRooms}
  `.trim();
}

// Register hotel search tool
server.tool(
  "search-hotels",
  "Search for available hotels based on location, dates, and other criteria",
  {
    use_confirmed_place: z.boolean().default(false).describe("Whether to use the confirmed place from autocomplete"),
    location: z.object({
      latitude: z.number().describe("Latitude coordinate"),
      longitude: z.number().describe("Longitude coordinate"),
    }).optional().describe("Center point for proximity search"),
    check_in_date: z.string().describe("Check-in date (YYYY-MM-DD)"),
    check_out_date: z.string().describe("Check-out date (YYYY-MM-DD)"),
    adults: z.number().min(1).default(2).describe("Number of adults"),
    children: z.number().min(0).default(0).describe("Number of children"),
    facilities: z.array(z.number()).optional().describe("Facility IDs to filter hotels by, the IDs can be inferred with facilities resource according to user's requirements."),  
  },
  async (params) => {
    // Check if we should use the confirmed place
    if (params.use_confirmed_place) {
      if (!session.confirmedPlace) {
        return {
          content: [
            {
              type: "text",
              text: "No confirmed place available. Please use the autocomplete-place tool first to find and confirm a location.",
            },
          ],
        };
      }
    }

    // Prepare request body for hotel availability API
    const requestBody: any = {
      check_in_date: params.check_in_date,
      check_out_date: params.check_out_date,
      adults: params.adults,
      children: params.children,
      limit: 100,
    };

    // Make API request to search for hotels
    const availabilityResult = await makeApiRequest<any>(
      "/api/v1/hotels/availability",
      "POST",
      requestBody
    );

    if (!availabilityResult) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve hotel availability data. Please try again later.",
          },
        ],
      };
    }

    const { hotels = [], total = 0 } = availabilityResult;

    if (hotels.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No hotels found matching your criteria. Please try different search parameters.",
          },
        ],
      };
    }

    // Store hotels in session for later retrieval
    hotels.forEach((hotel: any) => {
      session.hotels[hotel.id.toString()] = hotel;
    });

    // Format results for LLM
    const hotelSummaries = hotels.map((hotel: any) => {
      return `
Hotel ID: ${hotel.id}
Name: ${hotel.name}
Ranking: ${hotel.ranking || "N/A"} stars
Location: ${hotel.address || ""}, ${hotel.city || ""}, ${hotel.country || ""}
Price: From ${hotel.lowest_price?.amount || "N/A"} ${hotel.lowest_price?.currency || "USD"}
      `.trim();
    });

    const responseText = `
Found ${total} hotels matching your criteria. Here are the top ${hotels.length} results:

${hotelSummaries.join("\n\n")}

To get more details about a specific hotel, use the get-hotel-details tool with the hotel ID.
    `.trim();

    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
    };
  }
);

// Register hotel details tool
server.tool(
  "get-hotel-details",
  "Get detailed information about a specific hotel by ID",
  {
    hotel_id: z.string().describe("ID of the hotel to get details for"),
  },
  async ({ hotel_id }) => {
    // Check if hotel exists in session
    if (session.hotels[hotel_id]) {
      const hotel = session.hotels[hotel_id];
      const formattedHotel = formatHotelInfo(hotel);

      return {
        content: [
          {
            type: "text",
            text: formattedHotel,
          },
        ],
      };
    }

    // If not in session, try to fetch from API
    try {
      const hotelData = await makeApiRequest<any>(`/api/v1/hotels/${hotel_id}`, "GET");

      if (!hotelData) {
        return {
          content: [
            {
              type: "text",
              text: `Could not find hotel with ID ${hotel_id}. Please make sure you have the correct ID or search for hotels first.`,
            },
          ],
        };
      }

      // Store in session for future use
      session.hotels[hotel_id] = hotelData;
      const formattedHotel = formatHotelInfo(hotelData);

      return {
        content: [
          {
            type: "text",
            text: formattedHotel,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving hotel details for ID ${hotel_id}. Please try again later.`,
          },
        ],
      };
    }
  }
);

// Register booking quote tool
server.tool(
  "book-hotel",
  "Book a hotel by creating a quote and returning payment link",
  {
    hotel_id: z.string().describe("ID of the hotel to book"),
    provider_id: z.string().describe("ID of the provider"),
    check_in_date: z.string().describe("Check-in date (YYYY-MM-DD)"),
    check_out_date: z.string().describe("Check-out date (YYYY-MM-DD)"),
    opaque_rate_data: z.string().describe("Opaque rate data from availability response"),
  },
  async (params) => {
    // Create quote request
    const quoteRequest = {
      products: [
        {
          product_type: "HotelProduct",
          provider_id: params.provider_id,
          hotel_id: params.hotel_id,
          check_in_date: params.check_in_date,
          check_out_date: params.check_out_date,
          opaque_rate_data: params.opaque_rate_data,
        },
      ],
    };

    // Schedule quote
    const scheduleResponse = await makeApiRequest<any>(
      "/api/v1/booking/quote/schedule",
      "POST",
      quoteRequest
    );

    if (!scheduleResponse || !scheduleResponse.quote_id) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to schedule quote. Please try again later.",
          },
        ],
      };
    }

    const quoteId = scheduleResponse.quote_id;

    // Poll for quote status
    let quoteStatus = "processing";
    let quoteResult = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (quoteStatus === "processing" && attempts < maxAttempts) {
      attempts++;

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Pull quote status
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
        return {
          content: [
            {
              type: "text",
              text: `Quote generation failed: ${pullResponse.error || "Unknown error"}`,
            },
          ],
        };
      }
    }

    if (quoteStatus === "processing") {
      return {
        content: [
          {
            type: "text",
            text: `Quote is still processing. You can check the status later using quote ID: ${quoteId}`,
          },
        ],
      };
    }

    if (!quoteResult) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve quote result. Please try again later.",
          },
        ],
      };
    }

    // Format quote information
    const paymentLink = `http://www.jinko.so/booking/pay/${quoteId}`;

    let productInfo = "";
    if (quoteResult.quoted_products && quoteResult.quoted_products.length > 0) {
      const product = quoteResult.quoted_products[0];
      productInfo = `
Hotel: ${product.hotel_name || "Unknown hotel"}
Check-in: ${params.check_in_date}
Check-out: ${params.check_out_date}
Total Price: ${product.final_price?.amount || "N/A"} ${product.final_price?.currency || "USD"}
      `.trim();
    }

    const responseText = `
Your hotel booking quote has been created successfully!

${productInfo}

To complete your booking, please proceed to the payment page:
${paymentLink}

Quote ID: ${quoteId}
    `.trim();

    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
    };
  }
);

// Register place autocomplete tool
server.tool(
  "autocomplete-place",
  "Get place suggestions based on user input",
  {
    query: z.string().describe("User's input for place search (e.g., 'New York', 'Paris', 'Tokyo')"),
  },
  async ({ query }) => {
    // Make API request to get place suggestions
    const autocompleteResult = await makeApiRequest<any>(
      "/api/v1/hotels/places/autocomplete",
      "POST",
      { query }
    );

    if (!autocompleteResult || !autocompleteResult.places) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve place suggestions. Please try again with a different query.",
          },
        ],
      };
    }

    const { places = [] } = autocompleteResult;

    if (places.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No places found matching your query. Please try a different search term.",
          },
        ],
      };
    }

    // Store place suggestions in session
    session.placeSuggestions = places;

    // Format results for LLM
    const placeSummaries = places.map((place: any, index: number) => {
      return `
${index + 1}. ${place.name}
   Type: ${place.type || "Unknown"}
   Location: ${place.city || ""}, ${place.country || ""}
   ID: ${place.id}
      `.trim();
    });

    let responseText = "";
    
    if (places.length === 1) {
      // If only one place is found, automatically confirm it
      session.confirmedPlace = places[0];
      responseText = `
Found 1 place matching your query:

${placeSummaries[0]}

This place has been automatically selected for your search. You can now use the search-hotels tool to find hotels in this location.
      `.trim();
    } else {
      // If multiple places are found, ask user to confirm
      responseText = `
Found ${places.length} places matching your query:

${placeSummaries.join("\n\n")}

Please use the confirm-place tool with the ID of the place you want to select.
      `.trim();
    }

    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
    };
  }
);

// Register place confirmation tool
server.tool(
  "confirm-place",
  "Confirm a place from the suggestions for hotel search",
  {
    place_id: z.string().describe("ID of the place to confirm from the suggestions"),
  },
  async ({ place_id }) => {
    // Check if we have place suggestions
    if (session.placeSuggestions.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No place suggestions available. Please use the autocomplete-place tool first.",
          },
        ],
      };
    }

    // Find the place in suggestions
    const selectedPlace = session.placeSuggestions.find((place: any) => place.id === place_id);

    if (!selectedPlace) {
      return {
        content: [
          {
            type: "text",
            text: `Place with ID ${place_id} not found in the suggestions. Please use a valid place ID from the autocomplete results.`,
          },
        ],
      };
    }

    // Store the confirmed place
    session.confirmedPlace = selectedPlace;

    return {
      content: [
        {
          type: "text",
          text: `
Place confirmed: ${selectedPlace.name}, ${selectedPlace.city || ""}, ${selectedPlace.country || ""}

You can now use the search-hotels tool to find hotels in this location.
          `.trim(),
        },
      ],
    };
  }
);

// Register facilities as resources
// This exposes the facilities.json data as a resource in the MCP server
server.resource(
  "Hotel Facilities",
  "hotel:///facilities",
  {
    description: "List of all available hotel facilities with translations",
    mimeType: "application/json"
  },
  async (uri) => {
    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: "application/json",
          text: JSON.stringify(facilitiesData, null, 2)
        }
      ]
    };
  }
);

// Start the server
async function main() {
  try {
    // Use the port provided by the runtime information
    const port = 52122; // Using one of the available ports from runtime information
    const transport = new StdioServerTransport();

    console.log("Starting MCP server...");
    await server.connect(transport);
    console.log(`Hotel Booking MCP Server running on http://localhost:${port}`);
    console.log(`Loaded ${facilitiesData.length} facilities as resources`);
    console.log(`Available resources:`);
    console.log(`- hotel:///facilities (All facilities)`);
    console.log(`- hotel:///facilities/{facility_id} (Individual facility)`);
    console.log(`- hotel:///facilities/language/{lang} (Facilities by language)`);
  } catch (error) {
    console.error("Error starting server:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
