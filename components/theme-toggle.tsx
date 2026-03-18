"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem("llmadness-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const currentTheme =
      (document.documentElement.getAttribute("data-theme") as Theme | null) ??
      "light";
    setTheme(currentTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <button
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      className="theme-toggle"
      onClick={toggleTheme}
      type="button"
    >
      <span className="theme-toggle-ball" aria-hidden="true">
        <span className="theme-toggle-line theme-toggle-line-vertical" />
        <span className="theme-toggle-line theme-toggle-line-horizontal" />
        <span className="theme-toggle-line theme-toggle-line-arc-left" />
        <span className="theme-toggle-line theme-toggle-line-arc-right" />
      </span>
    </button>
  );
}
