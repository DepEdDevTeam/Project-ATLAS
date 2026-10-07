import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Verified report text uses snapshot fields and validated quotes, not unverified LLM numeric claims.
export function reviewedReport(calculation, deped, evidence, sources) {
  const c = calculation, d = deped;
  const baseline = d.selectedRegion;
  const years = [...new Set(d.selectedRegionHistoricalKpis.map(k => k.school_year))].sort();
  const latest = years.at(-1);
  const latestKpis = d.selectedRegionHistoricalKpis.filter(k => k.school_year === latest);
  const kpiTable = ['| Level | GER (%) | NER (%) | Retention (%) | Transition (%) | School-leaver (%) |', '|---|---:|---:|---:|---:|---:|', ...latestKpis.map(k => `| ${k.level} | ${['ger','ner','rr','tr','slr'].map(field => Number.isFinite(k[field]) ? Number(k[field].toFixed(2)) : 'Not supplied').join(' | ')} |`)].join('\n');
  const outputTable = ['| School year | Low learners | Base learners | High learners |', '|---|---:|---:|---:|', ...c.rows.map(r => `| ${r.schoolYear} | ${r.lowLearners.toLocaleString('en-US')} | ${r.baseLearners.toLocaleString('en-US')} | ${r.highLearners.toLocaleString('en-US')} |`)].join('\n');
  const refs = sources.flatMap(s => s.citations.map(ref => `- ${s.agency}: [${ref.title || ref.url}](${ref.url})`));
  return `# ATLAS: ${baseline.region} learner migration scenario, 2027-2035

## Observed baseline and inspected data

Actual enrollment baseline: **${c.baseEnrollment.toLocaleString('en-US')} learners**, SY ${c.baseSchoolYear}, from \`${c.baselineSource}\`. The index normalizes this observed count to 100 at school-year ending year 2026. Year 2027 represents SY 2026-2027; year 2035 represents SY 2034-2035.

The connector inspected regional_profiles, ${d.selectedRegionHistoricalKpis.length} selected-region historical KPI records (${years[0]} to ${latest}), national_kpi_timeline, and ${d.catalogAudit.tableCount} raw/materialized-view catalog entries. It is no longer based only on department_orders. Snapshots and document paths are in deped-source.json.

Regional enrollment stock: SY 2023-2024 = ${baseline.enrollment_total_2324.toLocaleString('en-US')}; SY 2024-2025 = ${baseline.enrollment_total_2425.toLocaleString('en-US')}; SY 2025-2026 = ${c.baseEnrollment.toLocaleString('en-US')}. Enrollment changes alone do not identify migration: reporting, geographic boundaries, cohort changes, progression and exits may also contribute.

## Historical education indicators: SY ${latest}

${kpiTable}

Values above are percentage values copied from kes_historical and rounded to two decimals for presentation. Profile retention/transition fields use proportions; their units must be normalized before combining data. Missing values remain missing. These indicators provide education context; they are not annual learner migration rates and are not inputs to the current calculator.

## Research evidence

The supplied studies provide research context, not a calibrated learner-transfer rate. Each study is analyzed separately using at most 24 relevance-ranked chunks, not a full-document review. Zero verified findings means no relevant evidence passed validation, not that the study has no relevant information. Historical policy statements describe the study publication period and do not establish current policy status. Overlapping studies are not automatically independent corroboration.

${(evidence.studies || []).map(s => `- ${s.source_file}: ${s.verifiedFindings} verified findings; ${s.selectedChunks}/${s.totalChunks} chunks selected; ${s.rejectedFindings} findings rejected.`).join('\n')}

${evidence.findings.map(f => `- ${f.source_file || 'IMPACT-Study-Final-web-page-2.pdf'}, PDF page ${f.pdf_page}, chunk ${f.chunk_id}: "${f.quote}"\n  Population: ${f.population || 'Not specified'}. Limitation: ${Array.isArray(f.limitations) ? f.limitations.join('; ') : f.limitations || 'Not specified'}`).join('\n\n')}

### Study-specific evidence gaps

${evidence.data_gaps.map(gap => `- ${gap}`).join('\n')}

Validation confirms quote text and page provenance, not the truth of every LLM claim or its causal relevance. Some excerpts concern institutions or climate mitigation and are background only, not direct learner-migration evidence. Cross-study interpretation is retained in explanation-agent.json as an LLM draft, not verified calibration evidence. Added studies can change the explanation but do not change the assumed rates or calculator results unless those numerical inputs change.

## PSA, BetterGov and ASEAN

${sources.map(s => `- ${s.agency}: ${s.status}; ${s.citations.length} source citations retained. Connection type: ${s.connection}.`).join('\n')}

PSA publishes 2020 Census historical origin-destination migration tables (2015-2020) and population projections. Those household/population measures require population, age, geography and time alignment before estimating enrolled-learner flows. Place-of-school measures may represent commuting rather than residential migration or a school transfer. Retrieved URLs appear below; the present run has not loaded their statistical tables into the calculator. BetterGov is a community portal; upstream PSA provenance must be retained. ASEAN sources offer regional context, not a measured Philippine learner-transfer series in this calculation.

## Calculation and 2027-2035 results

Assumed annual net migration contributions: **${c.ratesPercent.join('%, ')}%**. These are ${c.rateOrigin.toLowerCase()}. Formula: learners(y) = round(baseEnrollment x (1 + r/100)^(y-2026)). Neither PSA flows nor research statistics were used to estimate r. All nonmigration changes are held fixed.

${outputTable}

Internal transfers are conserved: other domestic learners = ${c.domesticBaselineTotal.toLocaleString('en-US')} - modeled regional learners. PSO is excluded. The other domestic regions form a pooled counterpart; the model does not identify individual origin or destination counterparts. This is a sensitivity scenario conditional on the assumed rates, not a calibrated migration forecast or a full demographic enrollment projection.

## Revised conclusion and next steps

There is usable existing DepEd enrollment/KPI history and PSA migration/population evidence. The remaining task is to align their measures and estimate the learner-specific component, rather than assume data is absent. This run has not confirmed a direct learner origin-destination flow field in the inspected catalog entries; underlying source artifacts and uncatalogued tables remain to be investigated. Missing retrieval does not establish dataset absence.

For calibration: retrieve the PSA statistical tables, reconcile geographic boundaries and age groups with DepEd enrollment, distinguish commuting from transfers and residential moves, fit the learner-specific component, and evaluate against held-out observations. Climate indicators are needed when estimating climate-related effects. Check whether any adopted PSA projection already includes migration assumptions before adding a separate migration adjustment.

Calculation citations: calculation.json; observed snapshots: deped-source.json; research provenance: research-evidence.json and research-manifest.json (source filenames and content hashes); arithmetic implementation: scripts/run-migration-agents.mjs. The original LLM explanation is retained separately as a draft in explanation-agent.json; this report replaces its unverified KPI summaries and broad current-policy assertions with snapshot values and bounded evidence.

## Retrieved source citations

${[...new Set(refs)].join('\n')}
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = path.resolve(process.argv[2]);
  const read = async name => JSON.parse(await readFile(path.join(directory, name), 'utf8'));
  const [c,d,e,s] = await Promise.all(['calculation.json','deped-source.json','research-evidence.json','public-sources.json'].map(read));
  await writeFile(path.join(directory, 'report.md'), reviewedReport(c,d,e.evidence,s.sources), 'utf8');
  console.log('Reviewed report generated from snapshots and validated evidence.');
}
