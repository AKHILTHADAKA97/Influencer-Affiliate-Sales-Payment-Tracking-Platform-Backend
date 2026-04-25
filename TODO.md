# Fix Implementation Plan

## Issue 1: New users see empty dashboards after signup
- [x] Extract per-brand demo data seeding from `bootstrapService.js`
- [x] Call seeding in `authRoutes.js` after successful signup

## Issue 2: Razorpay checkout not opening
- [x] Add `createOrder()`, `verifyPaymentSignature()`, `getRazorpayKeyId()` to `paymentService.js`
- [x] Add `GET /key`, `POST /create-order`, `POST /verify-payment` to `paymentRoutes.js`
- [x] Add public `GET /profile-by-code/:referralCode` to `influencerRoutes.js`
- [x] Create `client/src/pages/CheckoutPage.jsx` with Razorpay checkout integration
- [x] Add `/checkout/:referralCode` route to `App.jsx`
- [x] Update influencer shareable link in `InfluencerDashboard.jsx`

