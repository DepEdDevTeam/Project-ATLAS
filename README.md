# Project Atlas — Scenario Lab

DepEd enrollment history and deterministic education infrastructure planning. The existing trend chart, integrated playback, lever groups, explanation card, planning signal card, map and light/dark appearance are retained. No machine learning or prediction model is used.

## Run and load the data

Requires **Node.js 24+** (the built-in `node:sqlite` API), Python 3.10+ (standard library only), and the nine supplied CSVs. No additional data service is needed.

```powershell
npm install
npm run data:import -- --source "C:\Users\test\Desktop\New folder\Data\drive-download-20260924T230723Z-1-001"
npm run dev
```

Open [Scenario Lab](http://localhost:3002/scenario-lab). Use `Aggregate by`, a sector, and a qualified area or school search to explore the data. Search results are limited to 60; refine the search by a parent area, name or school ID. Every area selection resets its scenario assumptions to avoid applying a national inventory or budget to a school. History and scenario playback support play/pause, seeking, restart and 1×/2× speed. Historical breakdowns have their own school-year selector.

Keep the **raw CSVs local**, outside the application source. The importer creates `data/enrollment.sqlite` (~321 MiB for this delivery) and a small `data/manifest.json` with per-file hashes, encoding, schema, counts and coverage. SQLite files and raw CSVs are excluded from version control. Commit the importer, application, tests and manifest; regenerate the database on each host, or deliberately provision the generated database as a server-side data artifact. Do not place it in `public/` or embed CSVs in client code. Deployment needs a Node server with a readable database volume; this is not a static-export app. `ATLAS_ENROLLMENT_DB` optionally selects a different database path.

The read-only `/api/enrollment` route sends selected aggregates, never all raw school records, to the browser. A bounded 24-selection cache invalidates when the database modification time changes. No learner-level records, names, identifiers or street addresses are ingested. School IDs and school names identify institutions only. Failed or missing imports show a recoverable data-unavailable state instead of a mock baseline.

Optional Mapbox basemap: set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env`. The area selector works without the token or when the basemap fails. The regional ranking list is removed; chart playback stays in a compact footer within the chart. Map colors describe observed enrollment changes, not classroom pressure or hazards. The ±1% band is a display convention, not a statistical significance threshold.

Development outputs use `.next-dev`; production builds use `.next` so validation does not overwrite the running development bundle.

## Source coverage and normalization

The supplied extracts are attributed by the requester to DepEd. Their release status, extraction methodology, completeness and redistribution terms have not been independently verified. Totals describe these files, not a certified national census. The default includes every supplied sector and Philippine Schools Overseas (PSO); choose **Public** for public-sector planning.

| School year | Unique school records | Sum of reported enrollment counts |
| --- | ---: | ---: |
| 2017–18 | 61,563 | 26,311,949 |
| 2018–19 | 61,916 | 27,018,509 |
| 2019–20 | 61,923 | 27,030,391 |
| 2020–21 | 60,957 | 26,227,022 |
| 2021–22 | 60,429 | 27,560,661 |
| 2022–23 | 60,137 | 27,794,282 |
| 2023–24 | 60,167 | 27,081,292 |
| 2024–25 | 60,129 | 26,400,182 |
| 2025–26 | 60,204 | 25,935,863 |

There are **547,425 school-year records**. Latest-year male and female sums are 13,196,598 and 12,739,265. In 2025–26, 60,158 of 60,204 school records contain at least one numeric count; 46 have all count cells missing. Numeric-cell coverage is 2,042,906 / 3,973,464 (51.4%). This falls partly because unoffered SHS cells are blank, so it must not be interpreted as completeness of offered curricula or statistical confidence.

`scripts/normalize_enrollment.py`:

- Reads exactly the nine named files with Python's CSV parser, including quoted commas. Detects UTF-8 / BOM and falls back to CP1252 for the 2025–26 extract, preserving names with accented characters.
- Uses a unique `(school_id TEXT, year INTEGER)` primary key. IDs keep leading zeros. Duplicates, malformed rows, negative or non-integer counts, and unknown offering flags fail the build with file/row context. A temporary database is atomically replaced only after a complete successful import and integrity check.
- Preserves numeric zero and missing values separately. `total`, `male` and `female` sum reported cells; an entirely missing group is null. A partially reported total is still partial; no imputation or completeness claim is made.
- Retains every grade / sex / SHS source column in a compact ordered JSON array. `manifest.files[].countColumns` provides its exact keys for each year. `kinder`, G1–G12 and ESNG / JHSNG remain distinct; SHS grade / strand / track counts are never counted again as a separate grade total.
- Harmonizes True/False and Yes/No offering flags. Keeps 2025–26 `Modified Curricular Offering Classification` as `curriculum`; earlier years are null. G11 SSHS ACAD and SSHS TECHPRO are additional categories, not replacements for ABM/GAS/HUMSS/STEM/TVL. Track comparisons across the schema change require caution.
- Normalizes whitespace/case in place names and maps region labels (e.g. Region I → Ilocos Region). Keeps `source_region`. ARMM maps to the BARMM history label for navigation only, not a fixed geographic footprint. Missing names become `(Unspecified)` and remain in totals.

Aggregation supports school, barangay, municipality, province, division, region and all records. Geography keys include their parent regions/provinces/municipalities to avoid merging places with the same name. Division is a separate administrative branch. Schools are matched by ID across years; geography remains as reported each year. No PSGC crosswalk or school-merger lineage is invented. The map uses the existing 2023 boundaries: NIR (present from 2024–25) and PSO have no matching polygons. Visayas regions after the NIR split, 2025 BARMM / Zamboanga reassignments, and pre-2019 ARMM are left unshaded where footprints differ.

Planning Signal shows observed year-on-year totals, same-ID matched-school change, record counts, numeric-cell coverage and sex composition. Matched-school change uses only schools with a reported total in both consecutive years within the selected area and sector. It reduces coverage churn but does not control for school reclassification, catchment changes, mergers, partial counts or boundary changes. Missing years break chart lines; adjacent available years are not treated as consecutive-year evidence. No correlations are presented as causal effects.

## Scenario assumptions and formulas

The latest available enrollment for the selection anchors its scenario. Earlier last-observed years are explicitly labeled. The timeline runs through SY 2032–33 (year key 2032). Changes to levers recompute the entire timeline, not a saved series of annual decisions. The dashed comparison holds enrollment flat and requests no infrastructure projects while retaining inventory and maintenance assumptions.

All **currency inputs are millions of pesos**. Default unit costs are editable examples, not actual construction costs: new room 2.5, rehabilitation 1, expansion room 2.5, annex/new-school package 20, resilience upgrade 0.5, ICT provision 0.1, and annual maintenance 0.02 per usable room. Budget defaults to 100. Project requests, growth, progression, access, ICT share, equity reserve and exposed rooms default to zero. No classroom inventory is assumed by default.

STEEP groups:

- **Social:** annual enrollment growth plus assumed net progression and access contributions (percentage points), and an unassigned equity budget reserve. These contributions are not a cohort survival model. Observed sex composition is contextual; neither gender disparity nor enrollment alone establishes disadvantage.
- **Technological:** assumed ICT share in added rooms and cost per equipped room. No connectivity readiness is observed or inferred.
- **Economic:** eligible-year budget, annual project requests, five editable unit costs, maintenance cost.
- **Environmental:** assumed initially exposed rooms, annual retrofit requests and cost. An upgrade count is not an estimate of avoided damage or risk reduction.
- **Political / Policy:** learners per classroom (default 40, explicitly not an official standard), rooms per annex/package (6), eligible budget share (100%), funding interval (1 year), and optional assumed total/unusable classroom inventories.

For each scenario year:

```text
enrollment = round(previous enrollment × (1 + (growth + progression + access) / 100))
required rooms = ceil(enrollment / assumed learners per classroom)
eligible budget = budget cap × eligibility / 100 in funded years; otherwise zero
maintenance = min(eligible budget, previous usable rooms × maintenance cost)
equity reserve = (eligible budget − maintenance) × equity share / 100
project envelope = eligible budget − maintenance − equity reserve
effective construction unit cost = base cost + added rooms per unit × ICT share / 100 × ICT cost
funded units = min(request, floor(project envelope × strategy share / effective unit cost))
annual spend = maintenance + sum(funded units × effective costs)
unspent = eligible budget − annual spend
```

Funding starts in the first scenario year and recurs at the selected interval; budgets are not accumulated between funded years. Maintenance is paid first and capped by available funding; the model does not assert that all maintenance needs were met. With unknown inventory, only scenario-added rooms incur modeled maintenance. Equity reserves remain unassigned and are included in unspent funds. Unused category allocations are not redistributed or carried forward. Whole projects/rooms are rounded down to avoid overspending.

With a supplied assumed inventory, usable rooms start at total minus unusable rooms, then gain funded new rooms, expansion rooms, annex packages × rooms per package, and rehabilitated unusable rooms. Rehabilitation cannot restore the same unusable rooms twice. Without that inventory, rehabilitation has a cost but is not credited as capacity. Remaining gap is `max(0, required − usable)` only when usable inventory is supplied; otherwise it is **unknown**. At aggregated scales, this is a net arithmetic gap and can mask mismatches between schools; it does not identify overcrowded schools. Upgrades are capped by remaining assumed exposed rooms; hazard exposure itself is not measured.

The comparison tab changes only these disclosed, normative budget shares:

| Strategy | New | Rehabilitation | Expansion | Annex/new-school | Resilience |
| --- | ---: | ---: | ---: | ---: | ---: |
| Growth-led | 50% | 10% | 25% | 10% | 5% |
| Equity-led | 15% | 15% | 20% | 40% | 10% |
| Capacity-led | 40% | 25% | 25% | 5% | 5% |
| Resilience-led | 10% | 20% | 5% | 5% | 60% |
| Balanced | 20% | 20% | 20% | 20% | 20% |

These are editable-input scenario comparisons, not optimized allocations or evidence-derived area rankings. Equity-led favors an annex access hypothesis without asserting where disadvantage exists. Annex/new-school **affordability** is computed, but feasibility remains unassessed: land, catchment, travel time, site safety, staffing and approvals are missing. No construction delays, inflation, lifecycle risk, land acquisition or recurrent staffing costs are independently estimated.

## External context and additional evidence needed

The existing source browser remains separate: PSA provides demographic context; BetterGov provides budget/program context; flood-control project records provide project context and are not hazard rasters; ASEAN provides country/regional benchmarks only. None are inputs to the scenario engine. Reading an external source does not connect it to calculations.

Actual infrastructure recommendations require dated school-level usable/unusable room inventories, room utilization/shifts and capacity, condition assessments, official DepEd standards and eligibility rules, locality-specific verified unit costs, budgets and funding dates. Equity comparisons need deprivation/access/catchment and population data. Resilience planning needs school geocodes linked to dated hazard/exposure layers. Annex feasibility additionally needs land availability, travel/access analysis and staffing. Do not interpret the current estimates as actual gaps, appropriations, commitments or impact.

## Refresh and verification

1. Obtain the replacement source-year CSVs and keep the original filenames. Never overwrite the original extracts during normalization.
2. Re-run `npm run data:import -- --source "<folder>"`. Optionally use `--output "<folder>"` and set `ATLAS_ENROLLMENT_DB` accordingly. A failed import leaves the last completed store intact.
3. Inspect `data/manifest.json`, hashes, row counts, null-cell coverage and new source columns. The importer requires all nine years; extending the supported year range requires an explicit schema/UI/test update.
4. Run the checks below, reload the browser, and confirm selected-area coverage and boundary limitations. The read-only server cache detects a replaced database. On Windows, close active requests if they prevent replacing an open file, then retry.

```powershell
npm run typecheck
npm test
npm run test:data -- "C:\Users\test\Desktop\New folder\Data\drive-download-20260924T230723Z-1-001"
npm run build
```

`npm test` checks independently specified scenario outputs, repeatability, budget conservation for all strategies, zero funding, interval/eligibility behavior, missing inventory, rehabilitation/exposure bounds, and ICT costs. With the generated database present, it also tests all seven aggregation levels, exact school history, missing SHS counts, historical breakdowns and input validation.

`test:data` checks parser behavior and independently reads every original CSV to reconcile row counts, male/female/enrollment totals, representative full breakdowns and names, geographic aggregation conservation, uniqueness and database integrity. Tests use the supplied data without modifying it.

Useful API examples: `/api/enrollment` for all history; `?level=region&view=areas&q=Ilocos` for matching qualified keys; `?level=school&key=%5B%22100001%22%5D&year=2017` for a school's history and a 2017–18 breakdown. `sector=Public` filters all calculations. Unknown selections return an empty history; invalid parameters return 400; missing/unreadable data returns 503.
