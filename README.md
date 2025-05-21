# Hotel Booking MCP Server

We are the first MCP server to give access to 2 millions of hotels with shopping and booking capabilities. You can integrate our MCP and start to sell within minutes in your agents. The prod version is available on request by requesting it on our website https://www.jinko.so/. Feel free to reach out!

MCP (Model Context Protocol) is an open protocol that standardizes how applications provide context to LLMs - think of it as a USB-C port for AI applications, connecting models to external data sources and tools.

## Features

1. **Find Place**: Convert user's location query into standardized place information with coordinates
2. **Search Hotels**: Search for available hotels based on location coordinates and booking requirements
3. **Get Hotel Details**: Get comprehensive details about a specific hotel
4. **Book Hotel**: Book a hotel by creating a quote and returning a payment link
5. **Get Facilities**: Retrieve hotel facilities in different languages for filtering searches

## Development

You can install the package globally:

```bash
npm install -g jinko-mcp-dev
```

Or run it directly with npx:

```bash
npx jinko-mcp-dev
```

## Running the Server

### Using npm

```bash
npm run start
```

### Using npx (after publishing)

```bash
npx jinko-mcp-dev
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

### 1. find-place

Convert a user's location query into standardized place information with coordinates.

**Parameters:**
- `query`: User's input for place search (e.g., 'New York', 'Paris', 'Tokyo')
- `language` (optional): Language for the place search, default: 'en'

This tool is essential when you need latitude and longitude for hotel searches but only have a text description. It accepts city names, hotel names, landmarks, or other location identifiers and returns a list of matching places with their details and precise coordinates.

### 2. search-hotels

Search for available hotels based on location coordinates and booking requirements.

**Parameters:**
- `latitude`: Latitude of the location
- `longitude`: Longitude of the location
- `check_in_date`: Check-in date (YYYY-MM-DD), default: '2025-06-25'
- `check_out_date`: Check-out date (YYYY-MM-DD), default: '2025-06-26'
- `adults`: Number of adults, default: 2
- `children`: Number of children, default: 0
- `facilities` (optional): Facility IDs to filter hotels by, the IDs can be inferred with facilities resource

This tool returns a paginated list of hotels with their key details including name, address, star rating, price range, and available room types. Each hotel includes summary information about amenities and available rates. The results are limited to 50 hotels per request.

### 3. load-more-hotels

Retrieve additional hotel results from a previous search using the session_id.

**Parameters:**
- `session_id`: Session ID from a previous search-hotels or load-more-hotels response

This tool continues pagination from a previous search-hotels request, returning the next batch of hotels with the same format and details as the original search.

### 4. get-hotel-details

Retrieve comprehensive details about a specific hotel identified by its ID.

**Parameters:**
- `session_id`: The session ID from a previous search
- `hotel_id`: ID of the hotel to get details for

This tool provides more extensive information than what's available in search results, including complete descriptions, all available room types, detailed rate information, cancellation policies, and full amenity lists.

### 5. book-hotel

Initiate a hotel booking process for a specific hotel and rate option.

**Parameters:**
- `session_id`: The session ID from a previous search
- `hotel_id`: ID of the hotel to book
- `rate_id`: ID of the specific rate option the user has selected

This tool creates a booking quote for the specified hotel and room, and returns a payment link for the user to complete the booking.

### 6. get-facilities

Retrieve a list of hotel facilities in the specified language.

**Parameters:**
- `language`: Language code for facility names (en, es, it, he, ar, de), default: 'en'

This tool must be called before search-hotels whenever the user mentions specific hotel amenities or requirements. It returns facility IDs that must be used with the search-hotels tool's facilities parameter to properly filter hotels.

## Resources

The standard server provides hotel facilities data as resources in multiple languages:

- English (en)
- Spanish (es)
- Italian (it)
- Hebrew (he)
- Arabic (ar)
- German (de)

These resources can be accessed using the `hotel://facilities/{language}` URI pattern, where `{language}` is one of the supported language codes.

## Facilities Data

The server includes built-in facilities data to provide information about hotel amenities. This data is used to filter hotel searches based on specific amenities requested by users.

Each facility includes:
- `facility_id`: Unique identifier for the facility
- `facility`: Name of the facility in English
- `sort`: Sort order for display
- `translation`: Array of translations in different languages

When using the `get-facilities` tool, the available facilities are returned as part of the response, allowing LLMs to use the appropriate facility IDs when filtering hotel searches with the `search-hotels` tool.

## Workflow Example

A typical workflow for using the standard server would be:

1. Use `find-place` to convert a user's location query into coordinates
2. Use `get-facilities` to identify facility IDs for any amenities the user requested
3. Use `search-hotels` with the coordinates and facility IDs to find matching hotels
4. Use `load-more-hotels` if more results are needed beyond the initial 50
5. Use `get-hotel-details` to retrieve comprehensive information about a specific hotel
6. Use `book-hotel` to initiate the booking process and generate a payment link

## Publishing to npm

To publish this package to npm, follow these steps:

1. Make sure you have an npm account and are logged in:
   ```bash
   npm login
   ```

2. Update the version number in package.json:
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
