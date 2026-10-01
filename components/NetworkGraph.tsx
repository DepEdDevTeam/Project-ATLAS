"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

type GroupId = "demographics" | "infrastructure" | "workforce" | "resilience" | "resources" | "regions" | "outcomes";
type Group = {
  id: GroupId;
  label: string;
  x: number;
  y: number;
  count: number;
  inputs: string;
  effect: string;
  signals: string[];
};

const groups: Group[] = [
  { id: "demographics", label: "Social", x: 25, y: 25, count: 13, inputs: "Population, poverty, health, nutrition, education, housing and protection indicators", effect: "Social observations describe people and access to services. Definitions, population groups and reference periods remain attached to every value.", signals: ["Population need", "Household welfare", "Service access"] },
  { id: "infrastructure", label: "Economic", x: 27, y: 57, count: 16, inputs: "Work, income, prices, trade, agriculture, industry, budgets and investment", effect: "Economic indicators provide context for household welfare, productive activity and public resources without implying that one movement caused another.", signals: ["Growth and prices", "Employment", "Public resources"] },
  { id: "workforce", label: "Technological", x: 49, y: 16, count: 11, inputs: "Connectivity, digital access, ICT infrastructure, adoption and innovation", effect: "Technology measures can be compared across places only when access definitions, coverage and units align.", signals: ["Digital access", "Technology spending", "Adoption"] },
  { id: "resilience", label: "Environmental", x: 73, y: 27, count: 12, inputs: "Climate, hazards, disasters, natural resources, food security and resilience", effect: "Environmental observations describe exposure or conditions. A project listing alone is not a hazard layer or proof of reduced risk.", signals: ["Exposure context", "Natural resources", "Resilience"] },
  { id: "resources", label: "Political / Policy", x: 76, y: 59, count: 11, inputs: "Government programs, appropriations, agencies, public projects and implementation", effect: "Budget authority, payment and physical progress remain separate concepts. ATLAS shows each only when the source provides it.", signals: ["Appropriations", "Programs", "Project delivery"] },
  { id: "regions", label: "Geography & time", x: 21, y: 85, count: 12, inputs: "Countries, regions, local areas, reference periods and historical boundaries", effect: "A shared geography layer connects compatible observations while preserving boundary changes and unmatched source labels.", signals: ["Place profiles", "Historical boundaries", "Source coverage"] },
  { id: "outcomes", label: "Analysis outputs", x: 64, y: 85, count: 14, inputs: "Observed sources, derived measures and explicit user assumptions", effect: "ATLAS produces trends, maps, rankings, comparisons and validated what-if scenarios while labeling observed, derived and assumed values separately.", signals: ["Comparable trends", "Scenario results", "Quality notes"] },
];

const variation = (seed: number) => {
  const value = Math.sin(seed * 127.1) * 43758.5453;
  // Keep the decorative layout byte-for-byte stable across server and browser
  // math implementations so SVG attributes hydrate without warnings.
  return Number((value - Math.floor(value)).toFixed(7));
};

const nodes = groups.flatMap((group, groupIndex) =>
  Array.from({ length: group.count }, (_, index) => {
    const angle = variation(groupIndex * 31 + index + 1) * Math.PI * 2;
    const distance = 2 + variation(groupIndex * 83 + index + 2) * 6.2;
    return {
      group: group.id,
      x: group.x + Math.cos(angle) * distance,
      y: group.y + Math.sin(angle) * distance * 0.7,
      r: index === 0 ? 2.2 : 0.65 + variation(groupIndex * 47 + index + 3) * 1.1,
    };
  }),
);

export default function NetworkGraph() {
  const [selectedId, setSelectedId] = useState<GroupId>("demographics");
  const selected = groups.find((group) => group.id === selectedId)!;

  return (
    <section className="network-page simple-network coded-network" aria-labelledby="network-heading">
      <section className="simple-intro coded-intro">
        <h1 id="network-heading">Atlas data network</h1>
        <p>Select a STEEP domain to see how source observations become transparent analytical outputs.</p>
      </section>

      <section className="coded-layout" aria-label="Project Atlas data relationships">
        <div className="coded-graph" role="img" aria-label="Color-coded clusters of Atlas inputs connected to a central planning model and its outcomes">
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <g className="coded-edges">
              {groups.filter((group) => group.id !== "outcomes" && group.id !== "regions").map((group) => (
                <line key={group.id} x1={group.x} y1={group.y} x2="50" y2="51" className={selectedId === group.id ? "active" : ""} />
              ))}
              <line x1="50" y1="51" x2="64" y2="85" className={selectedId === "outcomes" ? "active" : ""} />
              <line x1="64" y1="85" x2="21" y2="85" className={selectedId === "regions" ? "active" : ""} />
              {nodes.map((node, index) => {
                const group = groups.find((item) => item.id === node.group)!;
                return <line key={index} x1={group.x} y1={group.y} x2={node.x} y2={node.y} className={selectedId === node.group ? "active" : ""} />;
              })}
            </g>
            <g className="coded-nodes">
              {nodes.map((node, index) => <circle key={index} className={`coded-${node.group} ${selectedId === node.group ? "active" : ""}`} cx={node.x} cy={node.y} r={node.r} />)}
              <circle className="coded-model" cx="50" cy="51" r="3" />
            </g>
            <g className="coded-labels">
              <text x="50" y="58" textAnchor="middle">Planning model</text>
              <text x="64" y="96" textAnchor="middle">Outcomes</text>
            </g>
          </svg>
        </div>

        <div className="coded-details">
          <div className="coded-legend" aria-label="Select a data group">
            {groups.map((group) => <button key={group.id} type="button" className={`coded-legend-button coded-${group.id} ${selectedId === group.id ? "active" : ""}`} aria-pressed={selectedId === group.id} onClick={() => setSelectedId(group.id)}><i aria-hidden="true" />{group.label}</button>)}
          </div>
          <section className="coded-explanation" aria-live="polite">
            <h2>{selected.label}</h2>
            <p className="coded-inputs">{selected.inputs}</p>
            <p>{selected.effect}</p>
            <h3>Connected signals</h3>
            <div className="coded-signals">{selected.signals.map((signal) => <span key={signal}>{signal}</span>)}</div>
          </section>
          <p className="coded-process">Source observation + geography + time + unit → compatibility checks → analysis</p>
          <p className="coded-method">Conceptual diagram; cluster sizes are decorative. PSA, BetterGov and ASEAN records support exploration and comparison. A record enters a Scenario Lab calculation only when a validated template defines its role, unit and limitations.</p>
          <Link className="coded-cta" href="/scenario-lab">Try the Scenario Lab <ChevronRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
    </section>
  );
}
