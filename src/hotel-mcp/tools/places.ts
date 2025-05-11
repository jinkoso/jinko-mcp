/**
 * Place-related tools for the hotel MCP server
 */
import { makeApiRequest, createJsonResponse, loadFacilitiesData } from "../utils.js";
import { session } from "../state.js";
import { PlaceSuggestion, PlaceSummaryResponse } from "../types.js";
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_MARKET, DEFAULT_CURRENCY, DEFAULT_COUNTRY_CODE } from "../config.js";

const facilitiesData = loadFacilitiesData();

/**
 * Create a new session and normalize place for hotel search
 */
export async function createSession(params: {
  place: string;
  raw_request?: string;
  language?: string;
  currency?: string;
  country_code?: string;
}) {
  // Reset session data to start fresh
  session.hotels = {};
  session.placeSuggestions = [];
  session.confirmedPlace = null;
  session.language = params.language || "en";
  
  // Generate a UUID for the conversation_id
  session.conversation_id = uuidv4();
  
  // Set context information from config and params
  session.user_ip_address = "127.0.0.1"; // Will be detected automatically by backend
  session.market = DEFAULT_MARKET;
  session.currency = params.currency || DEFAULT_CURRENCY;
  session.country_code = params.country_code || DEFAULT_COUNTRY_CODE;

  // Validate place parameter
  if (!params.place || params.place.trim() === "") {
    return createJsonResponse({
      status: "error",
      message: "Place parameter is required for creating a session."
    });
  }

  // Make API request to get place suggestions
  const request = {
    "input": params.place,
    "language": "en",
  };

  const autocompleteResult = await makeApiRequest<any>(
    "/api/v1/hotels/places/autocomplete",
    "POST",
    request,
  );

  if (!autocompleteResult) {
    return createJsonResponse({
      status: "error",
      message: "Failed to retrieve place suggestions. Please try again with a different query."
    });
  }

  if (!autocompleteResult.predictions || autocompleteResult.predictions.length === 0) {
    return createJsonResponse({
      status: "empty",
      message: "No places found matching your query. Please try a different search term."
    });
  }

  // Store place suggestions in session
  session.placeSuggestions = autocompleteResult.predictions;

  // Format results for response
  const placeSummaries = autocompleteResult.predictions.map((place: PlaceSuggestion, index: number) => ({
    id: place.place_id,
    name: place.structured_formatting?.main_text || place.description,
    type: place.types || "Unknown",
    location: place.description || ""
  }));

  // Automatically select the first place if available
  if (autocompleteResult.predictions.length > 0) {
    session.confirmedPlace = autocompleteResult.predictions[0];
  }

  // Prepare response with helpful information
  const available_facilities = facilitiesData.map((facility: any) => {
    // Try to find translation for the current session language
    const translation = facility.translation?.find(
      (t: any) => t.lang === session.language
    );
    return {
      id: facility.facility_id,
      name: translation?.facility || facility.facility
    };
  });
  const response = {
    status: "success",
    session_created: true,
    user_request: params.raw_request || null,
    selected_place: {
      id: session.confirmedPlace?.place_id,
      name: session.confirmedPlace?.structured_formatting?.main_text || session.confirmedPlace?.description,
      location: session.confirmedPlace?.description
    },
    alternative_places: placeSummaries,
    next_steps: [
      "Use search-hotels to find hotels in the selected place",
      "You can specify place_id in search-hotels to use a different place from alternative_places",
      "You can use the available_facilities list to find the right facilities id to filter hotels by facilities in search-hotels",
    ],
    available_facilities: available_facilities,
    context: {
      conversation_id: session.conversation_id,
      user_ip_address: session.user_ip_address,
      market: session.market,
      language: session.language,
      currency: session.currency,
      country_code: session.country_code,
    }
  };

  return createJsonResponse(response);
}

/**
 * Get place suggestions based on user input
 */
export async function autocompletePlaces(params: { query: string; language?: string }) {
  // Make API request to get place suggestions
  const request = {
    "input": params.query,
    "language": "en",
  };

  if (params.language) {
    request.language = params.language;
  }

  const autocompleteResult = await makeApiRequest<any>(
    "/api/v1/hotels/places/autocomplete",
    "POST",
    request,
  );

  if (!autocompleteResult) {
    return createJsonResponse({
      status: "error",
      message: "Failed to retrieve place suggestions. Please try again with a different query."
    });
  }

  if (!autocompleteResult.predictions || autocompleteResult.predictions.length === 0) {
    return createJsonResponse({
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

  return createJsonResponse(response);
}

/**
 * Confirm a place from the suggestions for hotel search
 */
export async function confirmPlace(params: { place_id: string }) {
  // Check if we have place suggestions
  if (session.placeSuggestions.length === 0) {
    return createJsonResponse({
      status: "error",
      message: "No place suggestions available. Please use the autocomplete-place tool first."
    });
  }

  // Find the place in suggestions
  const selectedPlace = session.placeSuggestions.find((place: any) => place.place_id === params.place_id);

  if (!selectedPlace) {
    return createJsonResponse({
      status: "error",
      message: `Place with ID ${params.place_id} not found in the suggestions. Please use a valid place ID from the autocomplete results.`
    });
  }

  // Store the confirmed place
  session.confirmedPlace = selectedPlace;

  return createJsonResponse({
    status: "success",
    place: {
      id: selectedPlace.place_id,
      name: selectedPlace.structured_formatting?.main_text || selectedPlace.description,
      location: selectedPlace.description,
    },
    message: "Place confirmed. You can now use the search-hotels tool to find hotels in this location."
  });
}