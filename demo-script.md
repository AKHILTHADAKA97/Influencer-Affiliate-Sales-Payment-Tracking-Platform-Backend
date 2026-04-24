# 2-3 Minute Demo Script

## 0:00 - 0:20 Intro
- Open app and explain roles: Admin, Influencer, Finance
- Mention tenant-safe architecture (`brandId` isolation)

## 0:20 - 1:00 Affiliate tracking flow
- Login as admin (`admin1@influencerai.com`)
- Show influencer referral code and link format
- Trigger click/sale events (via API/Postman) with referral code
- Show revenue/sales/click KPI cards updating

## 1:00 - 1:45 AI capabilities
- Open AI insights panel and read generated recommendations
- Show sales prediction charts for next 7 and 30 days
- Show fraud detection block with anomaly reasoning + AI summary

## 1:45 - 2:20 Payments and exports
- Open payment management list
- Approve one pending payment and process payout
- Export CSV and PDF reports

## 2:20 - 2:50 Security + production readiness
- Explain secure Razorpay webhook signature verification
- Explain environment-based production setup (`ALLOW_MEMORY_DB_FALLBACK=false`)
- Explain tenant isolation prevents cross-brand data leakage
