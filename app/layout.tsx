import type { Metadata } from "next";
import "./globals.css";
import {requireChatGPTUser} from './chatgpt-auth';

export const dynamic='force-dynamic';

export const metadata: Metadata = {
  title: "Stride — Adaptive Strength Tracker",
  description: "Log your workouts, see your progress, and find your next achievable target.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

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
