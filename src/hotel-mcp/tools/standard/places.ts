/**
 * Place-related tools for the hotel MCP server
 */
import { makeApiRequest, createYamlResponse } from "../../utils.js";
import { PlaceSuggestion, PlaceSummaryResponse } from "../../types.js";

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

  // Format results for YAML response
  const placeSummaries = autocompleteResult.predictions.map((place: PlaceSuggestion, index: number) => ({
    id: place.place_id,
    name: place.structured_formatting?.main_text || place.description,
    type: place.types || "Unknown",
    location: place.description || "",
    latitude: place.latitude,
    longitude: place.longitude,
  }));

  const response: PlaceSummaryResponse = {
    places: placeSummaries,
    count: autocompleteResult.predictions.length,
    message: "Found matching locations based on your search. Each result includes location coordinates that can be used with the search-hotels tool. If multiple locations match your query, please help the user select the most appropriate one based on their travel plans."
  };

  return createYamlResponse(response);
}
