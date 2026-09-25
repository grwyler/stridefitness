"use client";

import { useEffect, useState } from "react";

export function LocalTime({ value }: { value: string | null }) {
  const [formatted, setFormatted] = useState(value ? "" : "Not recorded");
  useEffect(() => {
    if (value) setFormatted(new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }));
  }, [value]);
  if (!value) return <>Not recorded</>;
  return <time dateTime={value}>{formatted || "…"}</time>;
}
