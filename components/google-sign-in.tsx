"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window { google?: { accounts: { id: { initialize: (input: unknown) => void; renderButton: (element: HTMLElement, options: unknown) => void } } } }
}

export function GoogleSignIn({ clientId }: { clientId: string | null }) {
  const button = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!clientId || !button.current) return;
    const render = () => {
      window.google?.accounts.id.initialize({ client_id: clientId, callback: async ({ credential }: { credential?: string }) => {
        setError("");
        const response = await fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) });
        if (response.ok) window.location.assign("/");
        else setError((await response.json().catch(() => null) as { error?: string } | null)?.error ?? "Google sign-in could not be completed.");
      } });
      window.google?.accounts.id.renderButton(button.current!, { theme: "outline", size: "large", text: "continue_with", width: 280 });
    };
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (window.google) render();
    else if (existing) existing.addEventListener("load", render, { once: true });
    else { const script = document.createElement("script"); script.src = "https://accounts.google.com/gsi/client"; script.async = true; script.onload = render; document.head.appendChild(script); }
  }, [clientId]);
  if (!clientId) return null;
  return <div className="google-signin"><div ref={button} />{error ? <p className="signin-error" role="alert">{error}</p> : null}</div>;
}
