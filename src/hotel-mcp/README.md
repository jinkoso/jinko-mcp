# Hotel Booking MCP Server

This MCP (Machine Conversation Protocol) server provides tools for LLMs to search for hotels, get hotel details, and book hotels through the Jinko Travel BFF API.

## Features

1. **Search Hotels**: Search for available hotels based on location, dates, and other criteria
2. **Get Hotel Details**: Get detailed information about a specific hotel by ID
3. **Book Hotel**: Book a hotel by creating a quote and returning a payment link

## Tools

### 1. search-hotels

Search for available hotels based on location, dates, and other criteria.

**Parameters:**
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

### 2. get-hotel-details

Get detailed information about a specific hotel by ID.

**Parameters:**
- `hotel_id`: ID of the hotel to get details for

### 3. book-hotel

Book a hotel by creating a quote and returning a payment link.

**Parameters:**
- `hotel_id`: ID of the hotel to book
- `provider_id`: ID of the provider
- `check_in_date`: Check-in date (YYYY-MM-DD)
- `check_out_date`: Check-out date (YYYY-MM-DD)
- `opaque_rate_data`: Opaque rate data from availability response

## Session Management

The server maintains a session to store hotel search results, allowing for efficient retrieval of hotel details without making additional API calls.

## Resources

The server exposes the following resources:

1. **facilities**: Complete list of all hotel facilities with translations
2. **facilities-by-id**: Map of facilities indexed by their ID for easy lookup
3. **facility-{id}**: Individual facility by ID (e.g., facility-47 for WiFi)

These resources can be accessed using the MCP resources/read method.

## Running the Server

```bash
npm run start
```

The server will run on http://localhost:54117 by default.