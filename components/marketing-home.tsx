"use client";

import { useState } from "react";
import { ArrowRight, Check, Dumbbell, Sparkles } from "lucide-react";
import {useLandingAnalytics} from "@/components/landing-analytics";

export function MarketingHome() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const track=useLandingAnalytics();

  async function startFree() {
    setBusy(true);
    setError("");
    try {
      await track("engagement");
      const response = await fetch("/api/auth/guest", { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Guest access is unavailable right now.");
      window.location.assign("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Stride.");
      setBusy(false);
    }
  }

  return (
    <main className="marketing-home">
      <header className="marketing-nav">
        <a href="/" className="marketing-brand" aria-label="Stride home"><span><Dumbbell size={20} /></span> stride</a>
        <a href="/api/auth/signin" className="marketing-signin" data-track="landing_sign_in">Sign in</a>
      </header>
      <section className="marketing-hero">
        <div className="marketing-copy">
          <p className="marketing-kicker"><Sparkles size={15} /> FREE AI COACHING · FIRST 100 USERS</p>
          <h1>Log your sets. Know what to aim for next time.</h1>
          <p className="marketing-description">Stride remembers what you lifted and gives you a clear target for your next workout—like one more rep or a little more weight.</p>
          <div className="marketing-actions">
            <button className="marketing-cta" data-track="hero_try_free" onClick={() => void startFree()} disabled={busy}>{busy ? "Starting…" : "Try Stride free"}<ArrowRight size={18} /></button>
            <span className="marketing-no-account"><Check size={15} /> No account required</span>
          </div>
          {error && <p className="marketing-error" role="alert">{error}</p>}
          <p className="marketing-trust">Your workouts stay yours. Save them to an account whenever you’re ready.</p>
        </div>
        <div className="marketing-demo" aria-label="Preview of logging a workout and receiving an AI coaching recommendation">
          <div className="demo-window">
            <div className="demo-topbar"><span className="demo-brand"><span><Dumbbell size={15} /></span> stride</span><span className="demo-session">EXAMPLE WORKOUT</span><span className="demo-dot" /></div>
            <div className="demo-body">
              <div className="demo-heading"><div><span className="demo-label">LOG YOUR LIFT</span><h2>Barbell bench press</h2></div><span className="demo-complete"><Check size={14} /> Saved</span></div>
              <div className="demo-set-head"><span>SET</span><span>WEIGHT</span><span>REPS</span><span /></div>
              <div className="demo-set"><b>1</b><strong>135 <small>lb</small></strong><strong>8 <small>reps</small></strong><span className="demo-check"><Check size={14} /></span></div>
              <div className="demo-set"><b>2</b><strong>135 <small>lb</small></strong><strong>8 <small>reps</small></strong><span className="demo-check"><Check size={14} /></span></div>
              <div className="demo-set"><b>3</b><strong>135 <small>lb</small></strong><strong>7 <small>reps</small></strong><span className="demo-check"><Check size={14} /></span></div>
              <div className="demo-coach"><div className="demo-coach-title"><span><Sparkles size={15} /></span> YOUR AI COACH <span className="demo-new">NEXT STEP</span></div><p>Nice work. <strong>Stay at 135 lb</strong> next time and aim for 8 reps on all 3 sets before adding weight.</p><div className="demo-reason">Based on your logged sets</div></div>
            </div>
            <div className="demo-caption"><span>Next time: repeat 135 lb and aim for 8 reps on all 3 sets.</span></div>
          </div>
          <div className="demo-float"><span><Check size={15} /></span><div><strong>Progress that makes sense</strong><small>Every set informs your next target</small></div></div>
        </div>
      </section>
      <footer className="marketing-footer"><span>Start with one workout. No account needed.</span><button data-track="footer_try_free" onClick={() => void startFree()} disabled={busy}>Try Stride free <ArrowRight size={15} /></button></footer>
      <p className="marketing-analytics-note">We count anonymous page views, interface areas opened, clicks, and active time to improve Stride. Where available, country and broad region help us understand where visitors come from. Starting a guest trial links it to that visit.</p>
    </main>
  );
}
