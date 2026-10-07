"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Activity, ArrowDownToLine, Bot, BookOpen, CheckCircle2, CircleHelp, Database, GraduationCap, Leaf, LoaderCircle, MapPinned, SlidersHorizontal, Sparkles, Users, Wifi, BriefcaseBusiness } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { calculateSteepScenario, type RegionBaseline, type SteepControls } from "@/lib/steep-scenario";
import styles from "./migration-scenario.module.css";

type Profile = { region: string; enrollment: number };
type Position = [number, number];
type Ring = Position[];
type Polygon = Ring[];
type Geometry = { type: "Polygon"; coordinates: Polygon } | { type: "MultiPolygon"; coordinates: Polygon[] };
type Boundary = { name: string; region: string; geometry: Geometry };
type MigrationRun = {
  runId: string; generatedAt: string; baselineSchoolYear: string; defaultRegion: string; defaultRates: [number, number, number];
  domesticTotal: number; domesticPoolTotal: number; baselineSource: string; profiles: Profile[]; boundaries: Boundary[];
  studies: { study_id: string; source_file: string; totalChunks: number; verifiedFindings: number }[];
  findings: { source_file: string; pdf_page: number; chunk_id: string; quote: string; population?: string; limitations?: string | string[] }[];
  dataGaps: string[]; sources: { agency: string; status: string; citations: { title: string; url: string }[] }[];
  limitations: string[]; agentSummary: string;
};
type PolicySignal = { claim: string; lever: string; direction: string; confidence: string; quote: string; page: number };
type PolicyAnalysis = {
  fileName: string; pageCount: number; pagesWithoutText: number[]; summary: string; targetGroups: string[];
  geographicScope: string; timeline: string; funding: string; signals: PolicySignal[]; rejectedSignals: number; note: string;
};

const number = (value: number | null | undefined) => Math.round(value || 0).toLocaleString("en-PH");
const peso = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
const percent = (value: number | null | undefined) => value == null ? "Unavailable" : `${value.toFixed(1)}%`;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function point([longitude, latitude]: Position): Position {
  return [130 + (longitude - 116) * 35, 18 + (20.8 - latitude) * 15.7];
}
function boundaryPath(geometry: Geometry) {
  const polygons: Polygon[] = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap(polygon => polygon.map(ring => ring.map((position, i) => {
    const [x, y] = point(position);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ") + " Z")).join(" ");
}

function MapPanel({ run, region, onRegion }: { run: MigrationRun; region: string; onRegion: (name: string) => void }) {
  const values = new Map(run.profiles.map(profile => [profile.region, profile.enrollment]));
  const hasBoundary = run.boundaries.some(boundary => boundary.region === region);
  return <section className={styles.mapPanel} aria-label="Philippines regional enrollment map">
    <div className={styles.mapTop}><span><MapPinned size={16}/> Philippines</span><span>Regional enrollment baseline · SY {run.baselineSchoolYear}</span></div>
    <svg className={styles.map} viewBox="0 0 590 375" role="img" aria-label="Map of Philippine regions. Select a region to change the scenario baseline.">
      <defs><pattern id="water-grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="currentColor" strokeOpacity=".045"/></pattern></defs>
      <rect width="590" height="375" rx="18" fill="url(#water-grid)"/>
      {run.boundaries.map(boundary => {
        const enrollment = values.get(boundary.region);
        const selected = boundary.region === region;
        return <path key={boundary.region} d={boundaryPath(boundary.geometry)} fillRule="evenodd" className={`${styles.regionShape} ${selected ? styles.regionSelected : ""} ${enrollment ? "" : styles.regionUnavailable}`} tabIndex={enrollment ? 0 : -1} role="button" aria-label={`${boundary.region}${enrollment ? `, ${number(enrollment)} learners` : ", baseline unavailable"}${selected ? ", selected" : ""}`} onClick={() => enrollment && onRegion(boundary.region)} onKeyDown={event => { if (enrollment && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onRegion(boundary.region); } }}>
          <title>{boundary.region}: {enrollment ? `${number(enrollment)} learners` : "No baseline available"}</title>
        </path>;
      })}
      <text x="22" y="345" className={styles.mapLabel}>DepEd regional aggregate profile · SY 2025-2026 enrollment</text>
    </svg>
    {!hasBoundary && <p className={styles.mapNotice} role="status">Walang boundary outline para sa {region} sa 2023 map file. Available pa rin ang regional scenario.</p>}
    <div className={styles.mapKey}><span><i className={styles.swatchSelected}/>Selected region</span><span><i className={styles.swatchRegion}/>Other regions</span><span><i className={styles.swatchEmpty}/>No profile</span><span className={styles.mapUnit}>Click a region to change the selection</span></div>
  </section>;
}

function defaultControls(baseline: RegionBaseline): SteepControls {
  const history = baseline.enrollment;
  const observedGrowth = history.length > 1
    ? ((history.at(-1)!.enrollment / history[0].enrollment) ** (1 / Math.max(1, history.at(-1)!.endYear - history[0].endYear)) - 1) * 100
    : 0;
  const learners2023 = history.find(item => item.endYear === 2024)?.enrollment || history[0]?.enrollment || 0;
  const deviceCount = baseline.technology.academicDevices || 0;
  const learnerDeviceRatio = deviceCount ? Math.ceil(learners2023 / deviceCount) : 20;
  const offerings = baseline.technology.internetByStage.reduce((sum, item) => sum + item.offerings, 0);
  const floodPct = offerings ? baseline.environment.floodMarkerSchoolOfferings / offerings * 100 : 0;
  const annualMoeePerSchool = baseline.economic.latestRegionalSchoolMoee && baseline.schools.total
    ? baseline.economic.latestRegionalSchoolMoee / baseline.schools.total : 0;
  return {
    enrollmentGrowthPct: clamp(Number(observedGrowth.toFixed(1)), -10, 10),
    additionalTeachersPerSchool: 0,
    internetCoveragePct: clamp(baseline.technology.internetCoveragePct || 0, 0, 100),
    learnersPerDevice: clamp(learnerDeviceRatio, 1, 100),
    budgetPerSchool: Math.round(annualMoeePerSchool),
    classroomFundingPerRoom: 0,
    maintenancePerSchool: 0,
    hazardExposurePct: clamp(floodPct, 0, 100),
    climateEventsPerYear: 0,
    disruptionDaysPerEvent: 0,
  };
}

function RangeControl({ label, value, min, max, step, unit, helper, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; helper: string; onChange: (value: number) => void;
}) {
  return <label className={styles.steepControl}>
    <span className={styles.steepControlHead}><strong>{label}</strong><span>{value}{unit}</span></span>
    <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={event => onChange(Number(event.target.value))}/>
    <small>{helper}</small>
  </label>;
}

function MoneyControl({ label, value, step, helper, onChange }: {
  label: string; value: number; step: number; helper: string; onChange: (value: number) => void;
}) {
  return <label className={styles.moneyControl}><span><strong>{label}</strong><small>{helper}</small></span><span className={styles.moneyInput}><span>₱</span><input type="number" min="0" max="10000000" step={step} value={value} onChange={event => onChange(clamp(Number(event.target.value) || 0, 0, 10000000))} aria-label={label}/></span></label>;
}

function LeverSection({ title, hint, icon: Icon, children }: { title: string; hint: string; icon: typeof Users; children: ReactNode }) {
  return <details className={styles.leverSection} open><summary><Icon size={16}/><span><strong>{title}</strong><small>{hint}</small></span></summary><div>{children}</div></details>;
}

function MetricCard({ title, value, detail, badge, tone = "neutral" }: { title: string; value: string; detail: string; badge: string; tone?: "neutral" | "good" | "watch" }) {
  return <article className={`${styles.metricCard} ${tone === "good" ? styles.metricGood : tone === "watch" ? styles.metricWatch : ""}`}>
    <div><span>{title}</span><em>{badge}</em></div><strong>{value}</strong><small>{detail}</small>
  </article>;
}

function ComparisonBars({ title, baselineLabel, baselineValue, scenarioLabel, scenarioValue, maxValue, format, note }: {
  title: string; baselineLabel: string; baselineValue: number; scenarioLabel: string; scenarioValue: number; maxValue: number;
  format: (value: number) => string; note: string;
}) {
  const safeMax = Math.max(1, maxValue, baselineValue, scenarioValue);
  return <article className={styles.comparisonCard}>
    <h3>{title}</h3>
    {[{ label: baselineLabel, value: baselineValue, className: styles.barObserved }, { label: scenarioLabel, value: scenarioValue, className: styles.barScenario }].map(item =>
      <div className={styles.barLine} key={item.label}><span>{item.label}</span><div className={styles.barTrack} role="img" aria-label={`${item.label}: ${format(item.value)}`}><i className={item.className} style={{ width: `${Math.max(item.value > 0 ? 1.5 : 0, item.value / safeMax * 100)}%` }}/></div><strong>{format(item.value)}</strong></div>
    )}
    <small>{note}</small>
  </article>;
}

function PolicyPanel({ file, setFile, analysis, loading, error, onAnalyze }: {
  file: File | null; setFile: (file: File | null) => void; analysis: PolicyAnalysis | null; loading: boolean; error: string;
  onAnalyze: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <LeverSection title="Political / Policy" hint="Upload a policy PDF for cited analysis" icon={GraduationCap}>
    <form className={styles.policyForm} onSubmit={onAnalyze}>
      <label className={styles.filePick}><span><strong>Policy document</strong><small>Text PDF · maximum 12 MB and 250 pages</small></span><input type="file" accept="application/pdf,.pdf" onChange={event => setFile(event.target.files?.[0] || null)}/></label>
      {file && <p className={styles.selectedFile}><BookOpen size={14}/>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
      <button type="submit" className={styles.policyButton} disabled={!file || loading}>{loading ? <><LoaderCircle size={15} className={styles.spinner}/> Analyzing PDF…</> : "Analyze policy PDF"}</button>
      <small className={styles.policyHelper}>The agent identifies scope, target groups, timing, funding, and evidence excerpts. It will not change scenario values automatically.</small>
    </form>
    {error && <p className={styles.inlineError} role="alert">{error}</p>}
    {analysis && <div className={styles.policyResult}>
      <p className={styles.policyMeta}><CheckCircle2 size={14}/> {analysis.fileName} · {analysis.pageCount} pages · {analysis.signals.length} page-verified signals</p>
      <p>{analysis.summary}</p>
      <dl><div><dt>Geography</dt><dd>{analysis.geographicScope}</dd></div><div><dt>Timeline</dt><dd>{analysis.timeline}</dd></div><div><dt>Funding</dt><dd>{analysis.funding}</dd></div></dl>
      {analysis.targetGroups.length > 0 && <p><strong>Target groups:</strong> {analysis.targetGroups.join(", ")}</p>}
      {analysis.signals.map((signal, index) => <article className={styles.policySignal} key={`${signal.page}-${index}`}><span>{signal.lever} · {signal.confidence} confidence · p. {signal.page}</span><strong>{signal.claim}</strong><blockquote>“{signal.quote}”</blockquote></article>)}
      {analysis.pagesWithoutText.length > 0 && <small className={styles.policyHelper}>{analysis.pagesWithoutText.length} page(s) had no extractable text. Scanned pages may require OCR.</small>}
      <small className={styles.policyHelper}>{analysis.note}</small>
    </div>}
  </LeverSection>;
}

export default function MigrationScenarioApp() {
  const [run, setRun] = useState<MigrationRun | null>(null);
  const [region, setRegion] = useState("");
  const [year, setYear] = useState(2030);
  const [baseline, setBaseline] = useState<RegionBaseline | null>(null);
  const [runError, setRunError] = useState("");
  const [baselineError, setBaselineError] = useState("");
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [controls, setControls] = useState<SteepControls | null>(null);
  const [explanation, setExplanation] = useState<{ text: string; key: string } | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationError, setExplanationError] = useState("");
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [policyAnalysis, setPolicyAnalysis] = useState<PolicyAnalysis | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/migration/run", { cache: "no-store" }).then(async response => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load the latest completed run.");
      if (!active) return;
      setRun(payload);
      setRegion(payload.defaultRegion);
    }).catch(reason => { if (active) setRunError(reason instanceof Error ? reason.message : "Could not load the latest run."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!region) return;
    const controller = new AbortController();
    setBaseline(null);
    setControls(null);
    setBaselineError("");
    setBaselineLoading(true);
    fetch(`/api/migration/baseline?region=${encodeURIComponent(region)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Regional STEEP data unavailable.");
        return payload as RegionBaseline;
      }).then(payload => {
        setBaseline(payload);
        const defaults = defaultControls(payload);
        try {
          const saved = localStorage.getItem(`atlas-steep-controls:${region}`);
          setControls(saved ? { ...defaults, ...JSON.parse(saved) } : defaults);
        } catch { setControls(defaults); }
      }).catch(reason => {
        if (!controller.signal.aborted) setBaselineError(reason instanceof Error ? reason.message : "Regional STEEP data unavailable.");
      }).finally(() => { if (!controller.signal.aborted) setBaselineLoading(false); });
    return () => controller.abort();
  }, [region]);

  const results = useMemo(() => baseline && controls ? calculateSteepScenario(baseline, controls, year) : null, [baseline, controls, year]);
  const scenarioKey = useMemo(() => JSON.stringify({ region, year, controls }), [region, year, controls]);
  const changeControl = useCallback(<K extends keyof SteepControls>(key: K, value: SteepControls[K]) => {
    setControls(current => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      try { localStorage.setItem(`atlas-steep-controls:${region}`, JSON.stringify(next)); } catch { /* Browser storage is optional. */ }
      return next;
    });
  }, [region]);

  async function explainScenario() {
    if (!baseline || !controls || !results) return;
    setExplanationLoading(true);
    setExplanationError("");
    try {
      const evidence = run?.findings.slice(0, 3).map(item => ({ source: item.source_file, page: item.pdf_page, quote: item.quote })) || [];
      const response = await fetch("/api/migration/explain", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, inputs: controls, results, policy: policyAnalysis ? { summary: policyAnalysis.summary, signals: policyAnalysis.signals.slice(0, 4) } : null, researchEvidence: evidence, dataLimitations: baseline.limitations }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not generate the explanation.");
      setExplanation({ text: payload.text, key: scenarioKey });
    } catch (error) {
      setExplanationError(error instanceof Error ? error.message : "Could not generate the explanation.");
    } finally { setExplanationLoading(false); }
  }

  async function analyzePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!policyFile) return;
    setPolicyLoading(true);
    setPolicyError("");
    setPolicyAnalysis(null);
    try {
      const form = new FormData();
      form.set("file", policyFile);
      const response = await fetch("/api/migration/policy", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not analyze this policy PDF.");
      setPolicyAnalysis(payload);
    } catch (error) {
      setPolicyError(error instanceof Error ? error.message : "Could not analyze this policy PDF.");
    } finally { setPolicyLoading(false); }
  }

  if (runError) return <main className={styles.statePage}><Header/><section className={styles.stateCard}><Database size={28}/><h1>Scenario baseline unavailable</h1><p>{runError}</p><button onClick={() => location.reload()}>Retry</button></section></main>;
  if (!run) return <main className={styles.statePage}><Header/><section className={styles.stateCard}><Activity size={28}/><h1>Loading regional scenario</h1><p>Opening the latest completed run…</p></section></main>;

  const activeProfile = run.profiles.find(item => item.region === region);
  const result = results;
  const staleExplanation = explanation && explanation.key !== scenarioKey;
  const learnerMax = Math.max(result?.projectedLearners || 1, result?.baseEnrollment || 1);
  const staffRatio = result?.learnersPerTeacher;
  const deviceGapTone = result?.deviceGap ? "watch" : "good";

  return <main className={styles.page}>
    <Header/>
    <div className={styles.steepIntro}><div><span className={styles.eyebrow}>REGIONAL EDUCATION PLANNING</span><h1>STEEP Scenario Lab</h1><p>Explore how enrollment, staffing, technology, funding, and environmental conditions change the regional planning picture.</p></div><span className={styles.modeBadge}><Database size={14}/> Regional aggregates · what-if scenarios</span></div>
    <div className={styles.workspace}>
      <aside className={styles.leverPanel} aria-label="STEEP scenario controls">
        <div className={styles.leverTitle}><SlidersHorizontal size={17}/><div><h2>Scenario controls</h2><p>Observed baselines and editable assumptions.</p></div></div>
        <div className={styles.regionControl}><label htmlFor="steep-region">Region</label><select id="steep-region" value={region} onChange={event => { setRegion(event.target.value); setExplanation(null); }}>
          {run.profiles.map(item => <option key={item.region} value={item.region}>{item.region}</option>)}
        </select></div>
        <label className={styles.yearControl}><span>Projection year</span><strong>SY {year - 1}-{String(year).slice(-2)}</strong><input type="range" min="2026" max="2035" step="1" value={year} aria-label="Projection school year" onChange={event => setYear(Number(event.target.value))}/><small>Move the year to see the annual enrollment assumption compound.</small></label>
        {baselineLoading && <p className={styles.baselineStatus}><LoaderCircle size={14} className={styles.spinner}/> Loading regional indicators…</p>}
        {baselineError && <p className={styles.inlineError} role="alert">{baselineError}</p>}
        {baseline && controls && <>
          <LeverSection title="Social" hint="Enrollment and teacher deployment" icon={Users}>
            <RangeControl label="Annual enrollment change" value={controls.enrollmentGrowthPct} min={-10} max={10} step={0.1} unit="% / yr" helper={`Recent observed trend: ${percent(result?.observedEnrollmentGrowthPct)} annualized · scenario assumption`} onChange={value => changeControl("enrollmentGrowthPct", value)}/>
            <RangeControl label="Additional teachers per school" value={controls.additionalTeachersPerSchool} min={0} max={20} step={0.1} unit="" helper={`Average added deployment per school · baseline teachers: ${number(baseline.teachers.total)} (${baseline.teachers.year})`} onChange={value => changeControl("additionalTeachersPerSchool", value)}/>
          </LeverSection>
          <LeverSection title="Technological" hint="Connectivity and device availability" icon={Wifi}>
            <RangeControl label="School internet coverage target" value={controls.internetCoveragePct} min={0} max={100} step={1} unit="%" helper={`Observed internet coverage proxy: ${percent(baseline.technology.internetCoveragePct)} · ${baseline.technology.year}; not a Wi-Fi quality measure`} onChange={value => changeControl("internetCoveragePct", value)}/>
            <RangeControl label="Device target" value={controls.learnersPerDevice} min={1} max={100} step={1} unit=" learners/device" helper={`Available academic devices: ${number(baseline.technology.academicDevices)} · ${baseline.technology.year}`} onChange={value => changeControl("learnersPerDevice", value)}/>
          </LeverSection>
          <LeverSection title="Economic" hint="School, classroom, and maintenance funds" icon={BriefcaseBusiness}>
            <MoneyControl label="Annual budget per school" value={controls.budgetPerSchool} step={10000} helper={`Default references FY${baseline.economic.fiscalYear || "—"} regional school MOOE`} onChange={value => changeControl("budgetPerSchool", value)}/>
            <MoneyControl label="Annual classroom funding per room" value={controls.classroomFundingPerRoom} step={10000} helper={`Classroom inventory baseline: ${number(baseline.classrooms.total)} · ${baseline.classrooms.year}`} onChange={value => changeControl("classroomFundingPerRoom", value)}/>
            <MoneyControl label="Annual maintenance per school" value={controls.maintenancePerSchool} step={5000} helper="User-set planning amount; maintenance need is not measured in this profile" onChange={value => changeControl("maintenancePerSchool", value)}/>
          </LeverSection>
          <LeverSection title="Environmental" hint="Last-mile exposure and disruption stress" icon={Leaf}>
            <RangeControl label="Schools exposed to hazards" value={controls.hazardExposurePct} min={0} max={100} step={1} unit="%" helper={`Observed flood-marker proxy: ${percent(result?.baselineFloodMarkerPct)} of school-level offerings · ${baseline.environment.year}`} onChange={value => changeControl("hazardExposurePct", value)}/>
            <RangeControl label="Climate events per year" value={controls.climateEventsPerYear} min={0} max={12} step={1} unit=" / yr" helper="Scenario assumption; no regional event series is connected" onChange={value => changeControl("climateEventsPerYear", value)}/>
            <RangeControl label="Access disruption per event" value={controls.disruptionDaysPerEvent} min={0} max={30} step={1} unit=" days" helper="Assumed school days disrupted during each event" onChange={value => changeControl("disruptionDaysPerEvent", value)}/>
          </LeverSection>
          <PolicyPanel file={policyFile} setFile={setPolicyFile} analysis={policyAnalysis} loading={policyLoading} error={policyError} onAnalyze={analyzePolicy}/>
          <p className={styles.leverFootnote}><CircleHelp size={14}/> Firebase baselines are regional. Sliders are assumptions; changes do not represent validated causal effects.</p>
        </>}
      </aside>

      <section className={styles.centerColumn} aria-label="Regional scenario comparison">
        <div className={styles.selectionBar}><span><Database size={14}/>{region}</span><span>{activeProfile ? `${number(activeProfile.enrollment)} learners` : "Enrollment unavailable"}</span><span>SY {run.baselineSchoolYear} baseline</span></div>
        <MapPanel run={run} region={region} onRegion={next => { setRegion(next); setExplanation(null); }}/>
        {baseline && controls && result && <>
          <section className={styles.impactPanel} aria-labelledby="impact-title">
            <div className={styles.panelHeading}><div><span className={styles.eyebrow}>BASELINE VS WHAT-IF</span><h2 id="impact-title">Scenario impact</h2><p>Each indicator keeps its own unit and source year.</p></div><span className={styles.yearBadge}>{result.schoolYear}</span></div>
            <div className={styles.metricGrid}>
              <MetricCard title="Projected learners" value={number(result.projectedLearners)} detail={`${result.enrollmentChange > 0 ? "+" : ""}${number(result.enrollmentChange)} vs SY 2025-2026 · ${percent(controls.enrollmentGrowthPct)} assumed annual change`} badge="Social" tone={result.enrollmentChange < 0 ? "watch" : "neutral"}/>
              <MetricCard title="Learners per teacher" value={staffRatio ? staffRatio.toFixed(1) : "Unavailable"} detail={`${number(result.scenarioTeachers)} teachers modeled · ${number(result.addedTeachers)} added across the region`} badge="Social"/>
              <MetricCard title="Internet coverage target" value={percent(controls.internetCoveragePct)} detail={`${number(result.connectedOfferingsScenario)} school-level offerings connected · baseline ${number(result.connectedOfferingsObserved)}`} badge="Technology"/>
              <MetricCard title="Device shortfall" value={number(result.deviceGap)} detail={`${number(result.devicesRequired)} needed at 1:${controls.learnersPerDevice} · ${number(result.devicesAvailable)} academic devices observed`} badge="Technology" tone={deviceGapTone}/>
              <MetricCard title="Annual planning funds" value={peso(result.annualPlanningFunds)} detail={`${peso(result.schoolBudget)} schools · ${peso(result.classroomBudget)} classrooms · ${peso(result.maintenanceBudget)} maintenance`} badge="Economic"/>
              <MetricCard title="Disruption exposure" value={number(result.disruptedOfferingDays)} detail={`${number(result.exposedOfferings)} school-level offerings · event-days per year`} badge="Environment" tone={result.disruptedOfferingDays ? "watch" : "neutral"}/>
            </div>
            <div className={styles.comparisonGrid}>
              <ComparisonBars title="Enrollment" baselineLabel="Observed · SY 2025-26" baselineValue={result.baseEnrollment} scenarioLabel="What-if" scenarioValue={result.projectedLearners} maxValue={learnerMax} format={number} note={`Annual growth assumption compounds through ${result.schoolYear}.`}/>
              <ComparisonBars title="Learners per teacher" baselineLabel={`Observed · ${baseline.teachers.year}`} baselineValue={result.baselineTeacherRatio || 0} scenarioLabel="What-if ratio" scenarioValue={result.learnersPerTeacher || 0} maxValue={Math.max(result.baselineTeacherRatio || 0, result.learnersPerTeacher || 0)} format={value => value ? value.toFixed(1) : "Unavailable"} note="Lower ratio means fewer learners per teacher; staff count is held flat after the modeled deployment."/>
              <ComparisonBars title="Internet coverage" baselineLabel={`Observed · ${baseline.technology.year}`} baselineValue={result.observedInternetPct || 0} scenarioLabel="What-if target" scenarioValue={controls.internetCoveragePct} maxValue={100} format={percent} note="Based on internet-reported school-level offerings across ES/JHS/SHS, which may overlap."/>
              <ComparisonBars title="Device supply" baselineLabel="Available academic devices" baselineValue={result.devicesAvailable} scenarioLabel={`Needed at 1:${controls.learnersPerDevice}`} scenarioValue={result.devicesRequired} maxValue={Math.max(result.devicesAvailable, result.devicesRequired)} format={number} note={`${number(result.deviceGap)} additional devices needed at the selected enrollment and target ratio.`}/>
              <ComparisonBars title="Annual funding envelope" baselineLabel={`Regional school MOOE · FY${result.moeeFiscalYear || "—"}`} baselineValue={result.observedMoee || 0} scenarioLabel="What-if planning funds" scenarioValue={result.annualPlanningFunds} maxValue={Math.max(result.observedMoee || 0, result.annualPlanningFunds)} format={peso} note="MOOE is an operating allocation; the modeled classroom line is a separate user assumption."/>
              <ComparisonBars title="Hazard exposure" baselineLabel={`Observed flood markers · ${result.environmentYear}`} baselineValue={result.baselineFloodMarkerPct || 0} scenarioLabel="What-if exposed offerings" scenarioValue={controls.hazardExposurePct} maxValue={100} format={percent} note={`${number(result.exposedOfferings)} offerings exposed under the selected percentage; access-day impacts are assumed.`}/>
            </div>
            <p className={styles.visualNote}><CircleHelp size={14}/> Bars compare values within each indicator only. Regional aggregates do not identify which individual schools are exposed or underserved.</p>
          </section>
        </>}
      </section>

      <aside className={styles.insights}>
        <section className={styles.insightPanel} aria-labelledby="meaning-title">
          <div className={styles.insightHeading}><h2 id="meaning-title">What this means</h2><Sparkles size={16}/></div>
          <p className={styles.interpretation}>Generate a concise explanation of this region’s current STEEP assumptions and calculated results.</p>
          <button type="button" className={styles.explainButton} disabled={!result || explanationLoading} onClick={explainScenario}>{explanationLoading ? <><LoaderCircle size={16} className={styles.spinner}/> Explaining scenario…</> : <><Bot size={16}/> Explain this scenario</>}</button>
          {explanationError && <p className={styles.inlineError} role="alert">{explanationError}</p>}
          {explanation && !staleExplanation && <p className={styles.agentNarrative} aria-live="polite">{explanation.text}</p>}
          {staleExplanation && <p className={styles.staleNote}>Nagbago ang scenario controls. Piliin ulit ang “Explain this scenario” para i-update ang paliwanag.</p>}
          {!explanation && !explanationLoading && !explanationError && <p className={styles.agentFootnote}>Magbubukas lang ng AI request kapag pinindot mo ang button. Ang calculator ang pinanggagalingan ng mga numero.</p>}
        </section>
        {baseline && result && <section className={styles.insightPanel}>
          <div className={styles.insightHeading}><h2>Data behind the scenario</h2><BookOpen size={16}/></div>
          <dl className={styles.baselineDetails}>
            <div><dt>Enrollment</dt><dd>SY 2023-24 to 2025-26</dd></div>
            <div><dt>Teachers, ICT, internet, facilities</dt><dd>{baseline.teachers.year}</dd></div>
            <div><dt>Regional school MOOE</dt><dd>{baseline.economic.fiscalYear ? `FY${baseline.economic.fiscalYear}` : "Unavailable"}</dd></div>
            <div><dt>Data coverage</dt><dd>{String(baseline.dataCoverage.data_2324 || "Not specified")} / {String(baseline.dataCoverage.data_2425 || "Not specified")} / {String(baseline.dataCoverage.data_2526 || "Not specified")}</dd></div>
          </dl>
          <p className={styles.agentFootnote}>{baseline.baselineSource}</p>
          <details className={styles.limitationDetails}><summary>Read data limitations</summary><ul>{baseline.limitations.map(item => <li key={item}>{item}</li>)}</ul></details>
        </section>}
        {run && <section className={styles.insightPanel}>
          <div className={styles.insightHeading}><h2>Research context</h2><BookOpen size={16}/></div>
          <p className={styles.agentStatus}><span/> Latest research run · {run.studies.length} studies · {run.findings.length} quote-verified excerpts</p>
          {run.findings.slice(0, 3).map((finding, index) => <article className={styles.researchExcerpt} key={`${finding.chunk_id}-${index}`}><strong>{finding.source_file} · p. {finding.pdf_page}</strong><blockquote>“{finding.quote}”</blockquote></article>)}
          {run.findings.length === 0 && <p className={styles.agentFootnote}>Walang quote-verified research excerpt sa latest run.</p>}
          <p className={styles.agentFootnote}>Evidence provenance is checked against page text. It informs context but does not set the numerical controls.</p>
        </section>}
        <section className={styles.downloadPanel}><h2>Latest migration report</h2><a href="/api/migration/report"><ArrowDownToLine size={15}/>Download report.md</a><a href="/api/migration/report?format=docx"><ArrowDownToLine size={15}/>Download Word report</a><small>Report files reflect the completed migration run, not current STEEP controls.</small></section>
      </aside>
    </div>
  </main>;
}

function Header() {
  return <header className={styles.header}><Link href="/" className={styles.brand} aria-label="ATLAS Overview"><img src="/atlas-logo.png" alt="ATLAS"/></Link><nav aria-label="Main navigation"><Link href="/">Overview</Link><Link href="/migration-scenario" aria-current="page">Scenario Lab</Link><Link href="/compare">Compare</Link></nav><div className={styles.headerActions}><Link href="/about">About</Link><ThemeToggle/></div></header>;
}
