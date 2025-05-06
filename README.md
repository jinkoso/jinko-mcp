# Hotel Booking MCP Server

This repository contains a Machine Conversation Protocol (MCP) server for hotel booking, which allows LLMs to search for hotels, get hotel details, and book hotels through the Jinko Travel BFF API.

## Features

1. **Place Autocomplete**: Get place suggestions based on user input
2. **Place Confirmation**: Confirm a place from the suggestions for hotel search
3. **Search Hotels**: Search for available hotels based on location, dates, and other criteria
4. **Get Hotel Details**: Get detailed information about a specific hotel by ID
5. **Book Hotel**: Book a hotel by creating a quote and returning a payment link

## Session Management

The server maintains a session to store hotel search results, allowing for efficient retrieval of hotel details without making additional API calls.

## Running the Server

```bash
npm run start
```

The server will run on http://localhost:54117. This MCP server uses the HttpServerTransport, which allows it to be accessed by LLM clients that support the MCP protocol.

## Tools

### 1. autocomplete-place

Get place suggestions based on user input.

**Parameters:**
- `query`: User's input for place search (e.g., 'New York', 'Paris', 'Tokyo')

This tool returns a list of place suggestions matching the user's query. If only one place is found, it's automatically confirmed. If multiple places are found, the user needs to confirm their choice using the confirm-place tool.

### 2. confirm-place

Confirm a place from the suggestions for hotel search.

**Parameters:**
- `place_id`: ID of the place to confirm from the suggestions

This tool confirms a place from the suggestions returned by the autocomplete-place tool. The confirmed place will be used for hotel searches.

### 3. search-hotels

Search for available hotels based on location, dates, and other criteria.

**Parameters:**
- `use_confirmed_place` (optional): Whether to use the confirmed place from autocomplete (default: false)
- `location` (optional): Center point for proximity search
  - `latitude`: Latitude coordinate
  - `longitude`: Longitude coordinate
- `radius_km` (optional): Search radius in kilometers
- `city` (optional): City name to search in
- `country` (optional): Country code (e.g., US, FR)
- `check_in_date`: Check-in date (YYYY-MM-DD)
- `check_out_date`: Check-out date (YYYY-MM-DD)
- `adults`: Number of adults (default: 2)
- `children`: Number of children (default: 0)
- `min_ranking` (optional): Minimum hotel ranking (1-5 stars)
- `tags` (optional): Tags to filter hotels by
- `facilities` (optional): Facility IDs to filter hotels by

When `use_confirmed_place` is set to true, the tool will use the place confirmed by the confirm-place tool for the search.

### 4. get-hotel-details

Get detailed information about a specific hotel by ID.

**Parameters:**
- `hotel_id`: ID of the hotel to get details for

### 5. book-hotel

Book a hotel by creating a quote and returning a payment link.

**Parameters:**
- `hotel_id`: ID of the hotel to book
- `provider_id`: ID of the provider
- `check_in_date`: Check-in date (YYYY-MM-DD)
- `check_out_date`: Check-out date (YYYY-MM-DD)
- `opaque_rate_data`: Opaque rate data from availability response

## API Endpoints

The server uses the following API endpoints from the Jinko Travel BFF:

- `/api/v1/hotels/places/autocomplete`: Get place suggestions based on user input
- `/api/v1/hotels/availability`: Search for available hotels
- `/api/v1/hotels/{hotel_id}`: Get hotel details
- `/api/v1/booking/quote/schedule`: Schedule a quote
- `/api/v1/booking/quote/pull/{quote_id}`: Pull quote status and details

## Facilities Data

The server uses the facilities data from `facilities.json` to provide information about hotel facilities. This data is exposed as a resource in the MCP server, allowing LLMs to access it directly.

### Available Resources

- `hotel:///facilities` - List of all available hotel facilities with translations

This resource can be accessed using the MCP resources/read method.

### HTTP Server for Facilities

For testing and development purposes, you can also run a simple HTTP server to access the facilities data:

```bash
# Run the HTTP server
node run-facilities-http.js
```

#### Available Endpoints

- `GET /facilities` - Returns a list of all available hotel facilities with translations
- `GET /facilities/{facility_id}` - Returns details of a specific hotel facility by ID
- `GET /facilities/language/{lang}` - Returns all facilities translated to a specific language

#### Example Usage

- http://localhost:59106/facilities
- http://localhost:59106/facilities/47
- http://localhost:59106/facilities/language/en
- http://localhost:59106/facilities/language/es
- http://localhost:59106/facilities/language/de