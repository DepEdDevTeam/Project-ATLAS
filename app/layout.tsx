import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./about/about.css";
import InteractionFeedback from "@/components/InteractionFeedback";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"], display: "swap" });
export const metadata: Metadata = { title: "Project Atlas | Philippine & ASEAN Policy Intelligence", description: "Explore data, compare places and test policy scenarios across the Philippines and ASEAN.", icons: { icon: "/favicon.png", apple: "/favicon.png" } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`try{const saved=localStorage.getItem('atlas-theme');document.documentElement.dataset.theme=saved==='light'||saved==='dark'?saved:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{}`}} /></head><body className={inter.className}>{children}<Suspense fallback={null}><InteractionFeedback /></Suspense></body></html>;
}
