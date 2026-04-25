import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

function getApiBase() {
  return import.meta.env.VITE_API_URL || "http://localhost:5000/api";
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutPage() {
  const { referralCode } = useParams();
  const [profile, setProfile] = useState(null);
  const [amount, setAmount] = useState(499);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const API_BASE = getApiBase();

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data } = await axios.get(`${API_BASE}/influencer/profile-by-code/${referralCode}`);
        setProfile(data);
      } catch (err) {
        setMessage(err?.response?.data?.message || "Invalid referral link");
      }
    }
    loadProfile();
  }, [API_BASE, referralCode]);

  const startPayment = async () => {
    setLoading(true);
    setMessage("");
    try {
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady) {
        setMessage("Failed to load Razorpay SDK");
        return;
      }

      const [{ data: keyData }, { data: orderData }] = await Promise.all([
        axios.get(`${API_BASE}/payment/key`),
        axios.post(`${API_BASE}/payment/create-order`, {
          referralCode,
          amount: Number(amount),
          productId: "checkout_product"
        })
      ]);

      const key = keyData?.keyId;
      const useMock = !key || !String(key).startsWith("rzp_");

      if (useMock) {
        const mockPayload = {
          referralCode,
          amount: Number(amount),
          productId: "checkout_product",
          orderId: orderData.orderId,
          razorpay_payment_id: `mock_pay_${Date.now()}`,
          razorpay_signature: "mock_signature"
        };
        await axios.post(`${API_BASE}/payment/verify-payment`, mockPayload);
        setMessage("Payment completed in mock mode. Sale + commission recorded.");
        return;
      }

      const options = {
        key,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Influencer Affiliate Platform",
        description: "Affiliate Purchase",
        order_id: orderData.orderId,
        prefill: {},
        theme: { color: "#3b82f6" },
        handler: async function (response) {
          try {
            await axios.post(`${API_BASE}/payment/verify-payment`, {
              referralCode,
              amount: Number(amount),
              productId: "checkout_product",
              orderId: orderData.orderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            setMessage("Payment successful. Sale + commission recorded.");
          } catch (err) {
            setMessage(err?.response?.data?.message || "Payment verification failed");
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        setMessage(resp?.error?.description || "Payment failed");
      });
      rzp.open();
    } catch (err) {
      setMessage(err?.response?.data?.message || "Unable to start payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid" style={{ maxWidth: 720, margin: "20px auto" }}>
      <div className="card lg">
        <h2>Affiliate Checkout</h2>
        <p>Referral Code: <strong>{referralCode}</strong></p>
        <p>Influencer: <strong>{profile?.displayName || "Loading..."}</strong></p>
        <label style={{ display: "block", marginBottom: 8 }}>Amount (INR)</label>
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 12 }}
        />
        <button onClick={startPayment} disabled={loading || !profile}>
          {loading ? "Processing..." : "Pay with Razorpay"}
        </button>
        {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
      </div>
    </div>
  );
}
