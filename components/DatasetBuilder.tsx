"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, Info, Map, Save, Table2, TrendingUp } from "lucide-react";
import { encodeWorkspace, WORKSPACE_INDICATORS } from "@/lib/atlas-workspace";

const chartHelp: Record<string, string> = {
  Trend: "Shows whether a measure rises or falls over time. A change in direction does not explain what caused it.",
  Ranking: "Orders places by value. Check whether the measure is a total, percentage or per-person value before comparing.",
  Map: "Uses color to show where values are higher or lower. Darker does not automatically mean better or worse.",
  Table: "Shows exact observations and is best when you need to verify values, units, years and missing entries.",
};

export default function DatasetBuilder() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(["population", "poverty-incidence"]);
  const [geography, setGeography] = useState("Philippines — national");
  const [period, setPeriod] = useState("Latest available");
  const [chart, setChart] = useState("Trend");
  const [saved, setSaved] = useState(false);
  const recommendation = useMemo(() => selected.length > 1 ? "Table" : geography.includes("regional") ? "Map" : "Trend", [selected, geography]);
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const save = () => { localStorage.setItem("atlas-workspace", JSON.stringify({ selected, geography, period, chart, savedAt: new Date().toISOString() })); setSaved(true); };
  const buildScenario = () => {
    const workspace = { indicators: selected, geography, period, chart };
    localStorage.setItem("atlas-workspace", JSON.stringify({ ...workspace, savedAt: new Date().toISOString() }));
    router.push(`/scenario-lab?${encodeWorkspace(workspace)}`);
  };
  return <section className="builder" aria-labelledby="builder-heading">
    <div className="builder-head"><div><h2 id="builder-heading">Dataset builder</h2><p>Define an analysis without downloading an entire source. The source browser below retrieves records in small pages.</p></div><button type="button" className="button subtle" onClick={save}><Save size={15} /> {saved ? "Workspace saved" : "Save workspace"}</button></div>
    <div className="builder-layout"><div className="builder-controls">
      <fieldset><legend>1. Indicators</legend><div className="indicator-list">{WORKSPACE_INDICATORS.map(({id,name,domain,unit,source}) => <label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)} /><span><strong>{name}</strong><small>{domain} · {unit} · {source}</small></span></label>)}</div></fieldset>
      <div className="builder-fields"><label>2. Geography<select value={geography} onChange={event => setGeography(event.target.value)}><option>Philippines — national</option><option>Philippines — regional comparison</option><option>ASEAN — country comparison</option></select></label><label>3. Period<select value={period} onChange={event => setPeriod(event.target.value)}><option>Latest available</option><option>Last 5 observations</option><option>All available periods</option></select></label></div>
    </div><div className="builder-preview"><div className="preview-toolbar"><strong>Preview</strong><span>Recommended: {recommendation}</span></div><div className="chart-choices">{[["Trend", TrendingUp], ["Ranking", BarChart3], ["Map", Map], ["Table", Table2]].map(([name, Icon]) => <button key={name as string} type="button" className={chart === name ? "active" : ""} onClick={() => setChart(name as string)}><Icon size={16} />{name as string}</button>)}</div><div className="chart-explainer"><Info size={18} /><div><strong>How to read this {chart.toLowerCase()}</strong><p>{chartHelp[chart]}</p></div></div><div className="builder-selection"><span>Selected analysis</span><strong>{selected.length ? WORKSPACE_INDICATORS.filter(item=>selected.includes(item.id)).map(item=>item.name).join(" + ") : "Choose at least one indicator"}</strong><small>{geography} · {period}</small></div><p className="quality-note">Compatibility checks run before values are combined. Different units, geographic levels or reference periods stay separate and receive a warning.</p><button type="button" className="builder-scenario-action" disabled={!selected.length} onClick={buildScenario}>Build in Scenario Lab <ArrowRight size={16}/></button></div></div>
  </section>;
}
