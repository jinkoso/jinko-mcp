/**
 * Hotel search tools for the hotel MCP server
 */
import { makeApiRequest, createJsonResponse } from "../../utils.js";
import { session } from "../../state.js";
import { Hotel } from "../../types.js";
import { formatHotelToDetailObject } from "../../formatters.js";

/**
 * Search for available hotels based on criteria
 */
export async function searchHotels(params: {
  latitude: number;
  longitude: number;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  facilities?: number[];
}) {
  const requestBody = {
    check_in_date: params.check_in_date,
    check_out_date: params.check_out_date,
    guests: [
      {
        adults: params.adults,
        children: Array(params.children).fill(8),
        infant: 0,
      },
    ],
    location: {
      latitude: params.latitude.toString(),
      longitude: params.longitude.toString(),
    },
    facility_ids: params.facilities ? params.facilities : [],
    limit: 50,
  };

  // Make API request to search for hotels
  const availabilityResult = await makeApiRequest<any>(
    "/api/v1/hotels/availability",
    "POST",
    requestBody
  );

  if (!availabilityResult) {
    return createJsonResponse({
      status: "error",
      message: "Failed to retrieve hotel availability data. Please try again later."
    });
  }

  const { hotels = [], total = 0, next_page_token=null } = availabilityResult;

  if (hotels.length === 0) {
    return createJsonResponse({
      status: "empty",
      message: "No hotels found matching your criteria. Please try different search parameters."
    });
  }

  // Store hotels in session for later retrieval
  hotels.forEach((hotel: Hotel) => {
    session.hotels[hotel.id.toString()] = hotel;
  });

  // Format results for response
  const hotelSummaries = hotels.map((hotel: Hotel) => formatHotelToDetailObject(hotel));

  return createJsonResponse({
    status: "success",
    total_hotels: total,
    hotels: hotelSummaries,
    next_page_token: next_page_token,
  });
}

export async function loadMoreHotels(params: {
  next_page_token: string;
}) {
  // Make API request to load more hotels
  const availabilityResult = await makeApiRequest<any>(
    "/api/v1/hotels/availability/load_more",
    "POST",
    { next_page_token: params.next_page_token }
  );

  if (!availabilityResult) {
    return createJsonResponse({
      status: "error",
      message: "Failed to retrieve hotel availability data. Please try again later."
    });
  }

  const { hotels = [], total = 0, next_page_token=null } = availabilityResult;

  if (hotels.length === 0) {
    return createJsonResponse({
      status: "empty",
      message: "No hotels found matching your criteria. Please try different search parameters."
    });
  }

  // Store hotels in session for later retrieval
  hotels.forEach((hotel: Hotel) => {
    session.hotels[hotel.id.toString()] = hotel;
  });

  // Format results for response
  const hotelSummaries = hotels.map((hotel: Hotel) => formatHotelToDetailObject(hotel));

  return createJsonResponse({
    status: "success",
    total_hotels: total,
    hotels: hotelSummaries,
    next_page_token: next_page_token,
  });
}
