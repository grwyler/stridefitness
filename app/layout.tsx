import type { Metadata, Viewport } from "next";
import "./globals.css";
import {getChatGPTUser, chatGPTSignInPath} from './chatgpt-auth';
import {GoogleSignIn} from '@/components/google-sign-in';
import {env} from 'cloudflare:workers';

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
      <body className="antialiased">{user ? children : <main className="signin-page"><h1>Welcome to Stride</h1><p>Sign in to keep your training private and synced.</p><GoogleSignIn clientId={clientId}/><a className="primary" href={chatGPTSignInPath('/')} target="_top">Continue with ChatGPT</a></main>}</body>
    </html>
  );
}
