import { useState } from "react";
import { HeartHandshake, Lock, Gift, FileText } from "lucide-react";
import { STYLES, selectStyle } from "../../constants";
import { TabButton } from "../../components/Shared";
import VelociraptorIcon from "../../components/VelociraptorIcon";
import PactSection from "./PactSection";
import HolidaysSection from "./HolidaysSection";
import DocumentsSection from "./DocumentsSection";

// A fixed passcode that keeps the section closed to anyone glancing at the screen. It is checked in the
// browser, so treat it as a door latch rather than a vault: it does not change who can reach the data.
const PASSCODE = "raptrraptr";

function PasscodeGate({ onUnlock }) {
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);

  function tryUnlock() {
    if (value.trim() === PASSCODE) { onUnlock(); return; }
    setWrong(true);
    setValue("");
  }

  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", border: `1px solid ${STYLES.ink}22`, borderRadius: 8, padding: 24, width: "100%", maxWidth: 320, textAlign: "center" }}>
        <div style={{ color: STYLES.wax, marginBottom: 8 }}><VelociraptorIcon size={40} /></div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, marginBottom: 14 }}>raptrraptr</div>
        <input
          type="password" autoFocus value={value} placeholder="Passcode"
          autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="off"
          onChange={(e) => { setValue(e.target.value); setWrong(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") tryUnlock(); }}
          style={{ ...selectStyle(), width: "100%", boxSizing: "border-box", fontSize: 16, textAlign: "center" }}
        />
        {wrong && <div style={{ fontSize: 13, color: STYLES.wax, fontWeight: 600, marginTop: 8 }}>That's not the passcode.</div>}
        <button onClick={tryUnlock} style={{ marginTop: 12, width: "100%", background: STYLES.wax, color: "#fff", border: "none", borderRadius: 4, padding: "10px 18px", cursor: "pointer", fontSize: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Lock size={14} /> Open
        </button>
      </div>
    </div>
  );
}

// The whole section sits behind the passcode. It locks again each time you leave and come back
// (the section unmounts when you switch away), and when the app is reloaded.
export default function RaptrraptrSection({ currentUser, users }) {
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState("pact");

  if (!unlocked) return <PasscodeGate onUnlock={() => setUnlocked(true)} />;

  return (
    <>
      <div style={{ display: "flex", borderBottom: `1px solid ${STYLES.ink}22`, background: "#fff", overflowX: "auto" }}>
        <TabButton active={tab === "pact"} onClick={() => setTab("pact")} icon={<HeartHandshake size={14} />} label="Pact" />
        <TabButton active={tab === "holidays"} onClick={() => setTab("holidays")} icon={<Gift size={14} />} label="Holidays" />
        <TabButton active={tab === "documents"} onClick={() => setTab("documents")} icon={<FileText size={14} />} label="Documents" />
      </div>
      {tab === "pact" && <PactSection currentUser={currentUser} users={users} />}
      {tab === "holidays" && <HolidaysSection />}
      {tab === "documents" && <DocumentsSection currentUser={currentUser} />}
    </>
  );
}
