# Influencer AI Platform — How I'd Explain It in an Interview

---

## So, What Is This Project?

This is an **Influencer Affiliate Marketing Platform** I built from scratch. Think of it like a dashboard where brands can manage influencers, track every click and sale those influencers drive, detect fake bot traffic, predict future revenue with AI, and handle commission payouts — all in real time.

I built it because most affiliate platforms are either too manual (spreadsheets everywhere) or too generic (every user sees the same thing). Mine solves both.

---

## The Tech Stack I Chose

| Part | What I Used | Why |
|------|------------|-----|
| **Frontend** | React 18 + Vite | Fast dev experience, component-based UI |
| **Charts** | Chart.js via react-chartjs-2 | Beautiful charts that just work |
| **Real-Time** | Socket.io-client | Dashboards update live without refreshing |
| **Backend** | Node.js + Express | Clean REST API, easy to scale |
| **Database** | MongoDB + Mongoose | Flexible schema, fast queries |
| **AI** | OpenAI GPT-4o-mini + custom stats | Smart insights even without an API key |
| **Auth** | JWT + bcrypt | Secure, stateless authentication |
| **Payments** | Razorpay | Real payout integration |

---

## How It Actually Works

### The Real-Time Flow

Here's what happens when someone clicks an influencer's link:

1. **Click happens** → `POST /api/track/click` records it with IP and user-agent
2. **Sale happens** → `POST /api/track/sale` records the order, auto-creates a 10% commission payment
3. **Server emits event** → `sale.created` fired via Socket.io
4. **All dashboards update** → Admins, finance team, and the influencer themselves see new numbers instantly

No one has to hit refresh. It's all live.

---

## Three Different Dashboards for Three Roles

I implemented **role-based access control** so everyone only sees what they need:

### Admin Dashboard
- Full analytics: revenue, sales, clicks, conversion rate
- AI-generated insights like "weekend campaigns perform 40% better"
- Sales predictions for next 7 and 30 days (line charts)
- **Fraud detection with actual charts** — Bar chart (clicks vs sales per flagged influencer), Doughnut chart (risk distribution), Line chart (fraud trends over time)
- Payment approval and processing
- Export reports as CSV or PDF

### Finance Dashboard
- Revenue overview and predictions
- Payment management: approve pending, mark as paid
- CSV/PDF exports for accounting
- No fraud stuff — they focus on money flow

### Influencer Dashboard
- Personal referral code and affiliate link
- Their own stats: clicks, sales, revenue, conversion rate
- **AI insights personalized for THEM**: "You perform best on Saturdays," "Low conversion despite 200 clicks — try a better CTA"
- Weekend vs weekday revenue pie chart
- Recent sales trend line chart
- Payment history

The routing logic is simple: JWT token has `role`, and `App.jsx` renders the right dashboard component based on that.

---

## The AI Features (The Cool Part)

### 1. Sales Prediction
I use a simple linear trend extrapolation. Take the last 30 days of daily revenue, calculate the average daily growth slope, and project it forward for 7 or 30 days.

Why not TensorFlow or something fancy? Because with only 30 data points, a complex model would overfit badly. A simple trend line is actually more reliable for short-term forecasting — and it runs instantly without any ML dependencies.

### 2. AI-Generated Insights
Two layers here:

- **With OpenAI API key**: I prompt GPT-4o-mini with the brand's stats and ask for 3 concise, action-oriented insights
- **Without API key**: A rule engine kicks in — checks weekend vs weekday revenue share, conversion rate thresholds, and generates human-like tips like "You perform best on weekends" or "Low conversion despite high clicks"

So it works out of the box, no API key needed.

### 3. Fraud Detection
This is my favorite feature. I detect three fraud patterns:

| Pattern | Rule | Risk Level |
|---------|------|------------|
| Bot traffic | >50 clicks, <0.5% conversion | **HIGH** |
| Low-quality traffic | >20 clicks, <1% conversion | **MEDIUM** |
| Click farm | Same IP hits >15 times | **HIGH** |

And I didn't just show text — I built **three charts**:
1. **Bar chart**: For each flagged influencer, compare their clicks (red) vs sales (green)
2. **Doughnut chart**: How many are high risk vs medium vs low
3. **Line chart**: Clicks, sales, and unique IPs per day — you can literally see a spike where bots attacked

Plus OpenAI summarizes the findings into 1-2 sentences so the admin doesn't have to read raw numbers.

---

## How Authentication Works

- Signup/login with email/password
- Passwords hashed with bcrypt (10 salt rounds)
- JWT token generated with `{ id, role, brandId }`, expires in 7 days
- Every protected route runs `authRequired` middleware to validate the token
- `allowRoles('admin', 'finance')` restricts sensitive endpoints
- `brandId` in the JWT ensures multi-tenant isolation — users only see their brand's data

The JWT secret auto-generates if missing and saves to `.env` so the app just works on first run.

---

## Database Design

I used MongoDB with Mongoose. Here's the schema:

```
User
 └── Influencer (linked by userId)
      ├── Click (tracks every referral link click)
      ├── Sale (tracks every purchase)
      └── Payment (commission record, pending/approved/paid)
```

Every collection is indexed on `brandId` so queries are fast even with multiple brands on the same database.

---

## One Smart Thing: The In-Memory Fallback

I know MongoDB connection strings can be annoying in demos, so I built a fallback: if the primary MongoDB fails, the app automatically spins up an in-memory MongoDB instance using `mongodb-memory-server`. 

The evaluator clones the repo, runs `npm run dev`, and it just works — zero config. In production, this fallback is disabled.

---

## Project Structure

```
fullstackproject/
├── client/                    # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── FinanceDashboard.jsx
│   │   │   ├── InfluencerDashboard.jsx
│   │   │   └── LoginPage.jsx
│   │   ├── App.jsx            # Role-based routing
│   │   ├── api.js             # Axios instance
│   │   └── styles.css
│   └── package.json
└── server/                    # Node.js backend
    ├── src/
    │   ├── routes/
    │   │   ├── authRoutes.js
    │   │   ├── analyticsRoutes.js   # AI + fraud + predictions
    │   │   ├── paymentRoutes.js
    │   │   ├── trackingRoutes.js
    │   │   └── influencerRoutes.js
    │   ├── services/
    │   │   ├── aiService.js         # OpenAI + fallback logic
    │   │   ├── bootstrapService.js  # Auto-seed demo data
    │   │   └── paymentService.js
    │   ├── models/
    │   │   ├── User.js
    │   │   ├── Influencer.js
    │   │   ├── Click.js
    │   │   ├── Sale.js
    │   │   └── Payment.js
    │   ├── middleware/
    │   │   └── auth.js              # JWT + role guards
    │   ├── sockets/
    │   │   └── index.js             # Socket.io emitter
    │   └── app.js
    └── package.json
```

---

## How to Run It

```bash
# Terminal 1 — Server
cd server
npm install
npm run dev          # http://localhost:5000

# Terminal 2 — Client
cd client
npm install
npm run dev          # http://localhost:5173
```

**Demo logins:**
- `admin1@influencerai.com` / `Admin@123`
- `finance1@influencerai.com` / `Finance@123`
- `influencer1@influencerai.com` / `Influencer@123`

The app auto-seeds realistic demo data (30 days of clicks, sales, payments) on first run so the dashboards show real numbers immediately — no empty charts.

---

## Interview Questions I Expect

**"How did you handle security?"**
Passwords are bcrypt-hashed, JWT tokens expire in 7 days, every API route validates the token, and role-based middleware prevents unauthorized access. Plus `brandId` isolation means one brand can't see another's data.

**"Why did you choose linear regression for predictions instead of ML?"**
With only 30 days of data, a neural network or ARIMA would overfit. A trend line gives reliable short-term forecasts with zero dependencies. If I had years of data, I'd upgrade to Prophet or LSTM.

**"How does fraud detection actually catch fake clicks?"**
Three statistical rules: abnormally high clicks with near-zero conversion, repeated IPs suggesting click farms, and sudden spikes with no corresponding sales. I visualize everything in Chart.js so it's not just numbers — you can *see* the fraud.

**"What if the database connection fails?"**
The `connectDB()` function catches the error and falls back to an in-memory MongoDB for local development. For production, the fallback is disabled and it throws properly.

---

## What I'd Add Next

1. **JWT refresh tokens** — longer sessions without compromising security
2. **ARIMA/Prophet forecasting** — when we have enough historical data
3. **Geolocation tracking** — where clicks come from
4. **A/B testing** — compare different influencer content strategies
5. **React Native app** — influencers check stats on mobile

---

That's the project. Built it end-to-end, from database schema to AI insights to real-time sockets. It works, it looks professional, and it solves real problems.
