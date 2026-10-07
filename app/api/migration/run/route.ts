import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const regionNames: Record<string, string> = {
  NCR: "NCR", CAR: "CAR", "National Capital Region": "NCR", "Cordillera Administrative Region": "CAR",
  "Ilocos Region": "Region I", "Cagayan Valley": "Region II", "Central Luzon": "Region III",
  CALABARZON: "Region IV-A", MIMAROPA: "MIMAROPA", "Bicol Region": "Region V",
  "Western Visayas": "Region VI", "Central Visayas": "Region VII", "Eastern Visayas": "Region VIII",
  "Zamboanga Peninsula": "Region IX", "Northern Mindanao": "Region X", "Davao Region": "Region XI",
  SOCCSKSARGEN: "Region XII", Caraga: "Region XIII",
  "Bangsamoro Autonomous Region in Muslim Mindanao": "BARMM",
};

export async function GET() {
  try {
    const root = process.cwd();
    const runs = path.join(root, "data", "migration-runs");
    const folders = (await readdir(runs, { withFileTypes: true }))
      .filter(item => item.isDirectory()).map(item => item.name).sort().reverse();
    let runId = "";
    for (const folder of folders) {
      try {
        await Promise.all(["calculation.json", "deped-source.json", "research-evidence.json", "public-sources.json"]
          .map(file => readFile(path.join(runs, folder, file), "utf8")));
        runId = folder;
        break;
      } catch { /* An interrupted run is not a displayable run. */ }
    }
    if (!runId) return NextResponse.json({ error: "No completed migration run is available yet." }, { status: 404 });
    const runDir = path.join(runs, runId);
    const [calculationText, depedText, evidenceText, sourcesText, geoText, explanationText] = await Promise.all([
      readFile(path.join(runDir, "calculation.json"), "utf8"),
      readFile(path.join(runDir, "deped-source.json"), "utf8"),
      readFile(path.join(runDir, "research-evidence.json"), "utf8"),
      readFile(path.join(runDir, "public-sources.json"), "utf8"),
      readFile(path.join(root, "public", "philippine-regions-2023.geojson"), "utf8"),
      readFile(path.join(runDir, "explanation-agent.json"), "utf8").catch(() => "{}"),
    ]);
    const calculation = JSON.parse(calculationText);
    const deped = JSON.parse(depedText);
    const evidence = JSON.parse(evidenceText).evidence;
    const sources = JSON.parse(sourcesText);
    const geo = JSON.parse(geoText);
    const explanation = JSON.parse(explanationText);
    if (deped.status !== "connected" || !Array.isArray(deped.profiles)) throw new Error("The saved DepEd baseline is unavailable.");
    const profiles = deped.profiles.filter((profile: Record<string, unknown>) =>
      typeof profile.region === "string" && profile.region !== "PSO" && Number.isSafeInteger(profile.enrollment_total_2526) &&
      Number(profile.enrollment_total_2526) > 0).map((profile: Record<string, unknown>) => ({
        region: profile.region,
        enrollment: profile.enrollment_total_2526,
      }));
    const nationalTotal = profiles.reduce((sum: number, profile: { enrollment: number }) => sum + profile.enrollment, 0);
    const boundaries = geo.features.filter((feature: { properties?: { name?: string }; geometry?: unknown }) =>
      feature.properties?.name && regionNames[feature.properties.name]).map((feature: { properties: { name: string }; geometry: unknown }) => ({
        name: feature.properties.name, region: regionNames[feature.properties.name], geometry: feature.geometry,
      }));
    return NextResponse.json({
      runId, generatedAt: deped.checkedAt,
      baselineSchoolYear: calculation.baseSchoolYear,
      defaultRegion: calculation.scope.match(/^([^ ]+(?: [^ ]+)?)/)?.[0] || deped.selectedRegion.region,
      defaultRates: calculation.ratesPercent,
      domesticTotal: nationalTotal,
      profiles, boundaries,
      studies: evidence.studies || [], findings: evidence.findings || [], dataGaps: evidence.data_gaps || [],
      sources: (sources.sources || []).map((source: { agency: string; status: string; citations: { title?: string; url: string }[] }) => ({
        agency: source.agency, status: source.status,
        citations: (source.citations || []).map(citation => ({ title: citation.title || citation.url, url: citation.url })),
      })),
      formula: calculation.countFormula,
      baselineSource: calculation.baselineSource,
      domesticPoolTotal: calculation.domesticBaselineTotal,
      agentSummary: typeof explanation.text === "string" ? explanation.text : "No generated agent explanation was included in this run.",
      limitations: [
        "The selected region rate is a user assumption, not an estimated learner-migration rate.",
        "All nonmigration changes are held fixed; this is a sensitivity scenario, not a full enrollment forecast.",
        "Other domestic regions are pooled as the counterpart; origin-destination routes are not modeled.",
        "Population, birth, poverty, ICT, project, budget, classroom and hazard controls are not connected to this migration calculation.",
        "Map outlines use the included 2023 region boundary file; mapped shapes are visual selectors, not migration-flow data.",
      ],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Migration run load failed:", error);
    return NextResponse.json({ error: "Could not load the latest completed migration run." }, { status: 500 });
  }
}
