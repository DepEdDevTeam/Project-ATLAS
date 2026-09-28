import { ArrowDown, ArrowRight, BookOpen, Hammer, School, SlidersHorizontal, Wallet, type LucideIcon } from "lucide-react";
import { schoolYear } from "@/lib/enrollment-types";
import { explainScenario } from "@/lib/scenario-explanation";
import type { Levers, Outcomes } from "@/lib/scenario-types";

const fmt = (n: number) => n.toLocaleString("en-PH", { maximumFractionDigits: 2 });
function Node({ icon: Icon, label, value, active = false }: { icon: LucideIcon; label: string; value: string; active?: boolean }) {
  return <div className={`cause-node${active ? " cause-active" : ""}`}><Icon size={30} strokeWidth={1.65} aria-hidden="true"/><strong>{label}</strong><span>{value}</span></div>;
}

export default function ScenarioCauseFlow({ to, from, levers, year, baseYear }: { to: Outcomes; from: Outcomes; levers: Levers; year: number; baseYear: number }) {
  const e = explainScenario(to, from, levers);
  const baseline = year === baseYear;
  const fundingLabel = baseline ? "Starting point" : e.fundingChange > 0 ? "More funding" : e.fundingChange < 0 ? "Less funding" : to.availableBudget === 0 ? "No funding" : "Same funding";
  const rate = levers.enrollmentGrowth + levers.progression + levers.access;
  return <div className="cause-flow">
    <p className="cause-period">SY {schoolYear(year)} <span>{baseline ? "Scenario baseline" : `vs ${schoolYear(year - 1)}`}</span></p>
    <div key={year} className="cause-diagram" aria-label="Funding to classroom capacity">
      <Node icon={Wallet} label={fundingLabel} value={baseline ? "Before annual funding" : `₱${fmt(to.availableBudget)}M eligible`} active={to.availableBudget > 0}/>
      <div className="cause-fork" aria-hidden="true"><ArrowDown size={20}/><ArrowDown size={20}/></div>
      <div className="cause-branches">
        <Node icon={School} label={e.added > 0 ? "More classrooms" : "No new rooms"} value={`+${fmt(e.added)} rooms built`} active={e.added > 0}/>
        <Node icon={Hammer} label={e.restored > 0 ? "Rooms restored" : "No rooms restored"} value={`+${fmt(e.restored)} usable rooms`} active={e.restored > 0}/>
      </div>
      <div className="cause-fork cause-join" aria-hidden="true"><ArrowDown size={20}/><ArrowDown size={20}/></div>
      <Node icon={BookOpen} label={e.places > 0 ? "More learner places" : "No added places"} value={`+${fmt(e.places)} estimated places`} active={e.places > 0}/>
    </div>
    <p className="cause-explanation" aria-live="polite" aria-atomic="true">{baseline ? "Starting enrollment and assumed usable rooms, before any scenario funding is applied. Advance the timeline to see each year’s changes." : e.reason}</p>
    {!baseline && <div className="cause-enrollment"><SlidersHorizontal size={19} aria-hidden="true"/><span>{rate > 0 ? "+" : ""}{fmt(rate)}%<small>Enrollment assumptions</small></span><ArrowRight size={17} aria-hidden="true"/><span>{e.enrollmentChange > 0 ? "+" : ""}{fmt(e.enrollmentChange)}<small>Learners vs last year</small></span></div>}
    <p className="cause-caveat">Classroom places are estimated capacity. Enrollment follows growth, progression and access assumptions; teacher staffing is not modeled.</p>
  </div>;
}

