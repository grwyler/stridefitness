declare global {
  interface Window {
    gtag_report_conversion?: (url?: string) => false;
  }
}

export function finishAccountSignIn(isNewAccount: boolean) {
  if (isNewAccount && typeof window.gtag_report_conversion === "function") {
    window.gtag_report_conversion("/");
    return;
  }
  window.location.assign("/");
}
