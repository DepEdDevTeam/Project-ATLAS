"use client";
import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { Levers } from "@/lib/scenario-types";

type NumericKey = { [K in keyof Levers]: Levers[K] extends number ? K : never }[keyof Levers];
type Field = { key: NumericKey; label: string; help: string; min?: number; max: number; step?: number; unit?: string };
const GROUPS: { title: string; description: string; fields: Field[] }[] = [
  { title: "Social", description: "Enrollment, progression, access and equity", fields: [
    {key:"enrollmentGrowth",label:"Yearly change in student count",help:"Raise this to project more students each year; lower it to project fewer.",min:-20,max:20,step:.1,unit:"%"},
    {key:"progression",label:"Change from students moving up grades",help:"Adds to or subtracts from the yearly percentage change in students.",min:-10,max:10,step:.1,unit:"points"},
    {key:"access",label:"Change from students able to enroll",help:"Adds to or subtracts from the yearly percentage change in students.",min:-10,max:10,step:.1,unit:"points"},
    {key:"equityShare",label:"Budget set aside for equity",help:"This share is held back; the model does not assign it to schools.",max:100,unit:"%"},
  ]},
  { title: "Technological", description: "Assumed ICT provision in added rooms", fields: [
    {key:"ictShare",label:"New rooms equipped with technology",help:"A higher share adds equipment costs to more newly built rooms.",max:100,unit:"%"},
    {key:"ictCost",label:"Technology cost for one equipped room",help:"Raise this to increase the estimated cost of each equipped room.",max:5,step:.01,unit:"₱M"},
  ]},
  { title: "Economic", description: "Requests per funded year and assumed costs", fields: [
    {key:"budget",label:"Maximum budget in each funding year",help:"This limits how much can be spent when funding is available.",max:10000,step:1,unit:"₱M"},
    {key:"newRooms",label:"New classrooms to build each funding year",help:"More requested rooms can be built if the budget covers them.",max:10000},
    {key:"newCost",label:"Cost to build one classroom",help:"A higher cost means the same budget can build fewer rooms.",min:.01,max:20,step:.01,unit:"₱M"},
    {key:"rehabRooms",label:"Classrooms to repair each funding year",help:"Repairs only restore usable rooms when an unusable-room count is supplied.",max:10000},
    {key:"rehabCost",label:"Cost to repair one classroom",help:"A higher cost means the same budget can repair fewer rooms.",min:.01,max:10,step:.01,unit:"₱M"},
    {key:"expansionRooms",label:"Rooms to add to existing schools",help:"Sets the number of extra rooms requested in each funding year.",max:10000},
    {key:"expansionCost",label:"Cost to add one room",help:"A higher cost means the same budget can add fewer rooms.",min:.01,max:20,step:.01,unit:"₱M"},
    {key:"annexes",label:"Annex or new-school projects requested",help:"Sets how many projects to fund each funding year, if affordable.",max:100},
    {key:"annexCost",label:"Cost for one annex or new school",help:"A higher cost means the same budget can fund fewer projects.",min:.01,max:200,step:.01,unit:"₱M"},
    {key:"maintenanceCost",label:"Yearly upkeep cost for one usable room",help:"This spending is covered before new work is funded.",max:1,step:.001,unit:"₱M"},
  ]},
  { title: "Environmental", description: "Assumed exposure and retrofit requests", fields: [
    {key:"exposedRooms",label:"Rooms assumed exposed to hazards",help:"Sets the maximum number of rooms that could receive an upgrade.",max:10000},
    {key:"resilienceRooms",label:"Exposed rooms to upgrade each funding year",help:"More upgrades can be funded if the budget covers them.",max:10000},
    {key:"resilienceCost",label:"Cost to upgrade one exposed room",help:"A higher cost means the same budget can upgrade fewer rooms.",min:.01,max:10,step:.01,unit:"₱M"},
  ]},
  { title: "Political / Policy", description: "Planning ratios, eligibility and funding cycle", fields: [
    {key:"pupilsPerRoom",label:"Students per room used in the estimate",help:"A lower number means more rooms are estimated as needed.",min:1,max:100},
    {key:"roomsPerAnnex",label:"Classrooms added by one annex or new school",help:"Each funded project adds this many rooms to the estimate.",min:1,max:100},
    {key:"eligibility",label:"Share of budget available to spend",help:"A lower share leaves less money for maintenance and new work.",max:100,unit:"%"},
    {key:"fundingCycle",label:"Years between funding rounds",help:"Funding starts in the first year, then repeats after this many years.",min:1,max:7,unit:"years"},
  ]},
];
function Slider({field,value,onChange}:{field:Field;value:number;onChange:(value:number)=>void}) {
  const max=Math.max(field.max,value),min=field.min??0;
  return <label className="slider-field"><span className="slider-top"><span>{field.label}</span><span className="lever-value"><input aria-label={`${field.label} value`} type="number" min={min} step={field.step??1} value={value} onChange={e=>onChange(Number(e.target.value))}/><small>{field.unit}</small></span></span><span className="slider-help">{field.help}</span><input aria-label={field.label} type="range" min={min} max={max} step={field.step??1} value={value} style={{"--range":`${Math.min(100,Math.max(0,(value-min)/(max-min)*100))}%`} as React.CSSProperties} onChange={e=>onChange(Number(e.target.value))}/><span className="slider-ends"><span>{min}</span><span>{max.toLocaleString("en-PH")} {field.unit}</span></span></label>;
}
export default function PlanningControls({levers,onChange}:{levers:Levers;onChange:(key:keyof Levers,value:number|boolean)=>void}) {
  const [open,setOpen]=useState("Social");
  return <aside className="controls-panel panel"><div className="panel-head"><h2>Planning levers</h2><SlidersHorizontal size={19}/></div><p className="control-note">All controls are assumptions for the selected area. ₱M means millions of pesos. Costs and ratios are editable examples, not official DepEd values.</p><div className="control-groups">{GROUPS.map(group=><section className="control-group" key={group.title}><button className="group-trigger" onClick={()=>setOpen(open===group.title?"":group.title)} aria-expanded={open===group.title}><span><strong>{group.title}</strong><small>{group.description}</small></span><ChevronDown size={18} className={open===group.title?"rotated":""}/></button>{open===group.title&&<div className="group-body">{group.fields.map(f=><Slider key={f.key} field={f} value={levers[f.key]} onChange={v=>onChange(f.key,v)}/>)}{group.title==="Social"&&<p className="control-note">Grade progression is a net demand assumption, not a cohort survival rate. Sex counts in the scorecards are descriptive; disparity alone is not an equity needs measure.</p>}{group.title==="Political / Policy"&&<><label className="inventory-toggle"><input type="checkbox" checked={levers.inventoryKnown} onChange={e=>onChange("inventoryKnown",e.target.checked)}/> Supply an assumed classroom inventory</label>{levers.inventoryKnown&&<><Slider field={{key:"inventoryRooms",label:"Total classrooms assumed in this area",help:"Used to estimate how many usable rooms are available now.",max:1000000}} value={levers.inventoryRooms} onChange={v=>onChange("inventoryRooms",v)}/><Slider field={{key:"unusableRooms",label:"Classrooms assumed unusable",help:"Subtracted from available rooms until funded repairs restore them.",max:100000}} value={levers.unusableRooms} onChange={v=>onChange("unusableRooms",v)}/></>}<p className="control-note">No official standards or eligibility rules are loaded. Funding starts in the first scenario year. Annex affordability does not establish site feasibility.</p></>}{group.title==="Environmental"&&<p className="control-note">No hazard layers or condition inventory are linked. An upgrade count is not a quantified reduction in risk.</p>}</div>}</section>)}</div></aside>;
}
