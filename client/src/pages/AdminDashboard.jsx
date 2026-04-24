import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from "chart.js";
import { api } from "../api";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

const socket = io(import.meta.env.VITE_API_ROOT || "http://localhost:5000");

export function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [insights, setInsights] = useState([]);
  const [prediction7, setPrediction7] = useState([]);
  const [prediction30, setPrediction30] = useState([]);
  const [fraud, setFraud] = useState([]);
  const [fraudSummary, setFraudSummary] = useState([]);
  const [fraudTrends, setFraudTrends] = useState([]);
  const [payments, setPayments] = useState([]);

  const load = async () => {
    const [a, b, c, c30, d, d2, e] = await Promise.all([
      api.get("/analytics/overview"),
      api.get("/analytics/ai-insights"),
      api.get("/analytics/sales-prediction"),
      api.get("/analytics/sales-prediction?days=30"),
      api.get("/analytics/fraud-detection"),
      api.get("/analytics/fraud-trends"),
      api.get("/payment/history")
    ]);
    setOverview(a.data);
    setInsights(b.data.insights || []);
    setPrediction7(c.data.prediction || []);
    setPrediction30(c30.data.prediction || []);
    setFraud(d.data.findings || []);
    setFraudSummary(d.data.aiSummary || []);
    setFraudTrends(d2.data.trends || []);
    setPayments(e.data || []);
  };

  const approvePayment = async (id) => {
    await api.patch(`/payment/approve/${id}`);
    await load();
  };

  const processPayment = async (id) => {
    await api.post(`/payment/process/${id}`);
    await load();
  };

  const downloadReport = async (type) => {
    const response = await api.get(`/payment/export/${type}`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = type === "csv" ? "payments-report.csv" : "payments-report.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    load();
    const reload = () => load();
    socket.on("sale.created", reload);
    socket.on("payment.updated", reload);
    return () => {
      socket.off("sale.created", reload);
      socket.off("payment.updated", reload);
    };
  }, []);

  if (!overview) return <p>Loading dashboard...</p>;

  const topInfluencerChart = {
    labels: (overview.topInfluencers || []).map((x) => x.name),
    datasets: [{ label: "Revenue", data: (overview.topInfluencers || []).map((x) => x.revenue), backgroundColor: "#3b82f6" }]
  };
  const salesOverTimeChart = {
    labels: (overview.salesOverTime || []).map((x) => x.day),
    datasets: [{ label: "Sales", data: (overview.salesOverTime || []).map((x) => x.value), borderColor: "#111827" }]
  };
  const predictionChart7 = {
    labels: prediction7.map((x) => `+${x.dayOffset}`),
    datasets: [{ label: "7-day Forecast", data: prediction7.map((x) => x.predictedRevenue), borderColor: "#10b981" }]
  };
  const predictionChart30 = {
    labels: prediction30.map((x) => `+${x.dayOffset}`),
    datasets: [{ label: "30-day Forecast", data: prediction30.map((x) => x.predictedRevenue), borderColor: "#8b5cf6" }]
  };
  const splitChart = {
    labels: (overview.topInfluencers || []).map((x) => x.name),
    datasets: [
      {
        data: (overview.topInfluencers || []).map((x) => x.revenue),
        backgroundColor: ["#111827", "#374151", "#6b7280", "#9ca3af", "#d1d5db"]
      }
    ]
  };

  // Fraud Charts
  const fraudBarChart = {
    labels: fraud.map((f) => f.name),
    datasets: [
      { label: "Clicks", data: fraud.map((f) => f.clicks), backgroundColor: "#ef4444" },
      { label: "Sales", data: fraud.map((f) => f.sales), backgroundColor: "#10b981" }
    ]
  };

  const riskCounts = { high: 0, medium: 0, low: 0 };
  fraud.forEach((f) => { riskCounts[f.risk] = (riskCounts[f.risk] || 0) + 1; });
  const riskChart = {
    labels: ["High Risk", "Medium Risk", "Low Risk"],
    datasets: [
      {
        data: [riskCounts.high, riskCounts.medium, riskCounts.low],
        backgroundColor: ["#ef4444", "#f59e0b", "#10b981"]
      }
    ]
  };

  const fraudTrendChart = {
    labels: fraudTrends.map((t) => t.day),
    datasets: [
      { label: "Clicks", data: fraudTrends.map((t) => t.clicks), borderColor: "#ef4444", tension: 0.3 },
      { label: "Sales", data: fraudTrends.map((t) => t.sales), borderColor: "#10b981", tension: 0.3 },
      { label: "Unique IPs", data: fraudTrends.map((t) => t.uniqueIps), borderColor: "#3b82f6", tension: 0.3 }
    ]
  };

  return (
    <div className="grid">
      <div className="card">Revenue: Rs {overview.totalRevenue.toFixed(2)}</div>
      <div className="card">Sales: {overview.totalSales}</div>
      <div className="card">Clicks: {overview.totalClicks}</div>
      <div className="card">Conversion: {overview.conversionRate}%</div>

      <div className="card lg">
        <h3>Top Influencers</h3>
        <Bar data={topInfluencerChart} />
      </div>

      <div className="card lg">
        <h3>Sales Over Time</h3>
        <Line data={salesOverTimeChart} />
      </div>

      <div className="card lg">
        <h3>Sales Prediction (next 7 days)</h3>
        <Line data={predictionChart7} />
      </div>

      <div className="card lg">
        <h3>Sales Prediction (next 30 days)</h3>
        <Line data={predictionChart30} />
      </div>

      <div className="card lg">
        <h3>Revenue Split</h3>
        <Pie data={splitChart} />
      </div>

      <div className="card lg">
        <h3>AI Insights</h3>
        <ul>{insights.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>

      <div className="card lg">
        <h3>Fraud Detection — Flagged Influencers</h3>
        {fraud.length === 0 ? <p>No high-risk anomalies detected.</p> : <Bar data={fraudBarChart} />}
      </div>

      <div className="card lg">
        <h3>Fraud Risk Distribution</h3>
        {fraud.length === 0 ? <p>No risks to display.</p> : <Doughnut data={riskChart} />}
      </div>

      <div className="card lg">
        <h3>Fraud Trends Over Time</h3>
        {fraudTrends.length === 0 ? <p>No trend data.</p> : <Line data={fraudTrendChart} />}
      </div>

      <div className="card lg">
        <h3>Fraud Detection Alerts</h3>
        <ul>{fraudSummary.map((x) => <li key={x}>{x}</li>)}</ul>
        {fraud.length === 0 ? <p>No high-risk anomalies detected.</p> : null}
        {fraud.map((f) => (
          <p key={f.influencerId} className={f.risk === "high" ? "text-red" : "text-amber"}>
            <strong>{f.name}</strong> — {f.reason} <br />
            <small>({f.clicks} clicks, {f.sales} sales, {f.conversionRate}% CVR, Risk: {f.risk})</small>
          </p>
        ))}
      </div>

      <div className="card lg">
        <h3>Payment Management</h3>
        <div className="actions">
          <button onClick={() => downloadReport("csv")}>Export CSV</button>
          <button onClick={() => downloadReport("pdf")}>Export PDF</button>
        </div>
        {payments.slice(0, 8).map((p) => (
          <div key={p._id} className="row">
            <span>
              Rs {p.commission} ({p.status})
            </span>
            <div>
              {p.status === "pending" ? <button onClick={() => approvePayment(p._id)}>Approve</button> : null}
              {p.status === "approved" ? <button onClick={() => processPayment(p._id)}>Mark Paid</button> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

