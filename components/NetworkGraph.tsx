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
  { id: "demographics", label: "Social", x: 25, y: 25, count: 13, inputs: "Observed enrollment; assumed growth, net progression and access", effect: "Reported enrollment anchors the scenario. The three assumed rate contributions determine annual estimated enrollment. Sex counts describe the source, not disadvantage.", signals: ["Enrollment history", "Estimated enrollment", "Sex breakdown"] },
  { id: "infrastructure", label: "Economic", x: 27, y: 57, count: 16, inputs: "Requested classrooms, rehabilitation, expansion, annexes; assumed unit and maintenance costs", effect: "Funded units follow explicit budget shares and costs. Gaps require an assumed inventory. Annex affordability alone does not establish feasibility.", signals: ["Funded units", "Conditional room gap", "Estimated spend"] },
  { id: "workforce", label: "Technological", x: 49, y: 16, count: 11, inputs: "Assumed ICT share and provision cost in added rooms", effect: "ICT provision adds to the assumed cost per new room. No observed connectivity or teacher readiness is connected.", signals: ["Effective unit costs", "Affordable rooms"] },
  { id: "resilience", label: "Environmental", x: 73, y: 27, count: 12, inputs: "Assumed exposed rooms, retrofit requests and costs", effect: "Affordable upgrades are capped by remaining assumed exposed rooms. No hazard layer, avoided damage or risk reduction is estimated.", signals: ["Funded upgrades", "Remaining assumed exposure", "Estimated spend"] },
  { id: "resources", label: "Political / Policy", x: 76, y: 59, count: 11, inputs: "Assumed budget, eligibility, funding interval and learners-per-room ratio", effect: "The funding interval and eligible share set the available budget. Planning ratios are editable assumptions, not loaded official DepEd standards. Equity reserves remain unassigned.", signals: ["Eligible budget", "Unspent funds", "Conditional room requirements"] },
  { id: "regions", label: "Observed areas", x: 21, y: 85, count: 12, inputs: "School-year aggregates, qualified place names and reporting coverage", effect: "School through region selections use normalized DepEd records. Map colors describe enrollment changes, with boundary limitations. No mock pressure offsets or confidence scores are used.", signals: ["Observed enrollment change", "Matched-school change", "Source coverage"] },
  { id: "outcomes", label: "Computed estimates", x: 64, y: 85, count: 14, inputs: "Observed baseline plus explicit STEEP assumptions", effect: "Repeatable arithmetic produces enrollment, affordable project units, spend and a conditional room gap. No causal effect or actual funding impact is asserted.", signals: ["Scenario timeline", "Formula explanation", "Allocation comparison"] },
];

const variation = (seed: number) => {
  const value = Math.sin(seed * 127.1) * 43758.5453;
  return value - Math.floor(value);
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
        <p>Select a color to distinguish observed enrollment from scenario assumptions.</p>
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
          <p className="coded-process">Previous year + selected inputs → yearly formulas → next year&apos;s outlook</p>
          <p className="coded-method">Conceptual diagram; cluster sizes are decorative. Scenarios use deterministic formulas, with no ML prediction. PSA, BetterGov, flood-control and ASEAN records in the source browser remain context only and do not feed the calculations.</p>
          <Link className="coded-cta" href="/scenario-lab">Try the Scenario Lab <ChevronRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
    </section>
  );
}
