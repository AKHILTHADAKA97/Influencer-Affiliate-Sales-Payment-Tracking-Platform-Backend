import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "Influencer", required: true },
    brandId: { type: String, required: true, index: true },
    totalAmount: { type: Number, required: true },
    commission: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "paid"],
      default: "pending"
    },
    razorpayPayoutId: { type: String },
    payoutDate: { type: Date }
  },
  { timestamps: true }
);

export const Payment = mongoose.model("Payment", paymentSchema);
