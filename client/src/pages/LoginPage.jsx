import { useState } from "react";
import { api } from "../api";

export function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [message, setMessage] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      if (mode === "signup") {
        await api.post("/auth/signup", { email, password, role });
        setMode("login");
        setMessage("Signup complete, now login.");
        return;
      }
      const { data } = await api.post("/auth/login", { email, password });
      onLogin(data);
    } catch (error) {
      const text = error?.response?.data?.message || "Unable to authenticate. Check credentials and API.";
      setMessage(text);
    }
  };

  return (
    <div className="auth-card">
      <h1>{mode === "login" ? "Login" : "Signup"}</h1>
      <form onSubmit={submit}>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {mode === "signup" ? (
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="admin">Admin</option>
            <option value="influencer">Influencer</option>
            <option value="finance">Finance</option>
          </select>
        ) : null}
        <button type="submit">{mode === "login" ? "Login" : "Create account"}</button>
      </form>
      {message ? <p>{message}</p> : null}
      <button className="link-btn" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? "Need account? Signup" : "Already have account? Login"}
      </button>
    </div>
  );
}
