/**
 * Hotel booking tools for the hotel MCP server
 */
import { makeApiRequest, createJsonResponse, pollForQuoteStatus } from "../utils.js";
import { session } from "../state.js";

/**
 * Book a hotel by creating a quote and returning payment link
 */
export async function bookHotel(params: { hotel_id: string; rate_id: string }) {
  // Check if hotel exists in session
  if (!session.hotels[params.hotel_id]) {
    return createJsonResponse({
      status: "error",
      message: `Hotel with ID ${params.hotel_id} not found in session. Please use the search-hotels tool to find hotels first.`
    });
  }

  const hotel = session.hotels[params.hotel_id];
  let room = null;
  let rate = null;

  // Find the room and rate
  for (const r of hotel.rooms) {
    for (const rt of r.rates) {
      if (rt.rate_id === params.rate_id) {
        room = r;
        rate = rt;
        break;
      }
    }
    if (room && rate) break;
  }

  if (!room || !rate) {
    return createJsonResponse({
      status: "error",
      message: `Room or rate with ID ${params.rate_id} not found in hotel ${params.hotel_id}.`
    });
  }

  // Create quote request
  const quoteRequest = {
    products: [
      {
        product_type: "hotel",
        provider_id: rate.provider_id,
        hotel_id: hotel.id.toString(),
        check_in_date: rate.check_in_date,
        check_out_date: rate.check_out_date,
        opaque_rate_data: rate.opaque,
      },
    ],
  };

  // Schedule quote
  const scheduleResponse = await makeApiRequest<any>(
    "/api/v1/booking/quote/schedule",
    "POST",
    quoteRequest
  );

  if (!scheduleResponse || !scheduleResponse.reference) {
    return createJsonResponse({
      status: "error",
      message: "Failed to schedule quote. Please try again later."
    });
  }

  const quoteId = scheduleResponse.reference;

  // Poll for quote status
  const quoteResult = await pollForQuoteStatus(quoteId);

    // Format quote information
  const paymentLink = `https://app.jinko.so/checkout/${quoteId}`;

  if (!quoteResult) {
    return createJsonResponse({
      status: "processing",
      message: `Quote is still processing. Please check the status and complete your booking using the following payment link.`,
      payment_link: paymentLink,
      quote_id: quoteId
    });
  }

  let productInfo = {
    status: "success",
    action: "N/A",
    hotel: "Unknown hotel",
    check_in: "N/A",
    check_out: "N/A",
    total_price: "N/A",
    payment_link: paymentLink,
    quote_id: quoteId
  };

  if (quoteResult.quoted_products && quoteResult.quoted_products.length > 0) {
    const product = quoteResult.quoted_products[0];
    productInfo = {
      status: "success",
      action: "Make sure the payment_link should be displayed to user, which allow them to click and pay the booking.",
      hotel: product.hotel_name || "Unknown hotel",
      check_in: product.check_in_date,
      check_out: product.check_out_date,
      total_price: `${product.rate_info.selling_price?.amount || "N/A"} ${product.rate_info.selling_price?.currency || "USD"}`,
      payment_link: paymentLink,
      quote_id: quoteId
    };
  }

  return createJsonResponse(productInfo);
}