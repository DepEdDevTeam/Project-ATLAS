export type EvidenceStatus = 'ready' | 'needs-mapping' | 'missing';
export type SourceObservation = {
  codes: string[];
  labels: string[];
  value: number | null;
  status: string;
};
export type PsaSnapshot = {
  schemaVersion: 1;
  id: string;
  indicator: 'population-projection' | 'net-enrollment-rate';
  unit: 'thousand-persons' | 'percent';
  unitSource: string;
  geography: string;
  importedAt: string;
  transport: 'bettergov-mirror';
  mirrorUrl: string;
  originalSourceUrl: string;
  release: string;
  sourceUpdated: string;
  mirrorRetrieved: string;
  contentHash: string;
  payload?: unknown;
  dimensions: { code: string; label: string }[];
  rows: SourceObservation[];
};
export type CoverageItem = {
  indicator: string;
  status: EvidenceStatus;
  reason: string;
  numericCells: number;
  missingCells: number;
  source: Pick<PsaSnapshot, 'originalSourceUrl' | 'mirrorUrl' | 'release' | 'sourceUpdated' | 'mirrorRetrieved' | 'contentHash' | 'unit' | 'geography'>;
};
