"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Props = { mode: "login" | "register" };

const copy = {
  en: {
    loginTitle: "Welcome back",
    registerTitle: "Start your journey",
    loginSubtitle: "Pick up where your curiosity left off.",
    registerSubtitle: "Create an account to begin your learning adventure.",
    name: "Your name",
    email: "Email address",
    password: "Password",
    login: "Log in",
    register: "Create account",
    working: "Please wait...",
    switchLogin: "Already have an account?",
    switchRegister: "New to EDUVERSE?",
    loginLink: "Log in",
    registerLink: "Create an account",
    home: "Back to home",
  },
  ta: {
    loginTitle: "மீண்டும் வருக",
    registerTitle: "உங்கள் பயணத்தைத் தொடங்குங்கள்",
    loginSubtitle: "உங்கள் கற்றல் பயணத்தைத் தொடருங்கள்.",
    registerSubtitle: "கற்றல் சாகசத்தைத் தொடங்கக் கணக்கை உருவாக்குங்கள்.",
    name: "உங்கள் பெயர்",
    email: "மின்னஞ்சல் முகவரி",
    password: "கடவுச்சொல்",
    login: "உள்நுழைக",
    register: "கணக்கை உருவாக்கு",
    working: "சற்றுக் காத்திருக்கவும்...",
    switchLogin: "ஏற்கனவே கணக்கு உள்ளதா?",
    switchRegister: "EDUVERSE-க்கு புதியவரா?",
    loginLink: "உள்நுழைக",
    registerLink: "கணக்கை உருவாக்கு",
    home: "முகப்புக்குத் திரும்பு",
  },
};

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const [language, setLanguage] = useState<"en" | "ta">("en");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const text = copy[language];
  const isRegister = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const payload = {
      ...(isRegister ? { displayName: formData.get("displayName") } : {}),
      email: formData.get("email"),
      password: formData.get("password"),
      preferredLocale: language === "en" ? "EN" : "TA",
    };

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to continue. Please try again.");
        return;
      }
      router.replace("/student");
      router.refresh();
    } catch {
      setError("Connection problem. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-top">
        <Link className="brand" href="/">eduverse<span>.</span></Link>
        <button className="language-toggle" type="button" onClick={() => setLanguage(language === "en" ? "ta" : "en")} aria-label="Change language">
          {language === "en" ? "தமிழ்" : "English"}
        </button>
      </div>
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="auth-back" href="/">← {text.home}</Link>
        <p className="eyebrow"><span className="eyebrow-dot" /> EDUVERSE</p>
        <h1 id="auth-title">{isRegister ? text.registerTitle : text.loginTitle}</h1>
        <p className="auth-subtitle">{isRegister ? text.registerSubtitle : text.loginSubtitle}</p>
        <form className="auth-form" onSubmit={submit}>
          {isRegister && (
            <label>
              {text.name}
              <input autoComplete="name" name="displayName" required minLength={2} maxLength={64} />
            </label>
          )}
          <label>
            {text.email}
            <input autoComplete="email" name="email" type="email" required maxLength={254} />
          </label>
          <label>
            {text.password}
            <input autoComplete={isRegister ? "new-password" : "current-password"} name="password" type="password" required minLength={isRegister ? 12 : 1} maxLength={128} />
            {isRegister && <span className="field-hint">Use at least 12 characters.</span>}
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button auth-submit" disabled={pending} type="submit">
            {pending ? text.working : isRegister ? text.register : text.login}<span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="auth-switch">
          {isRegister ? text.switchLogin : text.switchRegister}{" "}
          <Link href={isRegister ? "/login" : "/register"}>{isRegister ? text.loginLink : text.registerLink}</Link>
        </p>
      </section>
      <p className="auth-footer">Your learning adventure is yours to shape.</p>
    </main>
  );
}
