export type WorkspaceIndicator = {
  id: string;
  name: string;
  domain: "Social" | "Technological" | "Economic" | "Environmental" | "Political / Policy";
  unit: string;
  source: string;
  baseline?: { value: number; period: string; label: string; sourceUrl: string; magnitude?: number; denominator?: number };
};

export type AnalysisWorkspace = {
  indicators: string[];
  geography: string;
  period: string;
  chart: string;
};

export const WORKSPACE_INDICATORS: WorkspaceIndicator[] = [
  { id: "population", name: "Population", domain: "Social", unit: "persons", source: "PSA", baseline: { value: 112729484, period: "01 July 2024", label: "Official census count", sourceUrl: "https://psa.gov.ph/content/2024-census-population-popcen-population-counts-declared-official-president" } },
  { id: "poverty-incidence", name: "Poverty incidence", domain: "Social", unit: "%", source: "PSA", baseline: { value: 9.7, period: "2025", label: "Official poverty estimate", magnitude: 11080000, sourceUrl: "https://psa.gov.ph/content/poverty-incidence-all-regions-declined-between-2023-and-2025" } },
  { id: "employment-rate", name: "Employment rate", domain: "Economic", unit: "%", source: "PSA", baseline: { value: 95.8, period: "2025 annual", label: "Preliminary annual estimate", magnitude: 49010000, denominator: 51160000, sourceUrl: "https://psa.gov.ph/content/2025-annual-provincial-labor-market-statistics-preliminary-results" } },
  { id: "consumer-prices", name: "Consumer prices", domain: "Economic", unit: "index", source: "PSA" },
  { id: "government-appropriations", name: "Government appropriations", domain: "Political / Policy", unit: "PHP", source: "BetterGov" },
  { id: "public-projects", name: "Public projects", domain: "Political / Policy", unit: "projects", source: "BetterGov" },
  { id: "internet-access", name: "Internet access", domain: "Technological", unit: "%", source: "PSA / ASEAN" },
  { id: "disaster-indicators", name: "Disaster indicators", domain: "Environmental", unit: "varies", source: "PSA / ASEAN" },
];

export const encodeWorkspace = (workspace: AnalysisWorkspace) => {
  const params = new URLSearchParams();
  params.set("indicators", workspace.indicators.join(","));
  params.set("geography", workspace.geography);
  params.set("period", workspace.period);
  params.set("chart", workspace.chart);
  return params.toString();
};

export const readWorkspace = (params: URLSearchParams): AnalysisWorkspace | null => {
  const valid = new Set(WORKSPACE_INDICATORS.map(item => item.id));
  const indicators = (params.get("indicators") || "").split(",").filter(id => valid.has(id));
  if (!indicators.length) return null;
  return {
    indicators,
    geography: params.get("geography") || "Philippines — national",
    period: params.get("period") || "Latest available",
    chart: params.get("chart") || "Trend",
  };
};
