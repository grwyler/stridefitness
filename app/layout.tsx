import type { Metadata, Viewport } from "next";
import "./globals.css";
import {getChatGPTUser} from './chatgpt-auth';
import {GoogleSignIn} from '@/components/google-sign-in';
import {AccountSwitcher} from '@/components/account-switcher';
import {env} from 'cloudflare:workers';
import {Dumbbell, Sparkles} from 'lucide-react';

export const dynamic='force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL("https://stridefitness.app"),
  title: "Stride — Adaptive Strength Tracker",
  description: "Log your workouts, see your progress, and find your next achievable target.",
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
  manifest: "/manifest.webmanifest",
  applicationName: "Stride Fitness",
  appleWebApp: { capable: true, title: "Stride", statusBarStyle: "default" },
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#245e49" };

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getChatGPTUser();
  const clientId = (env as unknown as {GOOGLE_CLIENT_ID?: string}).GOOGLE_CLIENT_ID ?? null;
  return (
    <html lang="en">
      <body className="antialiased">{user ? <><AccountSwitcher email={user.email}/>{children}</> : <main className="signin-page"><section className="signin-card" aria-labelledby="signin-title"><div className="signin-brand"><span><Dumbbell size={24}/></span><strong>Stride</strong></div><div className="signin-copy"><p className="signin-kicker"><Sparkles size={15}/> Strength, at your pace</p><h1 id="signin-title">Your training, in one place.</h1><p>Pick up where you left off and keep your workouts, progress, and plan private.</p></div><GoogleSignIn clientId={clientId}/><p className="signin-privacy">By continuing, you agree to Stride’s private, account-based training experience.</p></section></main>}</body>
    </html>
  );
}
