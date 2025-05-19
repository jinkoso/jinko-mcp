/**
 * Hotel search tools for the hotel MCP server
 */
import { makeApiRequest, createJsonResponse } from "../../utils.js";
import { session } from "../../state.js";
import { Hotel } from "../../types.js";
import { formatHotelToDetailObject, formatHotelToSummaryObject } from "../../formatters.js";

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

  const { session_id=null, has_more=false, hotels = [], total = 0 } = availabilityResult;

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
  const hotelSummaries = hotels.map((hotel: Hotel) => formatHotelToSummaryObject(hotel));

  var message = `Got ${hotels.length} available hotels by search, please make the recommendation according to user's query, especially according to user's query.`;
  if (has_more) {
    message = message + "If user need more or you think need more hotel to make the recommendation, you can use the load more tools to retrieve more hotel from the server."
  } else {
    message = message + "No more hotel can be retrieve from the server, recommand some hotels from existing hotel list and help the user to change the search query."
  }

  return createJsonResponse({
    status: "success",
    total_hotels: total,
    hotels: hotelSummaries,
    session_id: session_id,
    message: message,
  });
}

export async function loadMoreHotels(params: {
  session_id: string;
}) {
  // Make API request to load more hotels
  const availabilityResult = await makeApiRequest<any>(
    "/api/v1/hotels/availability/load_more",
    "POST",
    { session_id: params.session_id }
  );

  if (!availabilityResult) {
    return createJsonResponse({
      status: "error",
      message: "Failed to retrieve hotel availability data. Please try again later."
    });
  }

  const { session_id=null, has_more=false, hotels = [], total = 0 } = availabilityResult;

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
  const hotelSummaries = hotels.map((hotel: Hotel) => formatHotelToSummaryObject(hotel));

   var message = `Got ${hotels.length} additional available hotels by load more, please make the recommendation according to user's query, especially according to user's query.`;
  if (has_more) {
    message = message + "If user need more or you think need more hotel to make the recommendation, you can use the load more tools to retrieve more hotel from the server."
  } else {
    message = message + "No more hotel can be retrieve from the server, recommand some hotels from existing hotel list and help the user to change the search query."
  }

  return createJsonResponse({
    status: "success",
    total_hotels: total,
    hotels: hotelSummaries,
    session_id: session_id,
    message: message,
  });
}

/**
 * Get detailed information about a specific hotel
 */
export async function getHotelDetails(params: { session_id: string, hotel_id: string }) {
  // Make API request to load more hotels
  const hotelAvailability = await makeApiRequest<any>(
    `/api/v1/hotels/availability/${params.session_id}/${params.hotel_id}`,
    "GET",
  );

  const hotelDetail = formatHotelToDetailObject(hotelAvailability);

  const message = "In this hotel detail response, the user can find all the information and all the available rate."

  return createJsonResponse({
    status: "success",
    hotel: hotelDetail,
    session_id: params.session_id,
    message: message,
  });
}
