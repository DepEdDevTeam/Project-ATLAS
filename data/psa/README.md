# PSA evidence bundle

Refresh from the project root with `node scripts/import-psa.mjs`.

`bundle.json` contains complete release-pinned BetterGov mirrors of two PSA
OpenSTAT tables: national five-year-age population projections (2020–2030),
and national/regional net enrollment rates by education stage and sex.
Transport is a community mirror, not a direct PSA API connection. Original PSA
URLs, mirror retrieval dates, release IDs, units, raw observation status, codes,
labels, and payload hashes are retained. Population values are in thousands;
rates are percentages. Neither unit is inferred from the mirror's generic unit
label; official unit-source URLs are recorded.

The importer checks complete dimension coverage, duplicate keys, release identity,
and valid numeric/missing cells before atomically replacing the bundle. A failed
refresh leaves the previous completed bundle available. Geographic codes are
explicit and must be reviewed if source dimensions change.

Refreshes now retain the original query payload and archive prior/current
snapshots by payload hash in `snapshots/`. Read-time validation verifies retained
payload hashes and equality with normalized rows/dimensions, rejects duplicate
observation identities, and checks units and required dimensions. Older archives
without a retained payload preserve their importer-recorded hash but cannot
recompute it. Published rates above 100 are retained in the source; the Social
module rejects them when selected for planning calculations.

The Social module accepts a single exact regional snapshot or a multi-geography
snapshot with explicit `Geolocation` codes. Missing regions remain unavailable;
overlapping compatible releases are rejected rather than selected by file order.
The current bundle still contains national population projections only.

Read `GET /api/agents/coverage` for coverage status. This is the first data
foundation slice, not a completed scenario agent. Subnational projection XLSX
tables are not imported here. Stage ages, source-year conventions, geographic
boundaries, and public/private sector coverage still need alignment. Multiplying
a cohort by net enrollment rate estimates official-age enrolled children, not all
learners: over-age/under-age enrollment must be modeled separately.

Migration has no configuration input. PSA projection baselines already include
migration assumptions. Additional evidence review should provide context without
adding a second migration contribution to the same population baseline.
