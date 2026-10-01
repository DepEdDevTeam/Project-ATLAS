"use client";
import { Pause, Play, RotateCcw } from "lucide-react";
import { schoolYear, type EnrollmentYear } from "@/lib/enrollment-types";
import type { YearState } from "@/lib/scenario-types";
export type ChartPoint={year:number;values:(number|null)[]};
const number=(n:number)=>Math.round(n).toLocaleString("en-PH");
const money=(n:number)=>`₱${n.toLocaleString("en-PH",{maximumFractionDigits:2})}M`;
const seriesLabels=(history:boolean)=>history?["Reported enrollment","Male","Female","Schools in file"]:["Estimated enrollment","Added rooms (cumulative)","Gap under assumptions","Estimated spend (cumulative)"];
const colors=["var(--trend-enrollment)","var(--trend-classrooms)","var(--trend-congestion)","var(--trend-investment)"];
export function historyPoints(history:EnrollmentYear[]):ChartPoint[]{return history.map(h=>({year:h.year,values:[h.enrollment,h.male,h.female,h.schools]}))}
export function scenarioPoints(years:YearState[]):ChartPoint[]{return years.map(h=>({year:h.year,values:[h.outcomes.enrollment,h.outcomes.addedRooms,h.outcomes.remainingGap,h.outcomes.investment]}))}
export function TrendScorecards({point,history}:{point:ChartPoint;history:boolean}) {
  return <section className="scorecard-section" aria-label={`${history?"Observed enrollment":"Scenario estimate"} scorecards for SY ${schoolYear(point.year)}`}><div className="scorecard-heading"><strong>{history?"Observed school records":"Scenario estimates"}</strong><span>SY {schoolYear(point.year)}</span></div><div className="scorecard-grid">{seriesLabels(history).map((label,k)=><div className="scorecard" key={label}><span className="scorecard-label"><i style={{background:colors[k]}}/>{label}</span><strong>{point.values[k]===null?"Unknown":!history&&k===3?money(point.values[k]!):number(point.values[k]!)}</strong><small>{history?"Observed school aggregates":k===2?"Requires assumed inventory":"Computed from assumptions"}</small></div>)}</div></section>;
}
export default function TrendCharts({points,baseline,index,history,playing,speed,onTogglePlay,onSeek,onReset,onSpeedChange}:{points:ChartPoint[];baseline?:ChartPoint[];index:number;history:boolean;playing:boolean;speed:1|2;onTogglePlay:()=>void;onSeek:(n:number)=>void;onReset:()=>void;onSpeedChange:(n:1|2)=>void}) {
  const labels=seriesLabels(history);
  const current=points[index];
  if(!current)return null;
  const x=(i:number)=>58+i*800/Math.max(1,points.length-1);
  const lines=labels.map((label,k)=>{
    const values=[...points,...(baseline||[])].map(p=>p.values[k]).filter((v):v is number=>v!==null);
    const min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):1;
    const y=(v:number)=>max===min?137:219-(v-min)/(max-min)*164;
    const path=(items:ChartPoint[],end=items.length-1)=>{let connected=false;return items.slice(0,end+1).map((p,i)=>{const v=p.values[k];if(v===null){connected=false;return ""}const command=connected&&p.year===items[i-1].year+1?"L":"M";connected=true;return `${command} ${x(i)} ${y(v)}`}).join(" ")};
    return {label,k,y,path,min,max};
  });
  return <section className="trajectory" aria-label={history?"Observed enrollment history":"Deterministic scenario timeline"}>
    <div className="trajectory-legend"><div className="trajectory-series-key">{labels.map((label,k)=><span key={label}><i style={{background:colors[k]}}/>{label}</span>)}</div><div className="trajectory-line-key"><span><i className="trajectory-swatch scenario"/>{history?"Observed records":"Selected assumptions"}</span>{baseline&&<span><i className="trajectory-swatch baseline"/>Flat enrollment, no projects</span>}</div></div>
    <div className="trajectory-chart"><svg className="trajectory-plot" viewBox="0 0 900 286" role="img" aria-label={`${history?"Observed":"Scenario"} trends, ${schoolYear(points[0].year)} to ${schoolYear(points.at(-1)!.year)}. Selected year ${schoolYear(current.year)}; exact values in the scorecards above.`} preserveAspectRatio="none">
      {[55,137,219].map(p=><line key={p} x1="58" x2="858" y1={p} y2={p} className="trajectory-gridline"/>)}<text x="6" y="59" className="trajectory-axis-label">Higher</text><text x="9" y="223" className="trajectory-axis-label">Lower</text>
      {lines.map(({k,path,y})=><g key={k}>{baseline&&<path d={path(baseline)} fill="none" stroke={colors[k]} className="trajectory-baseline-line"/>}<path d={path(points,index)} fill="none" stroke={colors[k]} className="trajectory-scenario-line"/>{current.values[k]!==null&&<circle cx={x(index)} cy={y(current.values[k]!)} r="5" fill={colors[k]} className="trajectory-point"/>}</g>)}<line x1={x(index)} x2={x(index)} y1="40" y2="219" className="trajectory-cursor"/>
    </svg><div className="trajectory-playback"><button className="trajectory-play-icon" aria-label={playing?"Pause playback":"Play timeline"} disabled={points.length<2} onClick={onTogglePlay}>{playing?<Pause size={16}/>:<Play size={16}/>}</button><div className="trajectory-timeline"><span className="trajectory-start-year">{schoolYear(points[0].year)}</span><input type="range" aria-label="Timeline year" aria-valuetext={schoolYear(current.year)} min={0} max={points.length-1} value={index} onChange={e=>onSeek(Number(e.target.value))} style={{"--play-progress":`${index/Math.max(1,points.length-1)*100}%`} as React.CSSProperties}/><span className="trajectory-end-year">{schoolYear(points.at(-1)!.year)}</span></div><button className="playback-text" aria-label="Restart timeline" onClick={onReset}><RotateCcw size={15}/></button><button className="playback-text" aria-label={`Playback speed ${speed}x`} onClick={()=>onSpeedChange(speed===1?2:1)}>{speed}×</button></div></div>
    <p className="trajectory-note"><strong>How to read this chart:</strong> follow each color from left to right to see whether that measure rises or falls. Each line uses its own range, so compare direction—not height. Missing values break the line; movement does not prove cause. · SY {schoolYear(current.year)}</p>
  </section>;
}
