/**
 * Hotel search tools for the hotel MCP server
 */
import { makeApiRequest, createYamlResponse } from "../../utils.js";
import { session } from "../../state.js";
import { formatHotelToSummaryObject, formatHotelToDetailObject } from "../../formatters.js";
import { Hotel } from "../../types.js";

/**
 * Search for available hotels based on criteria
 */
export async function searchHotels(params: {
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  facilities?: number[];
  place_id?: string; // New optional parameter
}) {
  let placeToUse = session.confirmedPlace;

  // If place_id is provided, find and use that place instead
  if (params.place_id && session.placeSuggestions.length > 0) {
    const selectedPlace = session.placeSuggestions.find(
      (place) => place.place_id === params.place_id
    );
    
    if (selectedPlace) {
      placeToUse = selectedPlace;
      // Update the confirmed place in session
      session.confirmedPlace = selectedPlace;
    }
  }

  // Check if we have a confirmed place
  if (!placeToUse) {
    return createYamlResponse({
      status: "error",
      message: "No place available. Please use the create-session tool first to find and confirm a location."
    });
  }

  // Prepare request body for hotel availability API
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
      latitude: placeToUse.latitude.toString(),
      longitude: placeToUse.longitude.toString(),
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

  // Format results for response
  const hotelSummaries = hotels.map((hotel: Hotel) => formatHotelToSummaryObject(hotel));

  return createYamlResponse({
    status: "success",
    total_hotels: total,
    results_count: hotels.length,
    selected_place: {
      id: placeToUse.place_id,
      name: placeToUse.structured_formatting?.main_text || placeToUse.description,
      location: placeToUse.description
    },
    hotels: hotelSummaries,
    message: "Show all the hotels summary to user, including the lowest price and the hotel name and locations, try to give the user a good overview of the hotels, and make the recommendations according to user's preferences.",
  });
}

/**
 * Get detailed information about a specific hotel
 */
export async function getHotelDetails(params: { hotel_id: string }) {
  // Check if hotel exists in session
  if (session.hotels[params.hotel_id]) {
    const hotel = session.hotels[params.hotel_id];
    const hotelDetail = formatHotelToDetailObject(hotel);

    return createYamlResponse({
      status: "success",
      hotel: hotelDetail,
    });
  } else {
    return createYamlResponse({
      status: "error",
      message: `Hotel with ID ${params.hotel_id} not found in session. Please use the search-hotels tool to find hotels first.`
    });
  }
}