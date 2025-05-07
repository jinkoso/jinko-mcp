import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { request } from "http";
import yaml from "js-yaml";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";

// ========== Configuration ==========
/**
 * Base URL for the travel BFF API
 */
const API_BASE_URL = "https://api.dev.jinkotravel.com";
const FACILITIES_PATH = path.resolve(process.cwd(), "facilities.json");
const MAX_QUOTE_POLL_ATTEMPTS = 30;
const QUOTE_POLL_INTERVAL_MS = 2000;

// ========== Interfaces and Types ==========
/**
 * Session storage to keep track of hotel search results and place suggestions
 */
interface SessionData {
  hotels: Record<string, Hotel>;
  placeSuggestions: PlaceSuggestion[];
  confirmedPlace: PlaceSuggestion | null;
}

interface Hotel {
  id: string | number;
  name: string;
  star_rating?: number;
  address?: string;
  description?: string;

  // Added fields
  main_photo?: string;
  rating?: number | null;

  images?: Array<{
    type: string;
    path: string;
    order: number;
  }>;

  policies?: Array<{
    type: string;    // 'check_in', 'check_out', 'contact', etc.
    name: string;
    description: string[];
  }>;

  // Enhanced amenities with additional fields
  amenities: Array<{
    name: string;
    id?: number;
    code?: string;
    description?: string | null;
    amount?: string | null;
  }>;

  rooms: HotelRoom[];

  // Updated price fields to handle string values
  min_price?: {
    value: string | number;
    currency: string;
  };

  max_price?: {
    value: string | number;
    currency: string;
  };
}

interface HotelRoom {
  room_id: string;
  room_name: string;
  description?: string;
  max_occupancy?: number | null;

  beds?: Array<{
    type: string;
    count: number;
  }>;

  amenities?: Array<{
    code: string;
    name: string;
    description: string | null;
    amount: string | null;
  }>;

  images?: Array<{
    type: string;
    path: string;
    order: number | null;
  }>;

  min_price?: {
    value: string | number;
    currency: string;
  };

  max_price?: {
    value: string | number;
    currency: string;
  };

  lowest_rate: {
    rate_id: string;
    check_in_date?: string;
    check_out_date?: string;
    provider_id?: string;
    description?: string;
    selling_price?: {
      value: string | number;
      currency: string;
    };
    tax_and_fee?: {
      value: string | number;
      currency: string;
    };
    base_price?: {
      value: string | number;
      currency: string;
    };
    is_refundable?: boolean;
    policies?: Array<{
      type: string;
      name: string;
      description: string[];
    }>;
    opaque?: string;
  };

  rates: Array<{
    rate_id: string;
    check_in_date?: string;
    check_out_date?: string;
    provider_id?: string;
    description?: string;
    selling_price?: {
      value: string | number;
      currency: string;
    };
    tax_and_fee?: {
      value: string | number;
      currency: string;
    };
    base_price?: {
      value: string | number;
      currency: string;
    };
    is_refundable: boolean;
    policies?: Array<{
      type: string;
      name: string;
      description: string[];
    }>;
    opaque?: string;
  }>;
}

interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
  };
  types?: string[];
  latitude: number;
  longitude: number;
}

interface QuoteProduct {
  hotel_name: string;
  check_in_date: string;
  check_out_date: string;
  rate_info: {
    selling_price?: {
      amount: number;
      currency: string;
    }
  }
}

interface QuoteResult {
  quoted_products: QuoteProduct[];
  status: string;
  error?: string;
}

// Enhanced interface for hotel summary (search results)
interface HotelSummary {
  id: string | number;
  name: string;
  ranking: string;
  location: string;
  price: string;
  images: string[]; // Array of image URLs (max 3)
  lowest_rate: {
    room_id: string;
    room_name: string;
    rate_id: string;
    price: string;
    is_refundable: boolean;
    payment_type: string;
    meal_plan?: string;
  };
}

// Enhanced interface for hotel details
interface HotelDetail {
  id: string | number;
  name: string;
  ranking: string;
  location: string;
  description?: string;
  facilities: string[];
  images: string[]; // All hotel images
  check_in?: string;
  check_out?: string;
  rooms: Array<{
    room_id: string;
    room_name: string;
    description?: string;
    images: string[];
    amenities: string[];
    max_occupancy?: number;
    rates: Array<{
      rate_id: string;
      description: string;
      price: string;
      is_refundable: boolean;
      cancellation_policy?: string[];
      meal_plan?: string;
      payment_type: string; // "Pay Now" or "Pay Later"
    }>;
  }>;
}

interface PlaceSummaryResponse {
  places: Array<{
    id: string;
    name: string;
    type: string;
    location: string;
  }>;
  count: number;
  message: string;
}

interface BookingQuoteResponse {
  status: string;
  hotel: string;
  check_in: string;
  check_out: string;
  total_price: string;
  payment_link: string;
  quote_id: string;
}

// ========== State Management ==========
/**
 * Initialize session
 */
const session: SessionData = {
  hotels: {},
  placeSuggestions: [],
  confirmedPlace: null,
};

// ========== Utilities and Helpers ==========
/**
 * Load facilities data from JSON file
 * @returns Array of facility objects
 */
function loadFacilitiesData(): any[] {
  try {
    if (fs.existsSync(FACILITIES_PATH)) {
      const data = fs.readFileSync(FACILITIES_PATH, "utf-8");
      return JSON.parse(data);
    } else {
      console.warn("facilities.json not found at:", FACILITIES_PATH);
    }
  } catch (error) {
    console.error("Error loading facilities data:", error);
  }
  return []; // Return empty array on error or if file not found
}

/**
 * Make API request to the travel BFF API
 * @param endpoint API endpoint path
 * @param method HTTP method
 * @param body Request body (optional)
 * @returns Response data or null on error
 */
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

/**
 * Create a YAML response for MCP tools
 * @param data Object to convert to YAML
 * @returns MCP response object with YAML content
 */
function createYamlResponse(data: any): { [x: string]: unknown; content: { type: "text"; text: string; }[] } {
  const yamlString = yaml.dump(data, {
    indent: 2,
    lineWidth: -1, // Don't wrap lines
    noRefs: true,   // Don't use references
  });

  return {
    content: [
      {
        type: "text" as const,
        text: yamlString,
      },
    ],
  };
}

/**
 * Format hotel to a summary object for search results
 * @param hotel Hotel object to format
 * @returns Formatted hotel summary object with images and lowest rate info
 */
function formatHotelToSummaryObject(hotel: Hotel): HotelSummary {
  // Get up to 3 images (main photo first)
  const images: string[] = [];

  // Add main photo if exists
  if (hotel.main_photo) {
    images.push(hotel.main_photo);
  }

  // Add up to 2 more photos from images array
  if (hotel.images && hotel.images.length > 0) {
    const additionalImages = hotel.images
      .filter(img => img.path !== hotel.main_photo) // Exclude main photo if already added
      .slice(0, images.length === 0 ? 3 : (3 - images.length))
      .map(img => img.path);

    images.push(...additionalImages);
  }

  // Find the room with the lowest rate
  let lowestRateRoom = {
    room_id: "",
    room_name: "",
    rate_id: "",
    price: `${hotel.min_price?.value || "N/A"} ${hotel.min_price?.currency || "USD"}`,
    is_refundable: false,
    payment_type: "Pay Now"
  };

  if (hotel.rooms && hotel.rooms.length > 0) {
    // Sort rooms by min_price to find the cheapest
    const sortedRooms = [...hotel.rooms].sort((a, b) => {
      const priceA = a.min_price ? Number(a.min_price.value) : Infinity;
      const priceB = b.min_price ? Number(b.min_price.value) : Infinity;
      return priceA - priceB;
    });

    const cheapestRoom = sortedRooms[0];

    if (cheapestRoom && cheapestRoom.lowest_rate) {
      // Find the associated rate
      const rate = cheapestRoom.rates?.find(r => r.rate_id === cheapestRoom.lowest_rate.rate_id);

      // Extract meal plan from rate if available
      let mealPlan: string | undefined;
      let paymentType = "Pay Now";

      if (rate?.opaque) {
        try {
          const rateData = JSON.parse(rate.opaque);
          mealPlan = rateData.meal_plan?.description;
          paymentType = rateData.pricing?.pricing_type === "pay_later" ? "Pay Later" : "Pay Now";
        } catch (e) {
          // Ignore parsing errors
        }
      }

      lowestRateRoom = {
        room_id: cheapestRoom.room_id,
        room_name: cheapestRoom.room_name,
        rate_id: cheapestRoom.lowest_rate.rate_id,
        price: `${cheapestRoom.min_price?.value || "N/A"} ${cheapestRoom.min_price?.currency || "USD"}`,
        is_refundable: rate?.is_refundable || false,
        payment_type: paymentType,
      };
    }
  }

  return {
    id: hotel.id,
    name: hotel.name,
    ranking: `${hotel.star_rating || "N/A"} stars`,
    location: hotel.address || "Unknown location",
    price: `From ${hotel.min_price?.value || "N/A"} ${hotel.min_price?.currency || "USD"}`,
    images,
    lowest_rate: lowestRateRoom
  };
}

/**
 * Format hotel to a detail object with complete room and rate information
 * @param hotel Hotel object to format
 * @returns Formatted hotel detail object
 */
function formatHotelToDetailObject(hotel: Hotel): HotelDetail {
  if (!hotel) {
    return {
      id: "unknown",
      name: "Unknown Hotel",
      ranking: "N/A",
      location: "N/A",
      facilities: [],
      images: [],
      rooms: []
    };
  }

  // Get all hotel images
  const images = hotel.images ? hotel.images.map(img => img.path) : [];

  // If main photo exists and not already in images, add it to the beginning
  if (hotel.main_photo && !images.includes(hotel.main_photo)) {
    images.unshift(hotel.main_photo);
  }

  // Format facilities
  const facilities = hotel.amenities.filter(amenity =>
    !amenity.name.includes("Unknown Facility")
  ).map(amenity => amenity.name);

  // Get check-in/check-out times
  let checkIn: string | undefined;
  let checkOut: string | undefined;

  if (hotel.policies) {
    const checkInPolicy = hotel.policies.find(p => p.type === 'check_in');
    const checkOutPolicy = hotel.policies.find(p => p.type === 'check_out');

    checkIn = checkInPolicy?.description?.[0];
    checkOut = checkOutPolicy?.description?.[0];
  }

  // Format rooms with all rates
  const rooms = hotel.rooms ? hotel.rooms.map(room => {
    // Get room images
    const roomImages = room.images ? room.images.map(img => img.path) : [];

    // Get room amenities
    const roomAmenities = room.amenities ?
      room.amenities
        .filter(a => !a.name.includes("Unknown"))
        .map(a => a.name) :
      [];

    // Format all rates for the room
    const rates = room.rates ? room.rates.map(rate => {
      // Extract meal plan if available
      let mealPlan: string | undefined;
      let paymentType = rate.description || "Pay Now";

      try {
        if (rate.opaque) {
          const rateData = JSON.parse(rate.opaque);
          mealPlan = rateData.meal_plan?.description;

          // Determine payment type from opaque data if available
          if (rateData.pricing && rateData.pricing.pricing_type) {
            paymentType = rateData.pricing.pricing_type === "pay_later" ? "Pay Later" : "Pay Now";
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }

      return {
        rate_id: rate.rate_id,
        description: rate.description || "",
        price: `${rate.selling_price?.value || "N/A"} ${rate.selling_price?.currency || "USD"}`,
        is_refundable: rate.is_refundable || false,
        cancellation_policy: rate.policies?.find(p => p.type === 'cancellation')?.description,
        meal_plan: mealPlan,
        payment_type: paymentType
      };
    }) : [];

    return {
      room_id: room.room_id,
      room_name: room.room_name,
      description: room.description,
      images: roomImages,
      amenities: roomAmenities,
      max_occupancy: room.max_occupancy == null ? undefined : room.max_occupancy,
      rates
    };
  }) : [];

  // Return structured hotel detail object
  return {
    id: hotel.id,
    name: hotel.name,
    ranking: `${hotel.star_rating || "N/A"} stars`,
    location: hotel.address || "Unknown location",
    description: hotel.description,
    facilities,
    images,
    check_in: checkIn,
    check_out: checkOut,
    rooms
  };
}

/**
 * Poll for quote status until it's ready or times out
 * @param quoteId ID of the quote to poll for
 * @returns Quote result or null if still processing
 */
async function pollForQuoteStatus(quoteId: string): Promise<any | null> {
  let quoteStatus = "processing";
  let quoteResult = null;
  let attempts = 0;

  while (quoteStatus === "processing" && attempts < MAX_QUOTE_POLL_ATTEMPTS) {
    attempts++;

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, QUOTE_POLL_INTERVAL_MS));

    // Poll quote status
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
      throw new Error(`Quote generation failed: ${pullResponse.error || "Unknown error"}`);
    }
  }

  return quoteResult;
}

// ========== Tool Implementations as Named Functions ==========
/**
 * Search for available hotels based on criteria
 */
async function searchHotels(params: {
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  facilities?: number[];
}) {
  // Check if we have a confirmed place
  if (!session.confirmedPlace) {
    return createYamlResponse({
      status: "error",
      message: "No confirmed place available. Please use the autocomplete-place tool first to find and confirm a location."
    });
  }

  // Prepare request body for hotel availability API
  const requestBody = {
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
    return createYamlResponse({
      status: "error",
      message: "Failed to retrieve hotel availability data. Please try again later."
    });
  }

  const { hotels = [], total = 0 } = availabilityResult;

  if (hotels.length === 0) {
    return createYamlResponse({
      status: "empty",
      message: "No hotels found matching your criteria. Please try different search parameters."
    });
  }

  // Store hotels in session for later retrieval
  hotels.forEach((hotel: Hotel) => {
    session.hotels[hotel.id.toString()] = hotel;
  });

  // Format results for YAML response
  const hotelSummaries = hotels.map((hotel: Hotel) => formatHotelToSummaryObject(hotel));

  return createYamlResponse({
    status: "success",
    total_hotels: total,
    results_count: hotels.length,
    hotels: hotelSummaries,
    message: "Use get-hotel-details tool with the hotel ID to see more information."
  });
}

/**
 * Get detailed information about a specific hotel
 */
async function getHotelDetails(params: { hotel_id: string }) {
  // Check if hotel exists in session
  if (session.hotels[params.hotel_id]) {
    const hotel = session.hotels[params.hotel_id];
    const hotelDetail = formatHotelToDetailObject(hotel);

    return createYamlResponse({
      status: "success",
      hotel: hotelDetail
    });
  } else {
    return createYamlResponse({
      status: "error",
      message: `Hotel with ID ${params.hotel_id} not found in session. Please use the search-hotels tool to find hotels first.`
    });
  }
}

/**
 * Book a hotel by creating a quote and returning payment link
 */
async function bookHotel(params: { hotel_id: string; rate_id: string }) {
  // Check if hotel exists in session
  if (!session.hotels[params.hotel_id]) {
    return createYamlResponse({
      status: "error",
      message: `Hotel with ID ${params.hotel_id} not found in session. Please use the search-hotels tool to find hotels first.`
    });
  }

  const hotel = session.hotels[params.hotel_id];
  let room = null;
  let rate = null;

  // Find the room and rate
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
    return createYamlResponse({
      status: "error",
      message: `Room or rate with ID ${params.rate_id} not found in hotel ${params.hotel_id}.`
    });
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
    return createYamlResponse({
      status: "error",
      message: "Failed to schedule quote. Please try again later."
    });
  }

  const quoteId = scheduleResponse.id;

  // Poll for quote status
  const quoteResult = await pollForQuoteStatus(quoteId);

  if (!quoteResult) {
    return createYamlResponse({
      status: "processing",
      message: `Quote is still processing. You can check the status later using quote ID: ${quoteId}`,
      quote_id: quoteId
    });
  }

  // Format quote information
  const encodedQuoteId = Buffer.from(quoteId).toString("base64");
  const paymentLink = `http://www.jinko.so/booking/pay/${encodedQuoteId}`;

  let productInfo: BookingQuoteResponse = {
    status: "success",
    hotel: "Unknown hotel",
    check_in: "N/A",
    check_out: "N/A",
    total_price: "N/A",
    payment_link: paymentLink,
    quote_id: encodedQuoteId
  };

  if (quoteResult.quoted_products && quoteResult.quoted_products.length > 0) {
    const product = quoteResult.quoted_products[0];
    productInfo = {
      status: "success",
      hotel: product.hotel_name || "Unknown hotel",
      check_in: product.check_in_date,
      check_out: product.check_out_date,
      total_price: `${product.rate_info.selling_price?.amount || "N/A"} ${product.rate_info.selling_price?.currency || "USD"}`,
      payment_link: paymentLink,
      quote_id: encodedQuoteId
    };
  }

  return createYamlResponse(productInfo);
}

/**
 * Get place suggestions based on user input
 */
async function autocompletePlaces(params: { query: string; language?: string }) {
  // Make API request to get place suggestions
  const request = {
    "input": params.query,
    "langauge": "en", // Note: There's a typo in the API - "langauge" instead of "language"
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
    return createYamlResponse({
      status: "error",
      message: "Failed to retrieve place suggestions. Please try again with a different query."
    });
  }

  if (!autocompleteResult.predictions || autocompleteResult.predictions.length === 0) {
    return createYamlResponse({
      status: "empty",
      message: "No places found matching your query. Please try a different search term."
    });
  }

  // Store place suggestions in session
  session.placeSuggestions = autocompleteResult.predictions;

  // Format results for YAML response
  const placeSummaries = autocompleteResult.predictions.map((place: PlaceSuggestion, index: number) => ({
    id: place.place_id,
    name: place.structured_formatting?.main_text || place.description,
    type: place.types || "Unknown",
    location: place.description || ""
  }));

  const response: PlaceSummaryResponse = {
    places: placeSummaries,
    count: autocompleteResult.predictions.length,
    message: ""
  };

  if (autocompleteResult.predictions.length === 1) {
    // If only one place is found, automatically confirm it
    session.confirmedPlace = autocompleteResult.predictions[0];
    response.message = "This place has been automatically selected for your search. You can now use the search-hotels tool to find hotels in this location.";
  } else {
    // If multiple places are found, ask user to confirm
    response.message = "Please use the confirm-place tool with the ID of the place you want to select.";
  }

  return createYamlResponse(response);
}

/**
 * Confirm a place from the suggestions for hotel search
 */
async function confirmPlace(params: { place_id: string }) {
  // Check if we have place suggestions
  if (session.placeSuggestions.length === 0) {
    return createYamlResponse({
      status: "error",
      message: "No place suggestions available. Please use the autocomplete-place tool first."
    });
  }

  // Find the place in suggestions
  const selectedPlace = session.placeSuggestions.find((place) => place.place_id === params.place_id);

  if (!selectedPlace) {
    return createYamlResponse({
      status: "error",
      message: `Place with ID ${params.place_id} not found in the suggestions. Please use a valid place ID from the autocomplete results.`
    });
  }

  // Store the confirmed place
  session.confirmedPlace = selectedPlace;

  return createYamlResponse({
    status: "success",
    place: {
      id: selectedPlace.place_id,
      name: selectedPlace.structured_formatting?.main_text || selectedPlace.description,
      location: selectedPlace.description,
    },
    message: "Place confirmed. You can now use the search-hotels tool to find hotels in this location."
  });
}

/**
 * Get hotel facilities resource
 */
async function getFacilitiesResource(uri: URL) {
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

// ========== Server Setup ==========
// Load facilities data
const facilitiesData = loadFacilitiesData();

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
  "Search for available hotels based on location, dates, and other criteria. The location is defined by the confirmed place.",
  {
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

/**
 * Get detailed information about a specific hotel by ID
 */
server.tool(
  "get-hotel-details",
  "Get detailed information about a specific hotel by ID, which are found by search-hotel method.",
  {
    hotel_id: z.string().describe("ID of the hotel to get details for"),
  },
  getHotelDetails
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
  bookHotel
);

/**
 * Get place suggestions based on user input
 */
server.tool(
  "autocomplete-place",
  "Get place suggestions based on user input",
  {
    query: z.string().describe("User's input for place search (e.g., 'New York', 'Paris', 'Tokyo')"),
    language: z.string().optional().describe("The language used by user."),
  },
  autocompletePlaces
);

/**
 * Confirm a place from the suggestions for hotel search
 */
server.tool(
  "confirm-place",
  "Confirm a place from the suggestions for hotel search",
  {
    place_id: z.string().describe("ID of the place to confirm from the suggestions"),
  },
  confirmPlace
);

// ========== Register Resources ==========
/**
 * Register facilities as resources
 * This exposes the facilities.json data as a resource in the MCP server
 */
server.resource(
  "Hotel Facilities",
  "hotel:///facilities",
  {
    description: "List of all available hotel facilities with translations",
    mimeType: "application/json"
  },
  getFacilitiesResource
);

// Export the server instance
export { server };
