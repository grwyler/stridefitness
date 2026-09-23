"use client";

import { useEffect } from "react";

export function AccountConversion() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("account_created") !== "1") return;

    url.searchParams.delete("account_created");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    if (typeof window.gtag_report_conversion === "function") window.gtag_report_conversion("/");
    else window.location.assign("/");
  }, []);

  return null;
}
