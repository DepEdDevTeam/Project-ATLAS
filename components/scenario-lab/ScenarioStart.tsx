"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, BriefcaseBusiness, Building2, Database, GraduationCap, Leaf, Network, Users } from "lucide-react";
import AtlasNav from "@/components/AtlasNav";
import ScenarioTemplateModal from "@/components/ScenarioTemplateModal";

const scenarios = [
  { title: "Population & poverty", domain: "Social", description: "Translate official population and poverty rates into estimated numbers of people.", icon: Users, href: "/scenario-lab?indicators=population,poverty-incidence&geography=Philippines%20%E2%80%94%20national&period=Latest%20available&chart=Trend", status: "PSA baselines available" },
  { title: "Work & employment", domain: "Economic", description: "Test employment-rate assumptions while keeping the labor-force baseline visible.", icon: BriefcaseBusiness, href: "/scenario-lab?indicators=employment-rate,population&geography=Philippines%20%E2%80%94%20national&period=Latest%20available&chart=Trend", status: "PSA baselines available" },
  { title: "Public spending & projects", domain: "Political / Policy", description: "Bring BetterGov appropriations and public-project records into one scenario context.", icon: Building2, href: "/scenario-lab?indicators=government-appropriations,public-projects&geography=Philippines%20%E2%80%94%20national&period=Latest%20available&chart=Trend", status: "Source records required" },
  { title: "Digital access", domain: "Technological", description: "Explore how connectivity indicators move alongside population and regional context.", icon: Network, href: "/scenario-lab?indicators=internet-access,population&geography=Philippines%20%E2%80%94%20national&period=Latest%20available&chart=Trend", status: "Source records required" },
  { title: "Disaster resilience", domain: "Environmental", description: "Combine exposure indicators, population, and public investment without implying causality.", icon: Leaf, href: "/scenario-lab?indicators=disaster-indicators,population&geography=Philippines%20%E2%80%94%20national&period=Latest%20available&chart=Trend", status: "Source records required" },
] as const;

export default function ScenarioStart() {
  return <main className="lab-shell scenario-start"><AtlasNav compact />
    <section className="scenario-context"><div><strong>Scenario Lab</strong><span>Cross-domain analysis using selected official datasets</span></div><ScenarioTemplateModal /></section>
    <header className="scenario-start-head"><div><h1>Build a scenario around the question—not one fixed subject.</h1><p>Select a starting context across STEEP, or bring your own indicators from Data Explorer. ATLAS keeps observed data, user assumptions, and calculated estimates visibly separate.</p><div className="scenario-start-actions"><Link className="button primary" href="/data-explorer"><Database size={16}/> Build from Data Explorer</Link><Link className="button subtle" href="/compare"><BarChart3 size={16}/> Compare indicators</Link></div></div><aside><strong>How it works</strong><ol><li>Choose indicators and geography.</li><li>Review official starting figures.</li><li>Adjust assumptions and read the estimated impact.</li></ol></aside></header>
    <section className="scenario-start-body" aria-labelledby="starting-points"><div className="scenario-start-copy"><h2 id="starting-points">Start with a policy context</h2><p>These shortcuts preselect compatible indicators. Items marked “source records required” still open as workspaces, but ATLAS will not invent a baseline.</p></div><div className="scenario-start-list">{scenarios.map(({ title, domain, description, icon: Icon, href, status }) => <Link key={title} href={href}><Icon size={21}/><span><small>{domain}</small><strong>{title}</strong><p>{description}</p></span><em>{status}</em><ArrowRight size={17}/></Link>)}</div></section>
    <section className="scenario-start-education"><div><GraduationCap size={22}/><span><strong>Need the enrollment and classroom model?</strong><p>Education remains available as a specialized, validated deterministic template—not the default identity of Scenario Lab.</p></span></div><Link className="button subtle" href="/scenario-lab?template=education-access">Open Education template <ArrowRight size={15}/></Link></section>
  </main>;
}
