/**
 * Formatting functions for hotel data
 */
import { Hotel, HotelDetail, HotelSummary } from "./types.js";

/**
 * Format hotel to a summary object for search results
 * @param hotel Hotel object to format
 * @returns Formatted hotel summary object with images and lowest rate info
 */
export function formatHotelToSummaryObject(hotel: Hotel): HotelSummary {
  // Get up to 3 images (main photo first)
  const images: string[] = [];

  // Add main photo if exists
  if (hotel.main_photo) {
    images.push(hotel.main_photo);
  }

  // Add up to 2 more photos from images array
  if (hotel.images && hotel.images.length > 0) {
    const additionalImages = hotel.images
      .filter((img: any) => img.path !== hotel.main_photo) // Exclude main photo if already added
      .slice(0, images.length === 0 ? 3 : (3 - images.length))
      .map((img: any) => img.path);

    images.push(...additionalImages);
  }

  // Find the room with the lowest rate
  let lowestRateRoom = {
    room_id: "",
    room_name: "",
    rate_id: "",
    price: `${hotel.min_price?.value || "N/A"} ${hotel.min_price?.currency || "USD"}`,
    is_refundable: false,
    payment_type: "Pay Now"
  };

  if (hotel.rooms && hotel.rooms.length > 0) {
    // Sort rooms by min_price to find the cheapest
    const sortedRooms = [...hotel.rooms].sort((a, b) => {
      const priceA = a.min_price ? Number(a.min_price.value) : Infinity;
      const priceB = b.min_price ? Number(b.min_price.value) : Infinity;
      return priceA - priceB;
    });

    const cheapestRoom = sortedRooms[0];

    if (cheapestRoom && cheapestRoom.lowest_rate) {
      // Find the associated rate
      const rate = cheapestRoom.rates?.find((r: any) => r.rate_id === cheapestRoom.lowest_rate.rate_id);

      // Extract meal plan from rate if available
      let mealPlan: string | undefined;
      let paymentType = "Pay Now";

      if (rate?.opaque) {
        try {
          const rateData = JSON.parse(rate.opaque);
          mealPlan = rateData.meal_plan?.description;
          paymentType = rateData.pricing?.pricing_type === "pay_later" ? "Pay Later" : "Pay Now";
        } catch (e) {
          // Ignore parsing errors
        }
      }

      lowestRateRoom = {
        room_id: cheapestRoom.room_id,
        room_name: cheapestRoom.room_name,
        rate_id: cheapestRoom.lowest_rate.rate_id,
        price: `${cheapestRoom.min_price?.value || "N/A"} ${cheapestRoom.min_price?.currency || "USD"}`,
        is_refundable: rate?.is_refundable || false,
        payment_type: paymentType,
      };
    }
  }

  return {
    id: hotel.id,
    name: hotel.name,
    ranking: `${hotel.star_rating || "N/A"} stars`,
    location: hotel.address || "Unknown location",
    price: `From ${hotel.min_price?.value || "N/A"} ${hotel.min_price?.currency || "USD"}`,
    images,
    lowest_rate: lowestRateRoom
  };
}

/**
 * Format hotel to a detail object with complete room and rate information
 * @param hotel Hotel object to format
 * @returns Formatted hotel detail object
 */
export function formatHotelToDetailObject(hotel: Hotel): HotelDetail {
  if (!hotel) {
    return {
      id: "unknown",
      name: "Unknown Hotel",
      ranking: "N/A",
      location: "N/A",
      facilities: [],
      images: [],
      rooms: []
    };
  }

  // Get all hotel images
  const images = hotel.images ? hotel.images.map((img: any) => img.path) : [];

  // If main photo exists and not already in images, add it to the beginning
  if (hotel.main_photo && !images.includes(hotel.main_photo)) {
    images.unshift(hotel.main_photo);
  }

  // Format facilities
  const facilities = hotel.amenities.filter((amenity: any) =>
    !amenity.name.includes("Unknown Facility")
  ).map((amenity: any) => amenity.name);

  // Get check-in/check-out times
  let checkIn: string | undefined;
  let checkOut: string | undefined;

  if (hotel.policies) {
    const checkInPolicy = hotel.policies.find((p: any) => p.type === 'check_in');
    const checkOutPolicy = hotel.policies.find((p: any) => p.type === 'check_out');

    checkIn = checkInPolicy?.description?.[0];
    checkOut = checkOutPolicy?.description?.[0];
  }

  // Format rooms with all rates
  const rooms = hotel.rooms ? hotel.rooms.map((room: any) => {
    // Get room images
    const roomImages = room.images ? room.images.map((img: any) => img.path) : [];

    // Get room amenities
    const roomAmenities = room.amenities ?
      room.amenities
        .filter((a: any) => !a.name.includes("Unknown"))
        .map((a: any) => a.name) :
      [];

    // Format all rates for the room
    const rates = room.rates ? room.rates.map((rate: any) => {
      // Extract meal plan if available
      let mealPlan: string | undefined;
      let paymentType = rate.description || "Pay Now";

      try {
        if (rate.opaque) {
          const rateData = JSON.parse(rate.opaque);
          mealPlan = rateData.meal_plan?.description;

          // Determine payment type from opaque data if available
          if (rateData.pricing && rateData.pricing.pricing_type) {
            paymentType = rateData.pricing.pricing_type === "pay_later" ? "Pay Later" : "Pay Now";
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }

      return {
        rate_id: rate.rate_id,
        description: rate.description || "",
        price: `${rate.selling_price?.value || "N/A"} ${rate.selling_price?.currency || "USD"}`,
        is_refundable: rate.is_refundable || false,
        cancellation_policy: rate.policies?.find((p: any) => p.type === 'cancellation')?.description,
        meal_plan: mealPlan,
        payment_type: paymentType
      };
    }) : [];

    return {
      room_id: room.room_id,
      room_name: room.room_name,
      description: room.description,
      images: roomImages,
      amenities: roomAmenities,
      max_occupancy: room.max_occupancy == null ? undefined : room.max_occupancy,
      rates
    };
  }) : [];

  // Return structured hotel detail object
  return {
    id: hotel.id,
    name: hotel.name,
    ranking: `${hotel.star_rating || "N/A"} stars`,
    location: hotel.address || "Unknown location",
    description: hotel.description,
    facilities,
    images,
    check_in: checkIn,
    check_out: checkOut,
    rooms
  };
}