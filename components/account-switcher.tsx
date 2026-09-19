"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

export function AccountSwitcher({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const switchAccount = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/google/signout", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  };
  return <button className="account-switcher" type="button" onClick={() => void switchAccount()} disabled={busy} aria-label="Sign out and switch Google account" title={`Signed in as ${email}. Switch account`}><span>{email}</span><LogOut size={16}/><b>{busy ? "Signing out…" : "Switch"}</b></button>;
}
