import express from "express";
import { authRequired, allowRoles } from "../middleware/auth.js";
import { Payment } from "../models/Payment.js";
import { Sale } from "../models/Sale.js";
import { Influencer } from "../models/Influencer.js";
import { createPayout, createOrder, verifyPaymentSignature, getRazorpayKeyId } from "../services/paymentService.js";
import { emitEvent } from "../sockets/index.js";
import PDFDocument from "pdfkit";
import crypto from "crypto";
import { resolveTenantContext, requireBrand } from "../utils/tenant.js";

const router = express.Router();

router.get("/key", (_req, res) => {
  return res.json({ keyId: getRazorpayKeyId() });
});

router.post("/create-order", async (req, res) => {
  try {
    const { referralCode, amount, productId = "product_demo" } = req.body;
    const numericAmount = Number(amount);
    if (!referralCode || !numericAmount || numericAmount <= 0) {
      return res.status(400).json({ message: "referralCode and valid amount are required" });
    }

    const influencer = await Influencer.findOne({ referralCode });
    if (!influencer) return res.status(404).json({ message: "Invalid referral code" });

    const receipt = `rcpt_${Date.now()}`;
    const order = await createOrder({
      amount: numericAmount,
      receipt,
      notes: { referralCode, influencerId: influencer._id.toString(), productId }
    });

    const commissionPercent = Number(process.env.COMMISSION_PERCENT || 10);
    const commission = (numericAmount * commissionPercent) / 100;

    const payment = await Payment.create({
      influencerId: influencer._id,
      brandId: influencer.brandId,
      totalAmount: numericAmount,
      commission,
      status: "initiated",
      orderId: order.id,
      initiatedAt: new Date(),
      gatewayMeta: {
        channel: "razorpay_checkout",
        receipt,
        productId,
        referralCode
      }
    });

    emitEvent("payment.updated", { id: payment._id.toString(), status: payment.status });

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency || "INR",
      referralCode,
      influencerId: influencer._id.toString(),
      paymentId: payment._id.toString(),
      status: payment.status
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Unable to create order" });
  }
});

router.post("/verify-payment", async (req, res) => {
  try {
    const {
      referralCode,
      amount,
      productId = "product_demo",
      orderId,
      paymentId,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (!referralCode || !amount || !orderId || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment verification fields" });
    }

    const influencer = await Influencer.findOne({ referralCode });
    if (!influencer) return res.status(404).json({ message: "Invalid referral code" });

    const payment =
      (paymentId && (await Payment.findById(paymentId))) ||
      (await Payment.findOne({ orderId, influencerId: influencer._id }).sort({ createdAt: -1 }));

    if (!payment) {
      return res.status(404).json({ message: "Payment session not found. Please retry checkout." });
    }

    const valid = verifyPaymentSignature({
      orderId,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    if (!valid) {
      payment.status = "failed";
      payment.failureReason = "Payment signature verification failed";
      payment.failedAt = new Date();
      payment.gatewayMeta = {
        ...(payment.gatewayMeta || {}),
        verification: "failed"
      };
      await payment.save();
      emitEvent("payment.updated", { id: payment._id.toString(), status: payment.status });
      return res.status(400).json({ message: "Payment signature verification failed", payment });
    }

    const numericAmount = Number(amount);
    const orderRef = String(orderId || "").replace(/[^a-zA-Z0-9_-]/g, "");
    const sale = await Sale.create({
      influencerId: influencer._id,
      brandId: influencer.brandId,
      referralCode,
      amount: numericAmount,
      productId,
      orderId: `RPY-${orderRef}`
    });

    payment.status = "pending";
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.paymentCapturedAt = new Date();
    payment.failureReason = undefined;
    payment.failedAt = undefined;
    payment.gatewayMeta = {
      ...(payment.gatewayMeta || {}),
      verification: "success"
    };
    await payment.save();

    emitEvent("sale.created", { saleId: sale._id.toString(), amount: numericAmount, commission: payment.commission });
    emitEvent("payment.updated", { id: payment._id.toString(), status: payment.status });

    return res.json({ ok: true, sale, payment });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Payment verification failed" });
  }
});

router.get("/history", authRequired, async (req, res) => {
  try {
    const context = await resolveTenantContext(req);
    const brandId = requireBrand(context.brandId);
    const filter =
      req.user.role === "influencer"
        ? { influencerId: req.query.influencerId || context.influencerId, brandId }
        : { brandId };
    const payments = await Payment.find(filter).sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

router.patch("/approve/:id", authRequired, allowRoles("admin", "finance"), async (req, res) => {
  try {
    const context = await resolveTenantContext(req);
    const brandId = requireBrand(context.brandId);
    const payment = await Payment.findOne({ _id: req.params.id, brandId });
    if (!payment) return res.status(404).json({ message: "Payment not found in your tenant" });

    if (payment.status === "paid") {
      return res.status(400).json({ message: "Payment is already paid" });
    }

    if (payment.status === "failed" || payment.status === "cancelled") {
      return res.status(400).json({ message: `Cannot process payment in '${payment.status}' state` });
    }

    // "Make Paid" from UI should directly process via payout to avoid extra manual step confusion
    payment.status = "processing";
    payment.processingAt = new Date();
    await payment.save();
    emitEvent("payment.updated", { id: payment._id.toString(), status: payment.status });

    try {
      const payout = await createPayout({ amount: payment.commission, referenceId: payment._id.toString() });
      payment.status = "paid";
      payment.approvedAt = payment.approvedAt || new Date();
      payment.payoutDate = new Date();
      payment.paidAt = new Date();
      payment.razorpayPayoutId = payout.id;
      payment.failureReason = undefined;
      payment.failedAt = undefined;
      payment.gatewayMeta = {
        ...(payment.gatewayMeta || {}),
        payoutMode: payout?.mode,
        payoutStatus: payout?.status
      };
      await payment.save();
      emitEvent("payment.updated", { id: payment._id.toString(), status: payment.status });
      return res.json(payment);
    } catch (payoutErr) {
      payment.status = "failed";
      payment.failureReason = payoutErr.message || "Payout failed";
      payment.failedAt = new Date();
      await payment.save();
      emitEvent("payment.updated", { id: payment._id.toString(), status: payment.status });
      return res.status(500).json({ message: payment.failureReason, payment });
    }
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

router.post("/process/:id", authRequired, allowRoles("admin", "finance"), async (req, res) => {
  try {
    const context = await resolveTenantContext(req);
    const brandId = requireBrand(context.brandId);
    const payment = await Payment.findOne({ _id: req.params.id, brandId });
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (payment.status !== "approved") return res.status(400).json({ message: "Payment must be approved first" });

    payment.status = "processing";
    payment.processingAt = new Date();
    await payment.save();
    emitEvent("payment.updated", { id: payment._id.toString(), status: payment.status });

    try {
      const payout = await createPayout({ amount: payment.commission, referenceId: payment._id.toString() });
      payment.status = "paid";
      payment.payoutDate = new Date();
      payment.paidAt = new Date();
      payment.razorpayPayoutId = payout.id;
      payment.failureReason = undefined;
      payment.failedAt = undefined;
      payment.gatewayMeta = {
        ...(payment.gatewayMeta || {}),
        payoutMode: payout?.mode,
        payoutStatus: payout?.status
      };
      await payment.save();
      emitEvent("payment.updated", { id: payment._id.toString(), status: payment.status });
      return res.json(payment);
    } catch (payoutErr) {
      payment.status = "failed";
      payment.failureReason = payoutErr.message || "Payout failed";
      payment.failedAt = new Date();
      await payment.save();
      emitEvent("payment.updated", { id: payment._id.toString(), status: payment.status });
      return res.status(500).json({ message: payment.failureReason, payment });
    }
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

router.get("/export/csv", authRequired, allowRoles("admin", "finance"), async (_req, res) => {
  try {
    const context = await resolveTenantContext(_req);
    const brandId = requireBrand(context.brandId);
    const payments = await Payment.find({ brandId }).sort({ createdAt: -1 });
    const rows = [
      "payment_id,influencer_id,total_amount,commission,status,payout_date,created_at",
      ...payments.map((p) =>
        [
          p._id,
          p.influencerId,
          p.totalAmount,
          p.commission,
          p.status,
          p.payoutDate ? new Date(p.payoutDate).toISOString() : "",
          new Date(p.createdAt).toISOString()
        ].join(",")
      )
    ];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=payments-report.csv");
    res.send(rows.join("\n"));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

router.get("/export/pdf", authRequired, allowRoles("admin", "finance"), async (_req, res) => {
  try {
    const context = await resolveTenantContext(_req);
    const brandId = requireBrand(context.brandId);
    const payments = await Payment.find({ brandId }).sort({ createdAt: -1 });
    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=payments-report.pdf");
    doc.pipe(res);

    doc.fontSize(18).text("Payments Report");
    doc.moveDown();
    doc.fontSize(11).text(`Generated at: ${new Date().toISOString()}`);
    doc.moveDown();
    for (const p of payments) {
      doc
        .fontSize(10)
        .text(
          `ID: ${p._id} | Influencer: ${p.influencerId} | Amount: ${p.totalAmount} | Commission: ${p.commission} | Status: ${p.status}`
        );
    }
    doc.end();
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

router.post("/webhook/razorpay", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(500).json({ message: "Webhook secret not configured" });
    if (!signature || !req.rawBody) return res.status(400).json({ message: "Missing signature or raw payload" });

    const expected = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
    const sigBuf = Buffer.from(String(signature));
    const expBuf = Buffer.from(String(expected));
    if (sigBuf.length !== expBuf.length) return res.status(401).json({ message: "Invalid webhook signature" });
    const valid = crypto.timingSafeEqual(sigBuf, expBuf);
    if (!valid) return res.status(401).json({ message: "Invalid webhook signature" });

    const event = req.body?.event;
    const payload = req.body?.payload || {};
    const payoutId = payload?.payout?.entity?.id;
    const orderId = payload?.order?.entity?.id;
    const paymentId = payload?.payment?.entity?.id;

    if (event === "payout.processed" && payoutId) {
      const payment = await Payment.findOne({ razorpayPayoutId: payoutId });
      if (payment) {
        payment.status = "paid";
        payment.payoutDate = new Date();
        payment.paidAt = new Date();
        payment.gatewayMeta = { ...(payment.gatewayMeta || {}), lastWebhookEvent: event };
        await payment.save();
        emitEvent("payment.updated", { id: payment._id.toString(), status: payment.status });
      }
    }

    if (event === "payout.failed" && payoutId) {
      const payment = await Payment.findOne({ razorpayPayoutId: payoutId });
      if (payment) {
        payment.status = "failed";
        payment.failureReason = payload?.payout?.entity?.status_details?.description || "Payout failed";
        payment.failedAt = new Date();
        payment.gatewayMeta = { ...(payment.gatewayMeta || {}), lastWebhookEvent: event };
        await payment.save();
        emitEvent("payment.updated", { id: payment._id.toString(), status: payment.status });
      }
    }

    if (event === "payment.failed" && (orderId || paymentId)) {
      const payment = await Payment.findOne({
        $or: [{ orderId }, { razorpayPaymentId: paymentId }]
      }).sort({ createdAt: -1 });

      if (payment) {
        payment.status = "failed";
        payment.failureReason = payload?.payment?.entity?.error_description || "Payment failed";
        payment.failedAt = new Date();
        payment.gatewayMeta = { ...(payment.gatewayMeta || {}), lastWebhookEvent: event };
        await payment.save();
        emitEvent("payment.updated", { id: payment._id.toString(), status: payment.status });
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

export default router;

