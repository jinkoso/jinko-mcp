/**
 * Types and interfaces for the hotel MCP server
 */

/**
 * Session storage to keep track of hotel search results and place suggestions
 */
export interface SessionData {
  hotels: Record<string, Hotel>;
  placeSuggestions: PlaceSuggestion[];
  confirmedPlace: PlaceSuggestion | null;
}

export interface Hotel {
  id: string | number;
  name: string;
  star_rating?: number;
  address?: string;
  description?: string;

  // Added fields
  main_photo?: string;
  rating?: number | null;

  images?: Array<{
    type: string;
    path: string;
    order: number;
  }>;

  policies?: Array<{
    type: string;    // 'check_in', 'check_out', 'contact', etc.
    name: string;
    description: string[];
  }>;

  // Enhanced amenities with additional fields
  amenities: Array<{
    name: string;
    id?: number;
    code?: string;
    description?: string | null;
    amount?: string | null;
  }>;

  rooms: HotelRoom[];

  // Updated price fields to handle string values
  min_price?: {
    value: string | number;
    currency: string;
  };

  max_price?: {
    value: string | number;
    currency: string;
  };
}

export interface HotelRoom {
  room_id: string;
  room_name: string;
  description?: string;
  max_occupancy?: number | null;

  beds?: Array<{
    type: string;
    count: number;
  }>;

  amenities?: Array<{
    code: string;
    name: string;
    description: string | null;
    amount: string | null;
  }>;

  images?: Array<{
    type: string;
    path: string;
    order: number | null;
  }>;

  min_price?: {
    value: string | number;
    currency: string;
  };

  max_price?: {
    value: string | number;
    currency: string;
  };

  lowest_rate: {
    rate_id: string;
    check_in_date?: string;
    check_out_date?: string;
    provider_id?: string;
    description?: string;
    selling_price?: {
      value: string | number;
      currency: string;
    };
    tax_and_fee?: {
      value: string | number;
      currency: string;
    };
    base_price?: {
      value: string | number;
      currency: string;
    };
    is_refundable?: boolean;
    policies?: Array<{
      type: string;
      name: string;
      description: string[];
    }>;
    opaque?: string;
  };

  rates: Array<{
    rate_id: string;
    check_in_date?: string;
    check_out_date?: string;
    provider_id?: string;
    description?: string;
    selling_price?: {
      value: string | number;
      currency: string;
    };
    tax_and_fee?: {
      value: string | number;
      currency: string;
    };
    base_price?: {
      value: string | number;
      currency: string;
    };
    is_refundable: boolean;
    policies?: Array<{
      type: string;
      name: string;
      description: string[];
    }>;
    opaque?: string;
  }>;
}

export interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
  };
  types?: string[];
  latitude: number;
  longitude: number;
}

export interface QuoteProduct {
  hotel_name: string;
  check_in_date: string;
  check_out_date: string;
  rate_info: {
    selling_price?: {
      amount: number;
      currency: string;
    }
  }
}

export interface QuoteResult {
  quoted_products: QuoteProduct[];
  status: string;
  error?: string;
}

// Enhanced interface for hotel summary (search results)
export interface HotelSummary {
  id: string | number;
  name: string;
  ranking: string;
  location: string;
  price: string;
  images: string[]; // Array of image URLs (max 3)
  lowest_rate: {
    room_id: string;
    room_name: string;
    rate_id: string;
    price: string;
    is_refundable: boolean;
    payment_type: string;
    meal_plan?: string;
  };
}

// Enhanced interface for hotel details
export interface HotelDetail {
  id: string | number;
  name: string;
  ranking: string;
  location: string;
  description?: string;
  facilities: string[];
  images: string[]; // All hotel images
  check_in?: string;
  check_out?: string;
  rooms: Array<{
    room_id: string;
    room_name: string;
    description?: string;
    images: string[];
    amenities: string[];
    max_occupancy?: number;
    rates: Array<{
      rate_id: string;
      description: string;
      price: string;
      is_refundable: boolean;
      cancellation_policy?: string[];
      meal_plan?: string;
      payment_type: string; // "Pay Now" or "Pay Later"
    }>;
  }>;
}

export interface PlaceSummaryResponse {
  places: Array<{
    id: string;
    name: string;
    type: string;
    location: string;
  }>;
  count: number;
  message: string;
}

export interface BookingQuoteResponse {
  status: string;
  action: string;
  hotel: string;
  check_in: string;
  check_out: string;
  total_price: string;
  payment_link: string;
  quote_id: string;
}