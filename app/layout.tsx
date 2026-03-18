import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLMadness",
  description: "Foundation-model March Madness bracket arena"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                const savedTheme = localStorage.getItem("llmadness-theme");
                const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                const theme = savedTheme || (prefersDark ? "dark" : "light");
                document.documentElement.setAttribute("data-theme", theme);
              })();
            `
          }}
        />
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
