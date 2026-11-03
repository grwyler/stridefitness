import type { Metadata, Viewport } from "next";
import "./globals.css";
import {getChatGPTUser} from './chatgpt-auth';
import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {MarketingHome} from '@/components/marketing-home';
import {AccountConversion} from '@/components/account-conversion';

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
  const requestHeaders = await headers();
  const currentUrl = requestHeaders.get('x-url') ?? requestHeaders.get('referer') ?? '';
  const search = new URLSearchParams(currentUrl.includes('?') ? currentUrl.slice(currentUrl.indexOf('?') + 1) : '');
  const createAccount = search.get('createAccount') === '1' || requestHeaders.get('cookie')?.split(';').some((value) => value.trim() === 'stride_create_account=1') === true;
  const signIn = search.get('signin') === '1' || requestHeaders.get('cookie')?.split(';').some((value) => value.trim() === 'stride_signin=1') === true;
  const authError = search.get('auth');
  const showAuthScreen = (createAccount || signIn || authError) && (!user || user.accountType === 'guest');
  const initialMode = createAccount || (!signIn && !authError) ? 'create' : 'signin';
  const clientId = (env as unknown as {GOOGLE_CLIENT_ID?: string}).GOOGLE_CLIENT_ID ?? null;
  return (
    <html lang="en">
      <head>
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18469761186"></script>
        <script dangerouslySetInnerHTML={{__html: `window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', 'AW-18469761186');\nfunction gtag_report_conversion(url) {\n  var completed = false;\n  var callback = function () {\n    if (typeof(url) != 'undefined' && !completed) {\n      completed = true;\n      window.location = url;\n    }\n  };\n  gtag('event', 'conversion', {\n    'send_to': 'AW-18469761186/-WbTCNea24IdEKLhiOdE',\n    'value': 1.0,\n    'currency': 'USD',\n    'event_callback': callback\n  });\n  if (typeof(url) != 'undefined') window.setTimeout(function () { if (!completed) { completed = true; window.location = url; } }, 1500);\n  return false;\n}`}} />
      </head>
      <body className="antialiased"><AccountConversion />{user && !showAuthScreen ? children : <MarketingHome clientId={clientId} authError={authError} initialMode={initialMode} hasGuestProgress={user?.accountType==='guest'} />}</body>
    </html>
  );
}
