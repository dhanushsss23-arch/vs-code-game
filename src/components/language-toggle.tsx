"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LanguageToggle({ locale }: { locale: "EN" | "TA" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredLocale: locale === "EN" ? "TA" : "EN" }),
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error ?? "Unable to update language preference.");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update language preference.");
    } finally {
      setPending(false);
    }
  }

  return <span className="language-toggle-wrap">
    <button className="language-toggle" onClick={() => void toggle()} disabled={pending} type="button" aria-label="Change language">
      {locale === "EN" ? "தமிழ்" : "English"}
    </button>
    {error && <span className="nav-error" role="alert">{error}</span>}
  </span>;
}
