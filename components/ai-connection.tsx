"use client";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { KeyRound, Loader2 } from "lucide-react";
export function AIConnection() {
  const [open, setOpen] = useState(false),
    [connected, setConnected] = useState(false),
    [key, setKey] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [auth, setAuth] = useState<
    "checking" | "signed-in" | "sign-in" | "unavailable"
  >("checking");
  const [shared, setShared] = useState(false),
    [canShare, setCanShare] = useState(false),
    [personal, setPersonal] = useState(false),
    [included, setIncluded] = useState(false);
  const [billing, setBilling] = useState<{
      enabled: boolean;
      ready: boolean;
      balanceMicros: number;
    } | null>(null),
    [billingBusy, setBillingBusy] = useState(false);
  const [signInUrl, setSignInUrl] = useState(
    "/signin-with-chatgpt?return_to=%2F%3FconnectAI%3D1",
  );
  function requireSignIn(body: { signInUrl?: string }) {
    setAuth("sign-in");
    setConnected(false);
    setKey("");
    if (body.signInUrl?.startsWith("/signin-with-chatgpt?"))
      setSignInUrl(body.signInUrl);
  }
  async function checkConnection() {
    setAuth("checking");
    setError("");
    try {
      const response = await fetch("/api/ai-connection", {
        cache: "no-store",
        credentials: "same-origin",
        signal: AbortSignal.timeout(15000),
      });
      const body = (await response.json()) as {
        signInUrl?: string;
        error?: string;
        connected: boolean;
        shared: boolean;
        canShare: boolean;
        personal: boolean;
        included: boolean;
      };
      if (response.status === 401) {
        requireSignIn(body);
        return;
      }
      if (!response.ok)
        throw new Error(body.error || "Unable to check your connection.");
      setConnected(body.connected);
      setShared(!!body.shared);
      setCanShare(!!body.canShare);
      setPersonal(!!body.personal);
      setIncluded(!!body.included);
      setAuth("signed-in");
      fetch("/api/billing/status", {
        cache: "no-store",
        credentials: "same-origin",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((value) => {
          if (value) setBilling(value);
        })
        .catch(() => {});
    } catch {
      setAuth("unavailable");
      setError("Could not check your sign-in. Please try again.");
    }
  }
  useEffect(() => {
    void checkConnection();
    const params = new URLSearchParams(window.location.search);
    const billingResult = params.get("billing");
    if (params.get("connectAI") === "1" || billingResult) {
      setOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("connectAI");
      url.searchParams.delete("billing");
      window.history.replaceState(
        null,
        "",
        url.pathname + url.search + url.hash,
      );
      if (billingResult === "success")
        setNotice("$5.00 in test AI credit was added to your account.");
      else if (billingResult === "cancelled")
        setNotice("Checkout was cancelled. Nothing was charged.");
      else if (billingResult === "failed")
        setError("The test payment could not be verified. Please try again.");
    }
  }, []);
  async function update(remove = false) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/ai-connection", {
        method: remove ? "DELETE" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        ...(remove ? {} : { body: JSON.stringify({ apiKey: key }) }),
        signal: AbortSignal.timeout(15000),
      });
      const result = (await response.json()) as {
        signInUrl?: string;
        error?: string;
        connected: boolean;
      };
      if (response.status === 401) {
        requireSignIn(result);
        return;
      }
      if (!response.ok)
        throw new Error(result.error || "Unable to save connection.");
      setKey("");
      await checkConnection();
      setNotice(
        remove
          ? "Personal key removed."
          : "Key saved. Your coach will use this connection.",
      );
    } catch (e) {
      setError(
        e instanceof Error && e.name === "TimeoutError"
          ? "The request timed out. Please try again."
          : e instanceof Error
            ? e.message
            : "Unable to save connection.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function updateSharing() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/shared-ai", {
          method: shared ? "DELETE" : "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(15000),
        }),
        result = (await response.json()) as { error?: string; shared: boolean };
      if (!response.ok)
        throw new Error(result.error || "Unable to update shared AI.");
      await checkConnection();
      setNotice(
        result.shared
          ? "Your connection now funds accounts with complimentary AI."
          : "Shared AI is off. Users can still use their own keys.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update shared AI.");
    } finally {
      setBusy(false);
    }
  }
  async function addBalance() {
    setBillingBusy(true);
    setError("");
    try {
      const response = await fetch("/api/billing/checkout", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
        }),
        result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url)
        throw new Error(result.error || "Checkout is unavailable.");
      window.location.assign(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout is unavailable.");
      setBillingBusy(false);
    }
  }
  return (
    <>
      <button
        className="secondary"
        onClick={() => {
          setOpen(true);
          setError("");
          setNotice("");
          void checkConnection();
        }}
      >
        <KeyRound size={16} />
        {connected ? "Manage AI" : "Connect AI"}
      </button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (busy) return;
          setOpen(value);
          setKey("");
          setError("");
          setNotice("");
        }}
      >
        <DialogContent className="app-dialog ai-connect">
          <DialogHeader>
            <DialogTitle>
              {connected ? "Your AI connection" : "Connect AI"}
            </DialogTitle>
            <DialogDescription>
              Choose how to power your coach.
            </DialogDescription>
          </DialogHeader>
          {auth === "checking" && <p role="status">Checking your sign-in…</p>}
          {auth === "sign-in" && (
            <div className="connection-sign-in">
              <p>
                Sign in with ChatGPT before adding your key. You’ll return here
                afterward.
              </p>
              <a className="primary full" href={signInUrl} target="_top">
                Sign in with ChatGPT
              </a>
              <p className="form-help">
                Your key has not been saved. Keep your copy available to paste
                after signing in.
              </p>
              <button
                className="text-button full"
                onClick={() => void checkConnection()}
              >
                I’ve signed in — check again
              </button>
            </div>
          )}
          {auth === "unavailable" && (
            <button
              className="secondary"
              onClick={() => void checkConnection()}
            >
              Try again
            </button>
          )}
          {auth === "signed-in" && (
            <>
              <p className="connection-notice">
                {personal
                  ? "Your coach is using your personal API key."
                  : included && shared
                    ? "AI is included for your account. No setup needed."
                    : !included && (billing?.balanceMicros || 0) > 0
                      ? `AI balance: $${((billing?.balanceMicros || 0) / 1_000_000).toFixed(2)} (sandbox)`
                      : included
                        ? "Your complimentary AI connection is temporarily unavailable. You can connect your own key below."
                        : "Complimentary AI is not included for your account."}
              </p>
              {!included && !personal && billing?.enabled && (
                <div className="shared-ai-control">
                  <div>
                    <strong>Pay only for AI you use</strong>
                    <p>
                      Add a $5 sandbox balance. Each response deducts its token
                      cost with no markup.
                    </p>
                  </div>
                  <button
                    className="primary"
                    disabled={billingBusy}
                    onClick={() => void addBalance()}
                  >
                    {billingBusy
                      ? "Opening…"
                      : billing?.ready
                        ? "Add $5 test balance"
                        : "Set up test billing"}
                  </button>
                </div>
              )}
              <details open={!connected || canShare}>
                <summary>
                  {personal
                    ? "Manage personal key"
                    : connected
                      ? "Use your own API key"
                      : "Use your own API key instead"}
                </summary>
                <ol className="connection-steps">
                  <li>
                    Open{" "}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      OpenAI API keys
                    </a>{" "}
                    if you need a key.
                  </li>
                  <li>
                    Select “Create new secret key,” name it “Stride,” and copy
                    the key. If you already copied a key, use that one.
                  </li>
                  <li>Paste it below and select Save key.</li>
                </ol>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void update();
                  }}
                >
                  <label htmlFor="ai-secret">
                    {personal ? "Replace API key" : "API key"}
                    <input
                      id="ai-secret"
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      autoCapitalize="none"
                      value={key}
                      disabled={busy}
                      onChange={(e) => setKey(e.target.value)}
                      placeholder="sk-…"
                      maxLength={2048}
                      required
                    />
                  </label>
                  <p className="form-help">
                    Stored encrypted on the server for your signed-in account.
                    The saved key is never shown again or included in your
                    planning chat.
                  </p>
                  <p className="form-help">
                    OpenAI API usage is billed separately from ChatGPT. You may
                    need to add credits in{" "}
                    <a
                      href="https://platform.openai.com/settings/organization/billing"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      API billing
                    </a>
                    .
                  </p>
                  <button
                    className="primary full"
                    disabled={busy || !key.trim()}
                  >
                    {busy ? (
                      <Loader2 size={16} className="plan-spin" />
                    ) : (
                      <KeyRound size={16} />
                    )}
                    Save key
                  </button>
                </form>
                {personal && (
                  <button
                    className="text-button full"
                    disabled={busy}
                    onClick={() => void update(true)}
                  >
                    Remove personal key
                  </button>
                )}
              </details>
            </>
          )}
          {canShare && personal && (
            <div className="shared-ai-control">
              <div>
                <strong>Fund complimentary AI</strong>
                <p>
                  Uses your saved key for eligible accounts. Existing daily
                  limits still apply.
                </p>
              </div>
              <button
                className={shared ? "secondary" : "primary"}
                disabled={busy}
                onClick={() => void updateSharing()}
              >
                {shared ? "Turn off" : "Share my AI connection"}
              </button>
            </div>
          )}
          {error && (
            <p className="plan-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="connection-notice" role="status">
              {notice}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
