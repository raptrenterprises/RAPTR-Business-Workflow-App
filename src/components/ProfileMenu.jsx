import { useState } from "react";
import { X, Save, LogOut } from "lucide-react";
import { STYLES, selectStyle } from "../constants";
import { supabase } from "../lib/supabaseClient";

export default function ProfileMenu({ currentUser, email, onClose }) {
  const [displayName, setDisplayName] = useState(currentUser);
  const [newEmail, setNewEmail] = useState(email);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function saveName() {
    setError(""); setStatus("");
    const name = displayName.trim();
    if (!name) { setError("Name can't be empty."); return; }
    try {
      const { error } = await supabase.auth.updateUser({ data: { display_name: name } });
      if (error) throw error;
      setStatus("Display name updated.");
    } catch (e) { setError(e.message); }
  }

  async function saveEmail() {
    setError(""); setStatus("");
    const em = newEmail.trim();
    if (!em || em === email) return;
    try {
      const { error } = await supabase.auth.updateUser({ email: em });
      if (error) throw error;
      setStatus("Check your new email inbox to confirm — it won't switch over until you do.");
    } catch (e) { setError(e.message); }
  }

  async function savePassword() {
    setError(""); setStatus("");
    if (!newPassword || newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords don't match."); return; }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setStatus("Password updated.");
      setNewPassword(""); setConfirmPassword("");
    } catch (e) { setError(e.message); }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "transparent" }} />
      <div style={{ position: "absolute", top: "110%", right: 0, zIndex: 50, background: "#fff", color: STYLES.ink, border: `1px solid ${STYLES.ink}22`, borderRadius: 8, padding: 16, width: 280, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <strong style={{ fontFamily: "Georgia, serif" }}>Your profile</strong>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: STYLES.slate }}><X size={16} /></button>
        </div>

        {error && <div style={{ background: "#F4D9D9", color: STYLES.wax, padding: 8, borderRadius: 4, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {status && <div style={{ background: "#E4EFE8", color: STYLES.green, padding: 8, borderRadius: 4, fontSize: 12, marginBottom: 10 }}>{status}</div>}

        <label style={{ display: "block", fontSize: 12, color: STYLES.slate, marginBottom: 12 }}>
          Display name
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ ...selectStyle(), flex: 1 }} />
            <button onClick={saveName} style={{ background: STYLES.brass, border: "none", borderRadius: 4, padding: "0 10px", cursor: "pointer" }}><Save size={13} /></button>
          </div>
        </label>

        <label style={{ display: "block", fontSize: 12, color: STYLES.slate, marginBottom: 12 }}>
          Email
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={{ ...selectStyle(), flex: 1 }} />
            <button onClick={saveEmail} style={{ background: STYLES.brass, border: "none", borderRadius: 4, padding: "0 10px", cursor: "pointer" }}><Save size={13} /></button>
          </div>
        </label>

        <div style={{ fontSize: 12, color: STYLES.slate, marginBottom: 4 }}>New password</div>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" style={{ ...selectStyle(), width: "100%", boxSizing: "border-box", marginBottom: 6 }} />
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" style={{ ...selectStyle(), width: "100%", boxSizing: "border-box", marginBottom: 8 }} />
        <button onClick={savePassword} style={{ width: "100%", background: STYLES.brass, border: "none", borderRadius: 4, padding: "8px 0", cursor: "pointer", marginBottom: 14, fontSize: 13, fontWeight: 600 }}>Update password</button>

        <button onClick={() => supabase.auth.signOut()} style={{ width: "100%", background: "transparent", border: `1px solid ${STYLES.wax}`, color: STYLES.wax, borderRadius: 4, padding: "8px 0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13 }}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </>
  );
}
