import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import "./globals.css";

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body"
});

const displayFont = Syne({
  subsets: ["latin"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "LatteLink Admin Console",
  description: "Internal control plane for client onboarding, operations, and launch readiness."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>{children}</body>
    </html>
  );
}
