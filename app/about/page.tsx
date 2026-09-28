import NetworkGraph from "@/components/NetworkGraph";
import DataSourcesTable from "@/components/DataSourcesTable";
import Link from "next/link";
import "./about.css";

export default function AboutPage() {
  return <main className="about-page">
    <header className="topbar network-topbar">
      <Link className="brand" href="/" aria-label="Project Atlas home"><img className="header-logo" src="/atlas-logo.png" alt="Project Atlas" /></Link>
      <Link href="/scenario-lab" className="simple-nav">Scenario Lab</Link>
    </header>
    <div className="about-columns"><NetworkGraph /><DataSourcesTable /></div>
  </main>;
}
