"use client";
import { useEffect, useState } from "react";
type Status = {
  connected: boolean;
  verifiedAt: string | null;
  billingEnabled: boolean;
};
export function AdminBillingSetup() {
  const [status, setStatus] = useState<Status | null>(null),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [stripeConnected, setStripeConnected] = useState<boolean | null>(null),
    [stripeKey, setStripeKey] = useState(""),
    [stripeBusy, setStripeBusy] = useState(false),
    [stripeError, setStripeError] = useState("");
  async function request(method = "GET", body?: object) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/metronome", {
        method,
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20000),
      });
      const result = (await response.json()) as Status & { error?: string };
      if (!response.ok)
        throw new Error(result.error || "Unable to update the connection.");
      setStatus(result);
      if (method !== "GET") {
        setToken("");
        setMessage(
          method === "DELETE"
            ? "Saved token removed from Stride."
            : body && "token" in body
              ? "Token saved. Stride sandbox connection verified. Billing is still off."
              : "Stride sandbox connection verified. Billing is still off.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error && e.name === "TimeoutError"
          ? "The check timed out. Try again to confirm the saved status."
          : e instanceof Error
            ? e.message
            : "Could not check the connection.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function stripeRequest(method = "GET", body?: object) {
    setStripeBusy(true);
    setStripeError("");
    try {
      const response = await fetch("/api/admin/stripe", {
          method,
          headers: { "Content-Type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
        result = (await response.json()) as {
          connected: boolean;
          error?: string;
        };
      if (!response.ok)
        throw new Error(result.error || "Could not update Stripe.");
      setStripeConnected(result.connected);
      setStripeKey("");
    } catch (e) {
      setStripeError(
        e instanceof Error ? e.message : "Could not update Stripe.",
      );
    } finally {
      setStripeBusy(false);
    }
  }
  useEffect(() => {
    void request();
    void stripeRequest();
  }, []);
  return (
    <section
      id="billing-setup"
      className="panel admin-settings"
    >
      <h2>Usage billing setup</h2>
      <p>Token cost only · No monthly fee · No markup</p>
      <p className="connection-notice">
        Metronome: {status?.connected ? "Connected" : "Not connected"} · Stripe:{" "}
        {stripeConnected ? "Connected" : "Not connected"} · Sandbox billing is on
      </p>
      <details>
        <summary>
          {status?.connected
            ? "Manage Metronome sandbox"
            : "Connect Metronome sandbox"}
        </summary>
        <ol className="connection-steps">
          <li>
            In Metronome Sandbox, open{" "}
            <strong>Developer → API tokens → + Add</strong>.
          </li>
          <li>
            Create and copy a token named <strong>Stride sandbox</strong>.
          </li>
        </ol>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void request("POST", { token });
          }}
        >
          <label htmlFor="metronome-token">
            Metronome sandbox API token
            <input
              id="metronome-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={busy}
              required
            />
          </label>
          <button className="primary" disabled={busy || !token.trim()}>
            {busy ? "Checking…" : "Verify and save token"}
          </button>
        </form>
      </details>
      {status?.verifiedAt && (
        <p className="form-help">
          Metronome last verified:{" "}
          {new Date(status.verifiedAt).toLocaleString()}
        </p>
      )}
      <details open={status?.connected && !stripeConnected}>
        <summary>
          {stripeConnected
            ? "Manage Stripe sandbox key"
            : "Connect Stripe sandbox"}
        </summary>
        <ol className="connection-steps">
          <li>
            In Stripe sandbox, open{" "}
            <strong>Developers → API keys → Create restricted key</strong>.
          </li>
          <li>
            Name it <strong>Stride billing sandbox</strong>. Give{" "}
            <strong>Account</strong> read, <strong>Customers</strong> write, and
            <strong> Checkout Sessions</strong> write access.
          </li>
          <li>
            Copy the key beginning with <strong>rk_test_</strong> and paste it
            below.
          </li>
        </ol>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void stripeRequest("POST", { key: stripeKey });
          }}
        >
          <label htmlFor="stripe-key">
            Stripe sandbox restricted key
            <input
              id="stripe-key"
              type="password"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={4096}
              value={stripeKey}
              onChange={(e) => setStripeKey(e.target.value)}
              disabled={stripeBusy}
              placeholder="rk_test_…"
              required
            />
          </label>
          <p className="form-help">
            Encrypted on the server and never displayed again.
          </p>
          <button
            className="primary"
            disabled={stripeBusy || !stripeKey.trim()}
          >
            {stripeBusy ? "Checking…" : "Verify and save Stripe key"}
          </button>
        </form>
        {stripeConnected && (
          <button
            className="text-button"
            disabled={stripeBusy}
            onClick={() => void stripeRequest("DELETE")}
          >
            Remove saved Stripe key
          </button>
        )}
      </details>
      <p className="form-help">
        Users without complimentary AI can add a $5 test balance. Successful AI
        responses deduct the current GPT-4.1 mini token cost with no markup.
        Complimentary AI stays unchanged. No real charges are enabled.
      </p>
      {error && (
        <p className="plan-error" role="alert">
          {error}
        </p>
      )}
      {stripeError && (
        <p className="plan-error" role="alert">
          {stripeError}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
