/**
 * Hotel search tools for the hotel MCP server
 */
import { makeApiRequest, createYamlResponse } from "../../utils.js";
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
    max_results: 50,
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

  const { session_id=null, has_more=false, hotels = [], total = 0 } = availabilityResult;

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

  // Format results for response
  const hotelSummaries = hotels.map((hotel: Hotel) => formatHotelToSummaryObject(hotel));

  var message = `Found ${hotels.length} available hotels matching the search criteria.`;
  if (has_more) {
    message = message + " Additional hotels are available. If the user needs more options or if the current results don't meet their preferences, use the load-more-hotels tool with the provided session_id to retrieve more options."
  } else {
    message = message + " These are all available hotels matching the search criteria. If the user isn't satisfied with these options, consider suggesting modifications to their search parameters (dates, location, facilities, etc.)."
  }

  return createYamlResponse({
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
    return createYamlResponse({
      status: "error",
      message: "Failed to retrieve hotel availability data. Please try again later."
    });
  }

  const { session_id=null, has_more=false, hotels = [], total = 0 } = availabilityResult;

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

  // Format results for response
  const hotelSummaries = hotels.map((hotel: Hotel) => formatHotelToSummaryObject(hotel));

  var message = `Retrieved ${hotels.length} additional hotels matching the search criteria.`;
  if (has_more) {
    message = message + " More hotels are still available. You can continue to load additional options with the load-more-hotels tool if the current selection doesn't satisfy the user's requirements."
  } else {
    message = message + " You have now retrieved all available hotels matching these search criteria. If the user requires more options, suggest modifying their search parameters such as dates, location, or amenity requirements."
  }

  return createYamlResponse({
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

  const message = "This response contains comprehensive details about the selected hotel, including all available room types, rate options, amenities, policies, and location information. Present the key details to the user and help them compare different rate options if they're considering booking this hotel."

  return createYamlResponse({
    status: "success",
    hotel: hotelDetail,
    session_id: params.session_id,
    message: message,
  });
}
