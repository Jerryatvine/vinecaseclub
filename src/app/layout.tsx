import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Vine and Table Case Club",
  description: "Wine club dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const squareScriptSrc =
    process.env.NEXT_PUBLIC_SQUARE_APP_ID?.startsWith("sandbox-")
      ? "https://sandbox.web.squarecdn.com/v1/square.js"
      : "https://web.squarecdn.com/v1/square.js";

  return (
    <html lang="en">
      <body>
        <Script src={squareScriptSrc} strategy="beforeInteractive" />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}