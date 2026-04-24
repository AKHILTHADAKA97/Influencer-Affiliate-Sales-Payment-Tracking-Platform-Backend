import Razorpay from "razorpay";

const enabled = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
const razorpay = enabled
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })
  : null;

export async function createPayout({ amount, referenceId }) {
  if (!razorpay) {
    return { id: `mock_payout_${referenceId}`, mode: "mock" };
  }

  const payout = await razorpay.payouts.create({
    account_number: "23232300852323",
    amount: Math.round(amount * 100),
    currency: "INR",
    mode: "UPI",
    purpose: "payout",
    queue_if_low_balance: true,
    reference_id: referenceId,
    narration: "Influencer commission payout"
  });
  return { id: payout.id, mode: "razorpay" };
}
