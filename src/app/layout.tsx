import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { brand } from "@/config/brand";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Toaster } from "@/components/layout/Toaster";
import { PurchaseOverlay } from "@/components/market/PurchaseOverlay";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", weight: ["400", "500", "600", "700"], display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", weight: ["400", "500"], display: "swap" });

const TITLE = `${brand.name} — ${brand.line}`;

export const metadata: Metadata = {
  metadataBase: new URL(brand.siteUrl),
  title: { default: TITLE, template: `%s · ${brand.name}` },
  description: brand.description,
  openGraph: { title: TITLE, description: brand.hook, siteName: brand.name, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: brand.hook },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#06050c", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-svh">
        <Providers>
          <Navbar />
          <main className="relative">{children}</main>
          <MobileNav />
          <PurchaseOverlay />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
