"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, MapPinned } from "lucide-react";
import ScenarioMap from "./ScenarioMap";
import TrendCharts, { TrendScorecards, historyPoints, scenarioPoints } from "./TrendCharts";
import WhyThisHappens from "./WhyThisHappens";
import PlanningControls from "./PlanningControls";
import ThemeToggle from "@/components/ThemeToggle";
import AtlasNav from "@/components/AtlasNav";
import ScenarioTemplateModal from "@/components/ScenarioTemplateModal";
import { ScenarioLabSkeleton } from "@/components/Skeleton";
import { BASE_LEVERS, INTERVENTIONS, SHARES, STRATEGIES, TARGET_YEAR } from "@/lib/scenario-data";
import { timeline } from "@/lib/scenario-engine";
import { LEVELS, schoolYear, type AreaOption, type EnrollmentData, type EnrollmentYear, type Scope } from "@/lib/enrollment-types";
import type { Levers, Outcomes, Strategy } from "@/lib/scenario-types";
import { useSearchParams } from "next/navigation";
import { readWorkspace } from "@/lib/atlas-workspace";
import AnalysisScenarioWorkspace from "./AnalysisScenarioWorkspace";
const fmt=(n:number|null|undefined)=>n==null?"Unknown":n.toLocaleString("en-PH",{maximumFractionDigits:0});
const money=(n:number)=>`₱${n.toLocaleString("en-PH",{maximumFractionDigits:2})}M`;
const percent=(n:number|null)=>n===null?"Unavailable":`${n>0?"+":""}${n.toFixed(2)}%`;

function PlanningSignals({current,previous,outcome}:{current:EnrollmentYear;previous?:EnrollmentYear;outcome?:Outcomes}) {
  const growth=previous?.enrollment&&current.enrollment!==null?(current.enrollment/previous.enrollment-1)*100:null;
  const matched=current.matchedPrevious&&current.matchedCurrent!==null?(current.matchedCurrent/current.matchedPrevious-1)*100:null;
  return <section className="panel dimensions-panel"><div className="panel-head"><h2>Planning Signal</h2></div><div className="dimension-list">
    <div className="dimension"><div><span>Observed enrollment change</span><strong>{percent(growth)}</strong></div><small>SY {schoolYear(current.year)} vs preceding year, all records</small></div>
    <div className="dimension"><div><span>Matched-school change</span><strong>{percent(matched)}</strong></div><small>{fmt(current.matched)} matching school IDs in the same area and sector</small></div>
    <div className="dimension"><div><span>Female share of reported counts</span><strong>{current.enrollment&&current.female!==null?(current.female/current.enrollment*100).toFixed(1)+"%":"Unavailable"}</strong></div><small>Sex breakdown is descriptive; not a measure of access or disadvantage.</small></div>
    <div className="dimension"><div><span>Schools with numeric counts</span><strong>{fmt(current.reporting)} / {fmt(current.schools)}</strong></div></div>
    <div className="dimension"><div><span>Numeric source cells</span><strong>{(current.knownCells/current.sourceCells*100).toFixed(1)}%</strong></div><div className="dimension-track"><i style={{width:`${current.knownCells/current.sourceCells*100}%`}}/></div><small>Blanks may be non-applicable or unreported. This is not statistical confidence.</small></div>
    <div className="dimension confidence"><div><span>{outcome?"Gap under selected assumptions":"Actual capacity pressure"}</span><strong>{outcome?fmt(outcome.remainingGap):"Unknown"}</strong></div><small>{outcome?.remainingGap!=null?"Computed room count, conditional on the assumed inventory.":"Classroom, condition and school-capacity inventories are not supplied."}</small></div>
  </div></section>;
}

function LoadedLab({data,scopeControls}:{data:EnrollmentData;scopeControls:ReactNode}) {
  const latest=data.history.at(-1)!;
  const [levers,setLevers]=useState<Levers>({...BASE_LEVERS});
  const [strategy,setStrategy]=useState<Strategy>("Balanced");
  const [view,setView]=useState<"history"|"scenario">("history");
  const [compare,setCompare]=useState(false);
  const [index,setIndex]=useState(data.history.length-1);
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState<1|2>(1);
  const [assumptions,setAssumptions]=useState(false);
  const computed=useMemo(()=>{
    if(latest.enrollment===null)return {error:"The latest school-year record has no numeric enrollment counts."};
    try {
      const years=timeline(latest.enrollment,latest.year,TARGET_YEAR,levers,strategy);
      const base=timeline(latest.enrollment,latest.year,TARGET_YEAR,{...levers,enrollmentGrowth:0,progression:0,access:0,newRooms:0,rehabRooms:0,expansionRooms:0,annexes:0,resilienceRooms:0},strategy);
      const comparisons=STRATEGIES.map(s=>({strategy:s,years:timeline(latest.enrollment!,latest.year,TARGET_YEAR,levers,s)}));
      return {years,base,comparisons,error:null};
    } catch(e){return {error:e instanceof Error?e.message:"Invalid assumptions"};}
  },[latest,levers,strategy]);
  const points=view==="history"?historyPoints(data.history):computed.years?scenarioPoints(computed.years):[];
  const safeIndex=Math.min(index,Math.max(0,points.length-1));
  const year=points[safeIndex]?.year??latest.year;
  const current=view==="history"?data.history[safeIndex]:latest;
  const previous=data.history.find(h=>h.year===current.year-1);
  const outcome=view==="scenario"?computed.years?.[safeIndex]?.outcomes:undefined;
  const prior=view==="scenario"?computed.years?.[Math.max(0,safeIndex-1)]?.outcomes:undefined;
  const signals=useMemo(()=>data.signals.filter(s=>s.year===(view==="history"?year:latest.year)),[data.signals,view,year,latest.year]);
  const setTimeline=(next:"history"|"scenario")=>{setView(next);setIndex(next==="history"?data.history.length-1:1);setPlaying(false);};
  const change=(key:keyof Levers,value:number|boolean)=>{setLevers(l=>({...l,[key]:value}));if(view==="history")setTimeline("scenario");setPlaying(false);};
  useEffect(()=>{
    if(!playing)return;
    if(safeIndex>=points.length-1){setPlaying(false);return;}
    const timer=window.setTimeout(()=>setIndex(i=>i+1),1300/speed);
    return()=>window.clearTimeout(timer);
  },[playing,safeIndex,points.length,speed]);
  return <><section className="scope-bar" aria-label="Enrollment area selection">{scopeControls}{points[safeIndex]&&<TrendScorecards point={points[safeIndex]} history={view==="history"}/>}</section><div className="workspace"><PlanningControls levers={levers} onChange={change}/>
    <section className="outlook-column"><div className="outlook-panel panel"><div className="panel-head outlook-head"><div><h2>{view==="history"?"Enrollment history":"Infrastructure scenario"}</h2><p className="period-label">{view==="history"?"Observed":"Computed estimate"} · SY {schoolYear(year)}</p></div><div className="view-switch"><button className={!compare?"active":""} onClick={()=>setCompare(false)}>Outlook</button><button className={compare?"active":""} onClick={()=>{setCompare(true);setTimeline("scenario");}}>Compare</button></div></div>
      <div className="timeline-mode"><button aria-pressed={view==="history"} className={view==="history"?"active":""} onClick={()=>{setTimeline("history");setCompare(false);}}>Enrollment history</button><button aria-pressed={view==="scenario"} className={view==="scenario"?"active":""} onClick={()=>setTimeline("scenario")}>Scenario timeline</button></div>
      {computed.error&&view==="scenario"?<p className="data-error" role="alert">{computed.error} Adjust the planning assumptions to continue.</p>:<>
      {!compare?<><div className="map-header"><span><MapPinned size={16}/> Observed regional signals</span><span>SY {schoolYear(view==="history"?year:latest.year)} · {data.scope.sector} sector</span></div><ScenarioMap signals={signals}/></>:<div className="comparison"><p>Same enrollment baseline, requests and costs; different budget shares. These are normative allocation examples. Equity-led favors annex access; no deprivation or catchment evidence supports targeting. Resilience-led uses assumed exposure only.</p><div className="data-table-wrap"><table><thead><tr><th>Strategy · SY {schoolYear(year)}</th><th>Added rooms</th><th>Gap*</th><th>Upgrades</th><th>Spend to date</th></tr></thead><tbody>{computed.comparisons?.map(c=>{const o=c.years[safeIndex].outcomes;return <tr key={c.strategy} className={c.strategy===strategy?"selected-row":""}><th><button onClick={()=>setStrategy(c.strategy)}>{c.strategy}</button></th><td>{fmt(o.addedRooms)}</td><td>{fmt(o.remainingGap)}</td><td>{fmt(o.upgradedRooms)}</td><td>{money(o.investment)}</td></tr>})}</tbody></table></div><p>*Gap depends on assumed inventory and learners-per-room ratio. No actual capacity, benefit or risk reduction is asserted.</p></div>}
      <TrendCharts points={points} baseline={view==="scenario"&&computed.base?scenarioPoints(computed.base):undefined} index={safeIndex} history={view==="history"} playing={playing} speed={speed} onTogglePlay={()=>{if(safeIndex===points.length-1)setIndex(0);setPlaying(v=>!v);}} onSeek={n=>{setIndex(n);setPlaying(false);}} onReset={()=>{setIndex(0);setPlaying(false);}} onSpeedChange={setSpeed}/>
      {outcome&&<details className="enrollment-details" open><summary>Annual allocation · {strategy} · SY {schoolYear(year)}</summary><p>Eligible budget {money(outcome.availableBudget)} · maintenance {money(outcome.maintenance)} · unspent {money(outcome.unspent)} (includes equity reserve {money(outcome.equityReserve)}).</p><div className="data-table-wrap"><table><thead><tr><th>Intervention</th><th>Budget share</th><th>Requested*</th><th>Funded</th><th>Cost</th></tr></thead><tbody>{INTERVENTIONS.map((item,i)=>{const a=outcome.allocations.find(a=>a.kind===item.kind);return <tr key={item.kind}><th>{item.label}</th><td>{SHARES[strategy][i]}%</td><td>{fmt(a?.requested)}</td><td>{fmt(a?.funded)}</td><td>{a?money(a.cost):"—"}</td></tr>})}</tbody></table></div><p>*Requests are capped by remaining assumed unusable / exposed rooms where supplied. Unused category budgets are not redistributed or carried forward. Maintenance covers known assumed usable rooms, or only scenario-added rooms when inventory is unknown. No capacity gain is credited for rehabilitation without an unusable-room inventory.</p><p>Annex / new-school feasibility: affordability only. Site, land, access distance, catchment, staffing and approval remain unassessed. Equity reserve stays unassigned.</p></details>}
      </>}
    </div><div className="disclaimer">Observed data and assumed estimates are separate. No ML prediction. Source-year geography and changing reporting coverage limit comparisons. Scenario state resets on refresh or area / sector change.</div></section>
    <aside className="impact-column"><WhyThisHappens observed={current} previous={previous} to={outcome} from={prior} levers={levers} year={year} source={`enrollment_${current.year}-${String(current.year+1).slice(-2)}.csv`}/><PlanningSignals current={current} previous={previous} outcome={outcome}/><section className="panel assumptions-panel"><button onClick={()=>setAssumptions(v=>!v)} aria-expanded={assumptions}><span><strong>Sources and assumptions</strong><small>Definitions, coverage and limitations</small></span><ChevronDown size={17} className={assumptions?"rotated":""}/></button>{assumptions&&<div className="assumptions-body"><p><strong>Source:</strong> {data.manifest.source}. Release / extraction methodology and completeness have not been independently verified.</p><p><strong>Coverage:</strong> {data.manifest.files.length} files, SY 2017–18 to 2025–26. National includes all supplied sectors and Philippine Schools Overseas (PSO); use the sector filter for public-school planning.</p><p><strong>Definition:</strong> enrollment is the sum of numeric grade / track / sex cells; blanks are not imputed. Zero remains zero. ESNG / JHSNG are non-graded groups.</p><p><strong>Geography:</strong> school ID + school year is unique. Geographic aggregates use qualified names, not PSGC codes. ARMM / BARMM share a historical label but are not constant boundaries. NIR appears in 2024–25; regional reassignments affect trends.</p><p><strong>Assumptions:</strong> all costs in ₱ millions. Defaults are examples. 40 learners per room is not an official standard. Annual growth, progression and access default to zero. Requests default to zero. No inflation, delay, recurrent annex staffing, or site costs are separately modeled.</p><p><strong>External context only:</strong> PSA demographics, BetterGov budgets / programs and flood-control projects, and ASEAN country / regional benchmarks remain browse-only. Flood-control projects are not a hazard exposure layer. None feed these calculations.</p><p><strong>Refresh:</strong> local import required; no live DepEd feed. Data generated {data.manifest.generatedAt.slice(0,10)}.</p><details><summary>Source files and record counts</summary>{data.manifest.files.map(f=><p key={f.file}>{f.file}: {fmt(f.rows)} schools, {fmt(f.enrollment)} reported enrollments ({f.encoding}).</p>)}</details><details><summary>Current editable assumptions</summary>{Object.entries(levers).map(([key,v])=><div key={key}><span>{key.replace(/([A-Z])/g," $1")}</span><b>{String(v)}</b></div>)}</details></div>}</section></aside>
  </div></>;
}

function EducationScenarioLab() {
  const [scope,setScope]=useState<Scope>({level:"national",key:"[]",sector:"All"});
  const [query,setQuery]=useState("");
  const [options,setOptions]=useState<AreaOption[]>([]);
  const [areaError,setAreaError]=useState("");
  const [areaLoading,setAreaLoading]=useState(false);
  const [data,setData]=useState<EnrollmentData|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [retry,setRetry]=useState(0);
  const signature=JSON.stringify(scope);
  useEffect(()=>{
    const controller=new AbortController();setOptions([]);setAreaError("");setAreaLoading(false);
    if(scope.level==="national")return()=>controller.abort();
    setAreaLoading(true);
    const timer=window.setTimeout(()=>{const params=new URLSearchParams({view:"areas",level:scope.level,sector:scope.sector,q:query});fetch(`/api/enrollment?${params}`,{signal:controller.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error);return b;}).then(b=>{setOptions(b);setAreaLoading(false);}).catch(e=>{if(!controller.signal.aborted){setAreaError(e.message);setAreaLoading(false);}});},200);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[scope.level,scope.sector,query,retry]);
  useEffect(()=>{
    const controller=new AbortController();setData(null);setError("");
    if(!scope.key){setLoading(false);return()=>controller.abort();}
    setLoading(true);
    const params=new URLSearchParams(scope);
    fetch(`/api/enrollment?${params}`,{signal:controller.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error);return b;}).then(b=>{setData(b);setLoading(false);}).catch(e=>{if(!controller.signal.aborted){setError(e.message);setLoading(false);}});
    return()=>controller.abort();
  },[scope,retry]);
  const scopeControls=<>
    <label>Aggregate by<select value={scope.level} onChange={e=>{setScope(s=>({...s,level:e.target.value as Scope["level"],key:e.target.value==="national"?"[]":""}));setQuery("");}}>{LEVELS.map(l=><option value={l} key={l}>{l[0].toUpperCase()+l.slice(1)}</option>)}</select></label>
    <label>Sector<select value={scope.sector} onChange={e=>setScope(s=>({...s,sector:e.target.value}))}>{["All","Public","Private","Sucslucs","Pso"].map(s=><option key={s} value={s}>{s==="Sucslucs"?"SUCs / LUCs":s==="Pso"?"Philippine Schools Overseas":s}</option>)}</select></label>
    {scope.level!=="national"&&<><label>Find area or school<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, parent area or school ID"/></label><label className="area-select">Selected area<select value={scope.key} onChange={e=>setScope(s=>({...s,key:e.target.value}))} aria-busy={areaLoading}><option value="">{areaLoading?"Loading areas…":"Choose an area"}</option>{scope.key&&!options.some(o=>o.key===scope.key)&&<option value={scope.key}>{JSON.parse(scope.key).join(" / ")}</option>}{options.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}</select></label><small>{areaLoading?"Finding matching areas…":"Up to 60 matches. Refine your search for more."}</small></>}
    {scope.level==="national"&&<p>{scope.sector==="All"?"All supplied school records, including PSO. Select Public for public-sector planning.":`Supplied school records filtered to ${scope.sector==="Sucslucs"?"SUCs / LUCs":scope.sector==="Pso"?"Philippine Schools Overseas":scope.sector}.`}</p>}
  </>;
  const hasData=!loading&&!error&&!!scope.key&&!!data?.history.length;
  return <main className="lab-shell" aria-busy={loading} data-loading-region><AtlasNav compact/><section className="scenario-context"><div><strong>Education access</strong><span>Current validated scenario template · deterministic planning</span></div><ScenarioTemplateModal /></section>
    {!hasData&&<section className="scope-bar" aria-label="Enrollment area selection">{scopeControls}</section>}
    {areaError&&<p className="data-error">{areaError}</p>}
    {loading?<ScenarioLabSkeleton/>:error?<div className="data-state" role="alert"><p>{error}</p><button className="button primary" onClick={()=>setRetry(v=>v+1)}>Retry data loading</button></div>:!scope.key?<p className="data-state">Select an area to view enrollment history and scenarios.</p>:!data?.history.length?<p className="data-state">No records for this area and sector. Choose another selection.</p>:<LoadedLab key={signature} data={data} scopeControls={scopeControls}/>}
  </main>;
}

export default function ScenarioLab() {
  const searchParams = useSearchParams();
  const workspace = readWorkspace(new URLSearchParams(searchParams.toString()));
  if (workspace) return <AnalysisScenarioWorkspace key={`${workspace.indicators.join(",")}|${workspace.geography}|${workspace.period}`} workspace={workspace}/>;
  if (searchParams.get("template") === "education-access") return <EducationScenarioLab/>;
  return <AnalysisScenarioWorkspace workspace={{indicators:["population","poverty-incidence","employment-rate"],geography:"Philippines — national",period:"Latest available",chart:"Trend"}}/>;
}
