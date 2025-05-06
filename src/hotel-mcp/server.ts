import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { request } from "http";

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
  if (!hotel) {
    return "No hotel information available.";
  }

  let formattedRooms = "";
  if (hotel.rooms && hotel.rooms.length > 0) {
    formattedRooms = "\nAvailable Rooms:\n" + hotel.rooms.map((room: any) => {
      return `- ${room.room_name || "Standard Room"} (rate id: ${room.lowest_rate.rate_id}): ${room.description || "No description"} - Price: ${room.min_price?.value || "N/A"} ${room.min_price?.currency || "USD"}`;
    }).join("\n");
  }

  let formattedFacilities = "";
  formattedFacilities = "\nFacilities:\n" + hotel.amenities.map((amenity: any) => {
    return `- ${amenity.name || "Unknown Facility"}`;
  }).join("\n");

  return `
Hotel ID: ${hotel.id}
Name: ${hotel.name}
Ranking: ${hotel.star_rating || "N/A"} stars
Location: ${hotel.address || ""}
${hotel.description}
${formattedFacilities}
${formattedRooms}
  `.trim();
}

// Register hotel search tool
server.tool(
  "search-hotels",
  "Search for available hotels based on in a location based dates, and other criteria. The location is defined by the confirmed place.",
  {
    check_in_date: z.string().default("2025-06-25").describe("Check-in date (YYYY-MM-DD)"),
    check_out_date: z.string().default("2025-06-26").describe("Check-out date (YYYY-MM-DD)"),
    adults: z.number().min(1).default(2).describe("Number of adults"),
    children: z.number().min(0).default(0).describe("Number of children"),
    facilities: z.array(z.number()).optional().describe("Facility IDs to filter hotels by, the IDs can be inferred with facilities resource according to user's requirements."),
  },
  async (params) => {
    // Check if we should use the confirmed place
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

    // Prepare request body for hotel availability API
    const requestBody: any = {
      check_in_date: params.check_in_date,
      check_out_date: params.check_out_date,
      guests: [
        {
          adults: params.adults,
          children: [],
          infant: 0,
        },
      ],
      location: {
        latitude: session.confirmedPlace.latitude.toString(),
        longitude: session.confirmedPlace.longitude.toString(),
      },
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
Ranking: ${hotel.star_rating || "N/A"} stars
Location: ${hotel.address || ""}
Price: From ${hotel.min_price?.value || "N/A"} ${hotel.min_price?.currency || "USD"}
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
  "Get detailed information about a specific hotel by ID, which are found by search-hotel method,",
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
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Hotel with ID ${hotel_id} not found in session. Please use the search-hotels tool to find hotels first.`,
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
    rate_id: z.string().describe("ID of the room to book"),
  },
  async (params) => {
      // Check if hotel exists in session
    if (!session.hotels[params.hotel_id]) {
      return {
        content: [
          {
            type: "text",
            text: `Hotel with ID ${params.hotel_id} not found in session. Please use the search-hotels tool to find hotels first.`,
          },
        ],
      }; 
    }


    const hotel = session.hotels[params.hotel_id];
    let room: any = null;
    let rate: any = null;

    for (const r of hotel.rooms) {
      for (const rt of r.rates) {
        if (rt.rate_id === params.rate_id) {
          room = r;
          rate = rt;
          break;
        }
      }
      if (room && rate) break;
    }

    if (!room || !rate) {
      return {
        content: [
          {
            type: "text",
            text: `Room or rate with ID ${params.rate_id} not found in hotel ${params.hotel_id}.`,
          },
        ],
      };
    }

    // Create quote request
    const quoteRequest = {
      products: [
        {
          product_type: "HotelProduct",
          provider_id: rate.provider_id,
          hotel_id: hotel.id.toString(),
          check_in_date: rate.check_in_date,
          check_out_date: rate.check_out_date,
          opaque_rate_data: rate.opaque,
        },
      ],
    };

    // Schedule quote
    const scheduleResponse = await makeApiRequest<any>(
      "/api/v1/booking/quote/schedule",
      "POST",
      quoteRequest
    );

    if (!scheduleResponse || !scheduleResponse.id) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to schedule quote. Please try again later.",
          },
        ],
      };
    }

    const quoteId = scheduleResponse.id;

    // Poll for quote status
    let quoteStatus = "processing";
    let quoteResult = null;
    let attempts = 0;
    const maxAttempts = 30;

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

    const encodedQuoteId = Buffer.from(quoteId).toString("base64");

    // Format quote information
    const paymentLink = `http://www.jinko.so/booking/pay/${encodedQuoteId}`;

    let productInfo = "";
    if (quoteResult.quoted_products && quoteResult.quoted_products.length > 0) {
      const product = quoteResult.quoted_products[0];
      productInfo = `
Hotel: ${product.hotel_name || "Unknown hotel"}
Check-in: ${product.check_in_date}
Check-out: ${product.check_out_date}
Total Price: ${product.rate_info.selling_price?.amount || "N/A"} ${product.rate_info.selling_price?.currency || "USD"}
      `.trim();
    }

    const responseText = `
Your hotel booking quote has been created successfully!

${productInfo}

To complete your booking, please proceed to the payment page:
${paymentLink}

Quote ID: ${encodedQuoteId}
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
    language: z.string().optional().describe("The language used by user."),
  },
  async (params) => {
    // Make API request to get place suggestions
    const request = {
      "input": params.query,
      "langauge": "en",
    };
    if (params.language) {
      request.langauge = params.language;
    }

    const autocompleteResult = await makeApiRequest<any>(
      "/api/v1/hotels/places/autocomplete",
      "POST",
      request,
    );

    if (!autocompleteResult) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve place suggestions. Please try again with a different query.",
          },
        ],
      };
    }


    if (autocompleteResult.predictions.length === 0) {
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
    session.placeSuggestions = autocompleteResult.predictions;

    // Format results for LLM
    const placeSummaries = autocompleteResult.predictions.map((place: any, index: number) => {
      return `
${index + 1}. ${place.structured_formatting?.main_text || place.description}
   Type: ${place.types || "Unknown"}
   Location: ${place.description || ""}
   ID: ${place.place_id}
      `.trim();
    });

    let responseText = "";

    if (autocompleteResult.predictions.length === 1) {
      // If only one place is found, automatically confirm it
      session.confirmedPlace = autocompleteResult.predictions[0];
      responseText = `
Found 1 place matching your query:

${placeSummaries[0]}

This place has been automatically selected for your search. You can now use the search-hotels tool to find hotels in this location.
      `.trim();
    } else {
      // If multiple places are found, ask user to confirm
      responseText = `
Found ${autocompleteResult.predictions.length} places matching your query:

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
    const selectedPlace = session.placeSuggestions.find((place: any) => place.place_id === place_id);

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
Place confirmed: ${selectedPlace.description},

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

// Export the server instance
export { server };
