import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { setAuthToken } from "./api";
import { LoginPage } from "./pages/LoginPage.jsx";
import { AdminDashboard } from "./pages/AdminDashboard.jsx";
import { FinanceDashboard } from "./pages/FinanceDashboard.jsx";
import { InfluencerDashboard } from "./pages/InfluencerDashboard.jsx";
import { CheckoutPage } from "./pages/CheckoutPage.jsx";

export default function App() {
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem("session");
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    setAuthToken(session?.token || "");
  }, [session]);

  const onLogin = (next) => {
    localStorage.setItem("session", JSON.stringify(next));
    setSession(next);
  };

  const onLogout = () => {
    localStorage.removeItem("session");
    setSession(null);
    setAuthToken("");
  };

  if (!session) {
    return (
      <Routes>
        <Route path="/checkout/:referralCode" element={<CheckoutPage />} />
        <Route path="*" element={<LoginPage onLogin={onLogin} />} />
      </Routes>
    );
  }

  const getDashboard = () => {
    if (session.role === "admin") return <AdminDashboard session={session} />;
    if (session.role === "finance") return <FinanceDashboard session={session} />;
    return <InfluencerDashboard session={session} />;
  };

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <h2>Influencer AI Platform <span className="role-badge">{session.role}</span></h2>
        <div>
          <Link to="/">Dashboard</Link>
          <button onClick={onLogout}>Logout</button>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={getDashboard()} />
        <Route path="/checkout/:referralCode" element={<CheckoutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
