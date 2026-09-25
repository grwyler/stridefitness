"use client";

import { useEffect, useState } from "react";
import { Dumbbell } from "lucide-react";
import { useLandingAnalytics } from "@/components/landing-analytics";

export default function GuestEntryPage() {
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const track = useLandingAnalytics();

  useEffect(() => {
    let cancelled = false;
    async function enterGuest() {
      try {
        const response = await fetch("/api/auth/guest", { method: "POST" });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) throw new Error(body.error || "Guest access is unavailable right now.");
        if (!cancelled) window.location.replace("/");
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not start Stride.");
      }
    }
    void enterGuest();
    return () => { cancelled = true; };
  }, [retry, track]);

  return (
    <main className="signin-page">
      <section className="signin-card" aria-live="polite">
        <div className="signin-brand"><span><Dumbbell size={24} /></span><strong>Stride</strong></div>
        <h1>{error ? "Stride couldn’t start" : "Starting your free Stride account…"}</h1>
        <p>{error || "No sign-up needed. Your guest account will be ready in a moment."}</p>
        {error && <button className="primary" onClick={() => { setError(""); setRetry((value) => value + 1); }}>Try again</button>}
      </section>
    </main>
  );
}
