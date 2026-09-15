import type { Metadata, Viewport } from "next";
import "./globals.css";
import {requireChatGPTUser} from './chatgpt-auth';

export const dynamic='force-dynamic';

export const metadata: Metadata = {
  title: "Stride — Adaptive Strength Tracker",
  description: "Log your workouts, see your progress, and find your next achievable target.",
  manifest: "/manifest.webmanifest",
  applicationName: "Stride Fitness",
  appleWebApp: { capable: true, title: "Stride", statusBarStyle: "default" },
  other: { "mobile-web-app-capable": "yes" },
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
  await requireChatGPTUser('/');
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
