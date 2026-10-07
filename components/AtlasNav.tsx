"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const links = [
  ["/data-explorer", "Data Explorer"],
  ["/place-profile", "Place Profile"],
  ["/compare", "Compare"],
  ["/scenario-lab", "Scenario Lab"],
  ["/agent-framework", "Agent Framework"],
  ["/projects-budgets", "Projects & Budgets"],
  ["/asean-benchmarking", "ASEAN Benchmarking"],
] as const;

export default function AtlasNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  return <header className={`atlas-nav ${compact ? "compact" : ""}`}>
    <Link className="brand" href="/" aria-label="Project Atlas home"><img className="header-logo" src="/atlas-logo.png" alt="Project Atlas" /></Link>
    <nav aria-label="Primary navigation">{links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}>{label}</Link>)}</nav>
    <div className="atlas-nav-actions"><Link href="/about">About</Link><ThemeToggle /></div>
  </header>;
}
