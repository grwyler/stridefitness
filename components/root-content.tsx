"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type RootContentProps = {
  children: ReactNode;
  marketing: ReactNode;
  authenticated: boolean;
};

export function RootContent({ children, marketing, authenticated }: RootContentProps) {
  const pathname = usePathname();
  const normalizedPath = pathname?.replace(/\/+$/, "") || "/";

  // This route is intentionally public and uses a separate reviewer credential.
  // The Site runtime does not provide the request path through Next's headers().
  if (normalizedPath === "/test-access" || authenticated) return children;
  return marketing;
}
