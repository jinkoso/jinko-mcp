/**
 * Hotel booking tools for the hotel MCP server
 */
import { createYamlResponse, makeApiRequest, pollForQuoteStatus } from "../../utils.js";

/**
 * Book a hotel by creating a quote and returning payment link
 */
export async function bookHotel(params: { session_id: string, hotel_id: string; rate_id: string }) {
    // Create quote request
    const quoteRequest = {
      products: [
        {
          product_type: "hotel",
          hotel_id: params.hotel_id,
          search_session_id: params.session_id,
          rate_id: params.rate_id,
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
      return createYamlResponse({
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
      return createYamlResponse({
        status: "processing",
        message: `Your booking request is being processed. Please inform the user that they can proceed to complete their booking using the payment link provided below. The booking details will be finalized during the payment process.`,
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
        action: "IMPORTANT: Present the payment_link to the user so they can complete their booking by clicking the link and processing payment.",
        hotel: product.hotel_name || "Unknown hotel",
        check_in: product.check_in_date,
        check_out: product.check_out_date,
        total_price: `${product.rate_info.selling_price?.amount || "N/A"} ${product.rate_info.selling_price?.currency || "USD"}`,
        payment_link: paymentLink,
        quote_id: quoteId
      };
    }
  
    return createYamlResponse(productInfo);
}