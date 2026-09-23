"use client";

import { useState } from "react";
import { GoogleSignIn } from "./google-sign-in";

const authMessages: Record<string, string> = {
  "account-exists": "That email already has a Stride account. Sign in with its existing method; your guest progress is still available on this device.",
  "email-invalid": "That code or sign-in link is invalid or expired. Request a new one.",
  "email-failed": "Email sign-in could not be completed. Please try again.",
};

export function StrideSignIn({ clientId, authError }: { clientId: string | null; authError?: string | null }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(authError ? authMessages[authError] || "Sign-in could not be completed. Please try again." : "");

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Email sign-in could not be started.");
      setCodeSent(true);
      setMessage("Check your inbox for a 6-digit sign-in code. It expires in 15 minutes.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Email sign-in could not be started.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "The code could not be verified.");
      window.location.assign("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The code could not be verified.");
      setBusy(false);
    }
  }

  async function continueAsGuest() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/guest", { method: "POST" });
      if (response.ok) window.location.assign("/");
      else throw new Error("Guest access is temporarily unavailable.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Guest access is temporarily unavailable.");
      setBusy(false);
    }
  }

  return (
    <div className="stride-signin-options">
      <GoogleSignIn clientId={clientId} />
      {!codeSent ? (
        <form onSubmit={(event) => void requestCode(event)} className="email-signin">
          <label htmlFor="signin-email">Continue with email</label>
          <div>
            <input id="signin-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={busy} />
            <button className="secondary" disabled={busy}>{busy ? "Sending…" : "Email me a code"}</button>
          </div>
        </form>
      ) : (
        <form onSubmit={(event) => void verifyCode(event)} className="email-signin email-otp">
          <label htmlFor="signin-code">6-digit code sent to {email}</label>
          <div>
            <input id="signin-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" disabled={busy} />
            <button className="secondary" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify code"}</button>
          </div>
          <button type="button" className="text-button" disabled={busy} onClick={() => { setCodeSent(false); setCode(""); setMessage(""); }}>Use a different email</button>
        </form>
      )}
      <button className="text-button guest-signin" disabled={busy} onClick={() => void continueAsGuest()}>Try Stride without an account</button>
      <p className="form-help">Your workout progress stays with this account. Connect Google or verify your email to use Stride across devices.</p>
      {message && <p className="signin-error" role="status">{message}</p>}
    </div>
  );
}
