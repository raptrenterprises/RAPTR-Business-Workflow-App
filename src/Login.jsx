import { useState } from "react";
import { LogIn } from "lucide-react";
import { STYLES } from "./constants";
import { supabase } from "./lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <div style={{ minHeight: "100vh", background: STYLES.ink, color: STYLES.parchment, fontFamily: "Georgia, 'Times New Roman', serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ letterSpacing: 4, fontSize: 12, color: STYLES.brass, marginBottom: 8, textTransform: "uppercase" }}>RAPTR Mysteries</div>
      <h1 style={{ fontSize: 32, margin: "0 0 24px", fontWeight: 400 }}>RAPTR Login</h1>

      <form onSubmit={handleSubmit} style={{ background: "#232F3E", border: `1px solid ${STYLES.brass}55`, borderRadius: 6, padding: 28, width: 320, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ fontSize: 13, color: STYLES.slate, fontFamily: "system-ui, sans-serif" }}>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@raptrmysteries.com"
            style={{ width: "100%", boxSizing: "border-box", marginTop: 4, padding: "10px 12px", borderRadius: 4, border: "1px solid #55606f", background: "#1B2430", color: STYLES.parchment, fontSize: 14, fontFamily: "system-ui, sans-serif" }}
          />
        </label>
        <label style={{ fontSize: 13, color: STYLES.slate, fontFamily: "system-ui, sans-serif" }}>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", marginTop: 4, padding: "10px 12px", borderRadius: 4, border: "1px solid #55606f", background: "#1B2430", color: STYLES.parchment, fontSize: 14, fontFamily: "system-ui, sans-serif" }}
          />
        </label>

        {error && <div style={{ color: "#E8A7A7", fontSize: 12.5, fontFamily: "system-ui, sans-serif" }}>{error}</div>}

        <button type="submit" disabled={loading} style={{ background: STYLES.brass, border: "none", borderRadius: 4, padding: "10px 0", cursor: loading ? "default" : "pointer", fontFamily: "system-ui, sans-serif", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: loading ? 0.7 : 1 }}>
          <LogIn size={15} /> {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
