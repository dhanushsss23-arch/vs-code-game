"use client";

import { useEffect, useState } from "react";

export function ThemeToggle({ label }: { label: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("eduverse-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const useDark = saved ? saved === "dark" : prefersDark;
    document.documentElement.dataset.theme = useDark ? "dark" : "light";
    setDark(useDark);
  }, []);

  function toggle() {
    const useDark = !dark;
    document.documentElement.dataset.theme = useDark ? "dark" : "light";
    window.localStorage.setItem("eduverse-theme", useDark ? "dark" : "light");
    setDark(useDark);
  }

  return <button className="theme-toggle" onClick={toggle} type="button" aria-label={label}>{dark ? "☼" : "◐"}</button>;
}
