import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "EDUVERSE | Learn through adventure",
  description: "A bilingual learning adventure built for curious minds.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = (await cookies()).get("eduverse_locale")?.value === "ta" ? "ta" : "en";
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
