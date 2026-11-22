import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EDUVERSE | Learn through adventure",
  description: "A bilingual learning adventure built for curious minds.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
