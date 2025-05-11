/**
 * Place-related tools for the hotel MCP server
 */
import { makeApiRequest, createJsonResponse } from "../utils.js";
import { session } from "../state.js";
import { PlaceSuggestion, PlaceSummaryResponse } from "../types.js";

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