import NetworkGraph from "@/components/NetworkGraph";
import DataSourcesTable from "@/components/DataSourcesTable";
import Link from "next/link";
import AtlasNav from "@/components/AtlasNav";
import "./about.css";

export default function AboutPage() {
  return <main className="about-page">
    <AtlasNav compact />
    <div className="about-columns"><NetworkGraph /><DataSourcesTable /></div>
  </main>;
}
