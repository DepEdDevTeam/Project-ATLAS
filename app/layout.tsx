import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });
export const metadata: Metadata = { title: "Scenario Lab | Project Atlas", description: "Education planning scenario prototype", icons: { icon: "/favicon.png", apple: "/favicon.png" } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`try{const saved=localStorage.getItem('atlas-theme');document.documentElement.dataset.theme=saved==='light'||saved==='dark'?saved:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{}`}} /></head><body className={inter.className}>{children}</body></html>;
}
