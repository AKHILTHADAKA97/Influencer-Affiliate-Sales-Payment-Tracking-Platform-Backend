import { useEffect, useState } from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip, ArcElement, LineElement, PointElement } from "chart.js";
import { api } from "../api";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

export function InfluencerDashboard({ session }) {
  const [profile, setProfile] = useState(null);
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState([]);
  const [weekendData, setWeekendData] = useState({ weekendRevenue: 0, weekdayRevenue: 0, bestDay: "" });
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    async function load() {
      const { data: me } = await api.get(`/influencer/me/${session.userId}`);
      setProfile(me);
      if (me?._id) {
        const [{ data: p }, { data: s }, { data: ins }] = await Promise.all([
          api.get(`/payment/history?influencerId=${me._id}`),
          api.get(`/analytics/influencer/${me._id}`),
          api.get(`/analytics/influencer/${me._id}/insights`)
        ]);
        setPayments(p);
        setStats(s);
        setInsights(ins.insights || []);
        setWeekendData({
          weekendRevenue: ins.weekendRevenue || 0,
          weekdayRevenue: ins.weekdayRevenue || 0,
          bestDay: ins.bestDay || ""
        });
        setTrend(ins.recentSales || []);
      }
    }
    load();
  }, [session.userId]);

  const weekendChart = {
    labels: ["Weekend", "Weekday"],
    datasets: [
      {
        label: "Revenue (Rs)",
        data: [weekendData.weekendRevenue, weekendData.weekdayRevenue],
        backgroundColor: ["#f59e0b", "#3b82f6"]
      }
    ]
  };

  const trendChart = {
    labels: trend.map((t, i) => `Sale ${i + 1}`),
    datasets: [
      {
        label: "Sale Amount",
        data: trend.map((t) => t.amount),
        borderColor: "#10b981",
        tension: 0.3,
        fill: false
      }
    ]
  };

  return (
    <div className="grid">
      <div className="card">
        <h3>Your Referral Code</h3>
        <p>{profile?.referralCode || "No profile yet"}</p>
        {profile?.referralCode ? <p>Affiliate Link: {`${window.location.origin}/checkout/${profile.referralCode}`}</p> : null}
      </div>
      <div className="card">
        <h3>Performance</h3>
        <p>Clicks: {stats?.clicks || 0}</p>
        <p>Sales: {stats?.sales || 0}</p>
        <p>Revenue: Rs {stats?.revenue || 0}</p>
        <p>Conversion Rate: {stats?.conversionRate || 0}%</p>
        {weekendData.bestDay ? <p>Best Day: {weekendData.bestDay}</p> : null}
      </div>
      <div className="card lg">
        <h3>Clicks vs Sales</h3>
        <Bar
          data={{
            labels: ["Clicks", "Sales"],
            datasets: [{ label: "Count", data: [stats?.clicks || 0, stats?.sales || 0], backgroundColor: ["#60a5fa", "#2563eb"] }]
          }}
        />
      </div>
      <div className="card lg">
        <h3>Weekend vs Weekday Revenue</h3>
        <Pie data={weekendChart} />
      </div>
      <div className="card lg">
        <h3>Recent Sales Trend</h3>
        {trend.length > 0 ? <Line data={trendChart} /> : <p>No recent sales data.</p>}
      </div>
      <div className="card lg">
        <h3>AI Insights</h3>
        {insights.length === 0 ? <p>No insights yet. Keep promoting to get personalized tips.</p> : (
          <ul>
            {insights.map((x, i) => (
              <li key={i} style={{ marginBottom: "8px", lineHeight: "1.5" }}>{x}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="card">
        <h3>Payment History</h3>
        {payments.map((p) => (
          <p key={p._id}>
            Rs {p.commission} - {p.status}
          </p>
        ))}
      </div>
    </div>
  );
}

