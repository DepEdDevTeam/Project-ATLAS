# ATLAS migration MVP agents

Run from the project folder:

```powershell
node --env-file=.env .\scripts\run-migration-agents.mjs
```

Uses `OPENAI_API_KEY` or existing `OPENAI_LLM_KEY` on the server. Set `OPENAI_MODEL` to override `gpt-4.1-mini` and `OPENAI_SEARCH_MODEL` to override `gpt-5-mini` for domain-filtered web search. Each run invokes three agent roles, with separate public source lookups for PSA, BetterGov and ASEAN; OpenAI API usage is billed to your API project.

1. Research Evidence Agent selects relevant local chunks and produces findings. Code verifies each quote and page against the supplied chunks.
2. Public Sources Agent searches PSA, BetterGov and ASEAN and retains web citations. This is public web retrieval, not a live statistical API connector.
3. Scenario Explanation Agent explains calculated outcomes and data gaps. A deterministic calculator, not the LLM, produces numbers.

DepEd connector reads `regional_profiles`, selected-region `kes_historical`, `national_kpi_timeline`, `raw_catalog`, and `mv_catalog` via ADC. Configure `DEPED_FIREBASE_PROJECT_ID` and `DEPED_FIREBASE_DATABASE_ID`. It requires a valid observed regional baseline and complete domestic totals before generating scenarios. It fetches aggregate records only. Local enrollment SQLite remains separate context.

Outputs: `data/migration-runs/<timestamp>/report.md` plus evidence, public source citations, calculations, connection status, enrollment context, and model usage JSON. The input PDF and chunk files are preserved.

Multiple studies (explicit files or all `*-chunks.json` files in one directory):

```powershell
npm run agents:migration -- ".\data\research\study1-chunks.json" ".\data\research\study2-chunks.json"
npm run agents:migration -- --research-dir=./data/research
```

Each distinct input gets a separate evidence request with at most 24 relevance-ranked chunks and at most 5 findings. Filenames, PDF pages, original chunk IDs and content hashes are retained. Chunk IDs are namespaced per study. Identical input files are deduplicated. No relevant validated findings is recorded as a gap; findings are never forced. Added research informs interpretation, not the assumed migration rates. Per-study caches require matching input identity, selection version and model. To resume a multiple-study run, supply the same inputs or `--research-dir` as well as `--resume`. Cross-study synthesis in explanation-agent.json remains an unverified draft; report.md contains the validated quotes and limitations.

The default region is Region IV-A (CALABARZON). Counts use its observed `enrollment_total_2526` from `regional_profiles` as the SY 2025-2026 baseline. School-year ending year 2026 is normalized to index=100. Year 2027 means SY 2026-2027, and 2035 means SY 2034-2035. Annual assumed migration contributions remain -0.5%, 0%, +0.5%; these assumptions are illustrative and are not fitted from IMPACT, PSA or ASEAN. All nonmigration changes are held fixed. Other domestic regions form a pooled counterpart and absorb exactly the opposite change, preserving domestic totals. PSO is excluded. This pooling does not identify the actual source/destination of transfers. Outputs are sensitivity scenarios, not calibrated migration forecasts or statistical confidence intervals.

Override assumptions:

```powershell
node --env-file=.env .\scripts\run-migration-agents.mjs --rates=-1,0,1
node --env-file=.env .\scripts\run-migration-agents.mjs "--region=NCR"
```

If a public source request fails, resume the same run folder to reuse validated evidence and completed per-agency lookups:

```powershell
npm run agents:migration -- --resume=data/migration-runs/YOUR-RUN-FOLDER
```

For a completed run, generate the PDF explanation and readable report with Python that has `reportlab` installed:

```powershell
python .\scripts\build-migration-report-pdf.py .\data\migration-runs\YOUR-RUN-FOLDER
```

PSA already publishes historical household origin-destination migration tables and population projections. The public-source agent checks those rather than assuming absence. They provide context but are not numerical inputs to the sensitivity calculation. Place-of-school data can describe commuting rather than residential migration. A calibrated learner-migration forecast requires aligning population/learner definitions, geography, school years and rates, then estimating and evaluating the learner-specific component. Climate indicators are needed when estimating climate-related effects. Scanned research pages require OCR before extraction.
