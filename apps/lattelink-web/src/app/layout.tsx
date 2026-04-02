import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@/components/Analytics";
import { StructuredData } from "@/components/StructuredData";
import { siteDescription, siteName, siteTitle, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  applicationName: siteName,
  metadataBase: new URL(siteUrl),
  manifest: "/manifest.webmanifest",
  keywords: [
    "coffee shop ordering app",
    "coffee shop loyalty",
    "branded cafe ordering",
    "coffee shop mobile app",
    "coffee shop customer loyalty",
    "LatteLink",
  ],
  category: "technology",
  referrer: "origin-when-cross-origin",
  icons: {
    icon: "/icon.svg",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteName,
    description: siteDescription,
    type: "website",
    url: siteUrl,
    siteName,
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "LatteLink branded ordering and loyalty for independent coffee shops",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: ["/twitter-image"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <StructuredData />
        <Analytics />
        {children}
      </body>
    </html>
  );
}
