// DEPRECATED: This payment service is no longer used
// The application now uses Trakteer for donations
// This file is kept for reference but can be removed if not needed elsewhere

const axios = require('axios');

// Get config from environment variables
const PAKASIR_API_URL = process.env.PAKASIR_API_URL || 'https://app.pakasir.com/api';
const PAKASIR_PROJECT = process.env.PAKASIR_PROJECT || 'webcheckerforwebstreaming';

const pakasirApi = axios.create({
  baseURL: PAKASIR_API_URL,
  headers: {
    'Accept': 'application/json',
    'User-Agent': 'KitaNime/1.0 (DonationService)'
  }
});

/**
 * Creates a donation transaction and returns payment details.
 * @param {number} amount The donation amount.
 * @returns {object} An object containing qrcode and expiry date.
 */
async function createDonation(amount) {
  if (!amount || amount <= 0) {
    throw new Error('Invalid donation amount.');
  }

  try {
    // 1. Create a new transaction
    const transactionPayload = {
      project: PAKASIR_PROJECT,
      amount: parseInt(amount, 10),
      order_id: `DKN-${Math.floor(Date.now() / 1000)}-${Math.random().toString(36).slice(2, 6)}`
    };

    const transactionResponse = await pakasirApi.post('/transactions', transactionPayload);
    const transactionId = transactionResponse.data?.transaction?.id;

    if (!transactionId) {
      throw new Error('Failed to get transaction ID from payment gateway.');
    }

    // 2. Request QRIS payment for the transaction
    const paymentPayload = {
      payment_method: 'qris'
    };

    const paymentResponse = await pakasirApi.post(`/transactions/${transactionId}/payment`, paymentPayload);
    const paymentData = paymentResponse.data?.transaction;

    if (!paymentData || !paymentData.payment_number) {
      throw new Error('Failed to get QR code from payment gateway.');
    }

    // 3. Format the expiry date
    const expiryDate = new Date(paymentData.payment_number_expires_at);
    const options = {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    };
    const formattedExpiry = expiryDate.toLocaleString('id-ID', options);

    return {
      qrcode: paymentData.payment_number,
      expired: formattedExpiry
    };

  } catch (error) {
    console.error('Payment Service Error:', error.response?.data || error.message);
    // Re-throw a more generic error to be handled by the route
    throw new Error('Failed to process donation. The payment gateway might be down.');
  }
}

module.exports = { createDonation };
