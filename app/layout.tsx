import type { Metadata, Viewport } from "next";
import "./globals.css";
import {getChatGPTUser} from './chatgpt-auth';
import {StrideSignIn} from '@/components/stride-sign-in';
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
      <body className="antialiased">{user ? children : <main className="signin-page"><section className="signin-card" aria-labelledby="signin-title"><div className="signin-brand"><span><Dumbbell size={24}/></span><strong>Stride</strong></div><div className="signin-copy"><p className="signin-kicker"><Sparkles size={15}/> Strength, at your pace</p><h1 id="signin-title">Welcome to Stride</h1><p>Your training, in one place.</p></div><StrideSignIn clientId={clientId}/><p className="signin-privacy">Your fitness data is yours. Stride only uses sign-in information to identify your account.</p></section></main>}</body>
    </html>
  );
}
