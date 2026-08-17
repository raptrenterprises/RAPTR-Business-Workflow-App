import { Component } from "react";

// Catches render crashes anywhere below it and shows the actual error on
// screen instead of a blank white page — critical for diagnosing issues
// on a phone with no access to desktop DevTools.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("App crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      const text = `${this.state.error?.stack || this.state.error?.toString() || "Unknown error"}\n\nComponent stack:${this.state.info?.componentStack || " (not available)"}`;
      return (
        <div style={{ minHeight: "100vh", background: "#fff", color: "#111", padding: 20, fontFamily: "system-ui, -apple-system, sans-serif" }}>
          <h2 style={{ color: "#580900", marginTop: 0 }}>Something went wrong</h2>
          <p>Take a screenshot of everything below, or tap Copy, and send it over — this is the exact error.</p>
          <button
            onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}); }}
            style={{ padding: "10px 16px", marginBottom: 16, cursor: "pointer", background: "#580900", color: "#fff", border: "none", borderRadius: 4, fontSize: 14 }}
          >
            Copy error text
          </button>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, background: "#f5f5f5", padding: 12, borderRadius: 6, border: "1px solid #ddd" }}>
            {text}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: "10px 16px", cursor: "pointer", background: "#BBBBBB", border: "none", borderRadius: 4, fontSize: 14 }}
          >
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
