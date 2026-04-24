import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Bar, Line, Pie } from "react-chartjs-2";
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

export function FinanceDashboard() {
  const [overview, setOverview] = useState(null);
  const [prediction7, setPrediction7] = useState([]);
  const [prediction30, setPrediction30] = useState([]);
  const [payments, setPayments] = useState([]);

  const load = async () => {
    const [a, c, c30, e] = await Promise.all([
      api.get("/analytics/overview"),
      api.get("/analytics/sales-prediction"),
      api.get("/analytics/sales-prediction?days=30"),
      api.get("/payment/history")
    ]);
    setOverview(a.data);
    setPrediction7(c.data.prediction || []);
    setPrediction30(c30.data.prediction || []);
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
        <h3>Payment Management</h3>
        <div className="actions">
          <button onClick={() => downloadReport("csv")}>Export CSV</button>
          <button onClick={() => downloadReport("pdf")}>Export PDF</button>
        </div>
        {payments.slice(0, 10).map((p) => (
          <div key={p._id} className="row">
            <span>Rs {p.commission} ({p.status})</span>
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