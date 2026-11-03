"use client";

import { useState } from "react";
import { Dumbbell } from "lucide-react";
import { StrideSignIn } from "@/components/stride-sign-in";

type AccountMode = "create" | "signin";

export function MarketingHome({
  clientId,
  authError,
  initialMode = "create",
  hasGuestProgress = false,
}: {
  clientId: string | null;
  authError?: string | null;
  initialMode?: AccountMode;
  hasGuestProgress?: boolean;
}) {
  const [mode, setMode] = useState<AccountMode>(initialMode);

  return (
    <main className="signin-page marketing-home">
      <section className="signin-card login-card" aria-labelledby="signin-title">
        <div className="signin-brand"><span><Dumbbell size={22} /></span><strong>stride.</strong></div>
        <div className="signin-copy">
          <p className="signin-kicker">Strength training, made clear.</p>
          <h1 id="signin-title">{mode === "create" ? "Create your account" : "Welcome back"}</h1>
          <p>{hasGuestProgress ? "Save your workouts to an account and keep training across devices." : mode === "create" ? "Save your workouts and pick up where you left off." : "Sign in to get back to your training."}</p>
        </div>
        <StrideSignIn clientId={clientId} authError={authError} />
        <p className="login-mode-switch">
          {mode === "create" ? "Already have an account?" : "New to Stride?"}{" "}
          <button type="button" className="text-button" onClick={() => setMode(mode === "create" ? "signin" : "create")}>
            {mode === "create" ? "Sign in" : "Create account"}
          </button>
        </p>
        <p className="signin-privacy">We log basic usage and broad region, sometimes linked to your account; never workout details.</p>
      </section>
      <nav className="marketing-legal-links" aria-label="Legal and support links">
        <a href="/support.html">Support</a>
        <a href="/privacy.html">Privacy</a>
        <a href="/terms.html">Terms</a>
      </nav>
    </main>
  );
}
