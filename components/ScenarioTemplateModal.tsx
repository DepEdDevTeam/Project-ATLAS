"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Building2, Cpu, GraduationCap, HeartPulse, Home, Leaf, Sprout, TrendingUp, X } from "lucide-react";

const templates = [
  ["Education access", "Social", GraduationCap, "Enrollment, access and classroom capacity", "/scenario-lab?template=education-access"],
  ["Poverty reduction", "Social", TrendingUp, "Poverty, population and public support", "/scenario-lab?indicators=population,poverty-incidence&geography=Philippines%20%E2%80%94%20national&period=Latest%20available&chart=Trend"],
  ["Health-service expansion", "Social", HeartPulse, "Population need, services and health budgets", false],
  ["Employment generation", "Economic", BriefcaseBusiness, "Labor force, sectors and program spending", "/scenario-lab?indicators=employment-rate,population&geography=Philippines%20%E2%80%94%20national&period=Latest%20available&chart=Trend"],
  ["Food security", "Economic / Environmental", Sprout, "Prices, agriculture, nutrition and climate", false],
  ["Housing and urban growth", "Social", Home, "Households, density, services and housing", false],
  ["Disaster resilience", "Environmental", Leaf, "Exposure, projects and resilience investment", "/scenario-lab?indicators=disaster-indicators,population&geography=Philippines%20%E2%80%94%20national&period=Latest%20available&chart=Trend"],
  ["Digital inclusion", "Technological", Cpu, "Connectivity, access and technology spending", "/scenario-lab?indicators=internet-access,population&geography=Philippines%20%E2%80%94%20national&period=Latest%20available&chart=Trend"],
  ["Infrastructure allocation", "Political / Policy", Building2, "Budgets, projects, geography and delivery", "/scenario-lab?indicators=government-appropriations,public-projects&geography=Philippines%20%E2%80%94%20national&period=Latest%20available&chart=Trend"],
] as const;

export default function ScenarioTemplateModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const opener = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const closeModal = () => { setOpen(false); window.requestAnimationFrame(() => opener.current?.focus()); };
  useEffect(() => { if (!open) return; const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeModal(); if (event.key === "Tab" && dialog.current) { const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]')]; const first = focusable[0], last = focusable.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }; window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey); }, [open]);
  const shown = templates.filter(item => `${item[0]} ${item[1]}`.toLowerCase().includes(query.toLowerCase()));
  return <><button ref={opener} type="button" className="template-button" onClick={() => setOpen(true)}>Choose scenario template</button>{open && <div className="template-overlay" role="presentation" onMouseDown={event => event.currentTarget === event.target && closeModal()}><section ref={dialog} className="template-modal" role="dialog" aria-modal="true" aria-labelledby="template-title"><button className="template-close" onClick={closeModal} aria-label="Close template chooser"><X size={18} /></button><h2 id="template-title">Choose a scenario template</h2><p>Templates organize indicators and assumptions through STEEP. Only models with sufficient compatible data produce calculated outcomes.</p><label className="template-search">Find a template<input autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search topic or STEEP domain" /></label><div className="template-list">{shown.map(([name, domain, Icon, description, href]) => <button key={name} type="button" disabled={!href} onClick={() => { if (href) { setOpen(false); router.push(href); } }}><Icon size={20} /><span><strong>{name}</strong><small>{domain} · {description}</small></span><em>{href ? "Open scenario" : "Data workspace first"}</em></button>)}</div><p className="template-footnote">Unavailable templates can still be explored in Data Explorer and Compare; scenario formulas will be enabled only after their definitions and source compatibility are validated.</p></section></div>}</>;
}
