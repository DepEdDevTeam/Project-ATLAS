import { stages } from '@/lib/agents/planning-contract';
import type { DomainResult } from '@/lib/agents/planning-contract';
const colors = ['#1e40af', '#a16207', '#087f5b', '#7e22ce'];
const dash = ['', '8 4', '2 4', '10 3 2 3'];
export default function PlanningTrendChart({ timeline }: { timeline: { year: number; results: DomainResult[] }[] }) {
  const values = timeline.flatMap(point => stages.map(stage => point.results[0].calculations.find(x => x.id === `${stage}.enrollment`)?.value ?? null));
  const maximum = Math.max(1, ...values.filter((value): value is number => value !== null));
  const x = (index: number) => 60 + index * 600 / Math.max(1, timeline.length - 1);
  const y = (value: number) => 270 - value / maximum * 220;
  return <figure><figcaption>Conditional official-age enrollment by stage, {timeline[0]?.year}–{timeline.at(-1)?.year}. Missing observations are gaps, not zero.</figcaption><svg viewBox="0 0 720 320" style={{ width: '100%' }} role="img" aria-label="Enrollment trends; exact values are in the following table"><path d="M60 40V270H675" fill="none" stroke="#64748b"/><text x="60" y="25" fill="currentColor" fontSize="13">Learners · maximum {Math.round(maximum).toLocaleString()}</text>{timeline.map((point, index) => <text key={point.year} x={x(index)} y="295" textAnchor="middle" fontSize="13" fill="currentColor">{point.year}</text>)}{stages.map((stage, stageIndex) => {
    let open = false;
    const path = timeline.map((point, index) => { const value = point.results[0].calculations.find(c => c.id === `${stage}.enrollment`)?.value ?? null; if (value === null) { open = false; return ''; } const command = open ? 'L' : 'M'; open = true; return `${command}${x(index)} ${y(value)}`; }).join(' ');
    return <path key={stage} d={path} fill="none" stroke={colors[stageIndex]} strokeWidth="3" strokeDasharray={dash[stageIndex]}><title>{stage}</title></path>;
  })}</svg><p>{stages.map((stage, index) => <span key={stage} style={{ display: 'inline-block', marginRight: 16 }}><span style={{ color: colors[index] }}>━ </span>{stage} ({index === 0 ? 'solid' : index === 1 ? 'dashed' : index === 2 ? 'dotted' : 'dash-dot'})</span>)}</p><table><caption>Exact conditional enrollment by stage</caption><thead><tr><th scope="col">Year</th>{stages.map(stage => <th key={stage} scope="col">{stage}</th>)}</tr></thead><tbody>{timeline.map(point => <tr key={point.year}><th scope="row">{point.year}</th>{stages.map(stage => { const value = point.results[0].calculations.find(x => x.id === `${stage}.enrollment`)?.value ?? null; return <td key={stage}>{value === null ? 'Unavailable' : value.toLocaleString()}</td>; })}</tr>)}</tbody></table></figure>;
}
