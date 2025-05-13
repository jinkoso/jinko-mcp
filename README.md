# Hotel Booking MCP Server

A powerful MCP server that let developers add hotel shopping and booking capabilities within their agents. Access to 2 millions of hotels with live pricing and booking capabilities. Generate incremental revenue starting today.

MCP (Model Context Protocol) is an open protocol that standardizes how applications provide context to LLMs - think of it as a USB-C port for AI applications, connecting models to external data sources and tools.

## Features

1. **Session Creation**: Create a new booking session with location normalization
2. **Search Hotels**: Search for available hotels based on location, dates, hotel amenities
3. **Get Hotel Details**: Get all rooms and rate available for a specific Hotel ID
4. **Book Hotel**: Book a hotel by creating a quote and returning a payment link

## Session Management

The server maintains a session to store hotel search results, location information, and user preferences. This allows for efficient retrieval of hotel details without making additional API calls. The session includes:

- Conversation ID for tracking
- User language preference
- Currency and country code settings
- Confirmed place for hotel searches
- Alternative place suggestions
- Hotel search results cache

## Development

You can install the package globally:

```bash
npm install -g jinko-mcp
```

Or run it directly with npx:

```bash
npx jinko-mcp
```

## Running the Server

### Using npm

```bash
npm run start
```

### Using npx (after publishing)

```bash
npx jinko-mcp
```

The MCP server uses stdio transport, which means it can be used directly with MCP clients that support this transport type.

## Installation

You can install our MCP locally for now. Remote support is coming. For developers that want access to the production environment and earn commission on sales, please contact us via our website https://www.jinko.so/.

```bash
{
  "mcpServers": {
    "jinko-travel": {
      "command": "npx",
      "args": [
        "jinko-mcp-dev@latest"
      ]
    }
  }
}
```

## Tools

### 1. create-session

Create a new booking session and normalize place for hotel search.

**Parameters:**
- `place`: Location where user wants to search for hotels (e.g., 'New York', 'Paris', 'Tokyo')
- `raw_request` (optional): Summary of user's requirements in free text
- `language` (optional): The language used by user, following ISO 639 (e.g., 'en', 'fr', 'zh')
- `currency` (optional): Currency code (e.g., 'EUR', 'USD')
- `country_code` (optional): Country code (e.g., 'fr', 'us')

This tool creates a new session with a unique conversation ID and normalizes the place input for hotel searches. It returns the selected place, alternative place suggestions, and available facilities for filtering hotels.

### 2. search-hotels

Search for available hotels based on location, dates, and other criteria.

**Parameters:**
- `place_id` (optional): Optional place ID to override the default selected place
- `check_in_date`: Check-in date (YYYY-MM-DD), default: '2025-06-25'
- `check_out_date`: Check-out date (YYYY-MM-DD), default: '2025-06-26'
- `adults`: Number of adults, default: 2
- `children`: Number of children, default: 0
- `facilities` (optional): Facility IDs to filter hotels by, the IDs can be inferred with facilities resource

The tool uses the place selected during session creation by default, but you can override it by providing a specific place_id from the alternative places.

### 3. get-hotel-details

Get detailed information about a specific hotel by ID.

**Parameters:**
- `hotel_id`: ID of the hotel to get details for

This tool retrieves detailed information about a hotel found in the search results, including rooms, amenities, and policies.

### 4. book-hotel

Book a hotel by creating a quote and returning a payment link.

**Parameters:**
- `hotel_id`: ID of the hotel to book
- `rate_id`: ID of the room to book

This tool creates a booking quote for the specified hotel and room, and returns a payment link for the user to complete the booking.

## API Endpoints

The server uses the following API endpoints from the Jinko Travel BFF:

- `/api/v1/hotels/places/autocomplete`: Get place suggestions based on user input
- `/api/v1/hotels/availability`: Search for available hotels
- `/api/v1/hotels/{hotel_id}`: Get hotel details
- `/api/v1/booking/quote/schedule`: Schedule a quote
- `/api/v1/booking/quote/pull/{quote_id}`: Pull quote status and details

## Facilities Data

The server includes built-in facilities data to provide information about hotel amenities. This data is now directly embedded in the codebase as a constant in `const.ts`, making it more efficient and eliminating the need for external file loading.

The facilities data includes translations in multiple languages:
- English (en)
- Spanish (es)
- Italian (it)
- Hebrew (he)
- Arabic (ar)
- German (de)

Each facility includes:
- `facility_id`: Unique identifier for the facility
- `facility`: Name of the facility in English
- `sort`: Sort order for display
- `translation`: Array of translations in different languages

When creating a session, the available facilities are returned as part of the response, allowing LLMs to use the appropriate facility IDs when filtering hotel searches.

## Publishing to npm

To publish this package to npm, follow these steps:

1. Make sure you have an npm account and are logged in:
   ```bash
   npm login
   ```

2. Update the version number in package.json if needed (current version is 0.0.5):
   ```bash
   npm version patch  # or minor or major
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Publish to npm:
   ```bash
   npm publish
   ```

After publishing, users can install and run the package using npm or npx as described in the Installation section.

## Configuration

The server uses the following default configuration (defined in `config.ts`):

- API Base URL: `https://api.dev.jinkotravel.com`
- Default Market: `fr`
- Default Currency: `EUR`
- Default Country Code: `fr`

These defaults can be overridden when creating a session by providing the appropriate parameters.
