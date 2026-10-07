export type RegionBaseline = {
  region: string;
  enrollment: { year: string; endYear: number; enrollment: number }[];
  schools: { total: number | null; es: number | null; jhs: number | null; shs: number | null; year: string };
  teachers: { total: number | null; year: string; historicalRatios: { year: string; stage: string; learnersPerTeacher: number }[] };
  technology: {
    year: string; academicDevices: number | null; totalDevices: number | null;
    internetByStage: { stage: string; offerings: number; withInternet: number; instructionalUse: number | null }[];
    internetCoveragePct: number | null; internetCoverageBasis: string;
  };
  classrooms: { total: number | null; year: string };
  environment: {
    year: string; floodMarkerCountsByStage: { es: number | null; hs: number | null }; floodMarkerSchoolOfferings: number;
    boatAccessCountsByStage: { es: number | null; hs: number | null }; walkingAccessCountsByStage: { es: number | null; hs: number | null };
  };
  economic: { latestRegionalSchoolMoee: number | null; fiscalYear: string | null; sourceNote: string | null };
  dataCoverage: Record<string, unknown>;
  baselineSource: string;
  limitations: string[];
};

export type SteepControls = {
  enrollmentGrowthPct: number;
  additionalTeachersPerSchool: number;
  internetCoveragePct: number;
  learnersPerDevice: number;
  budgetPerSchool: number;
  classroomFundingPerRoom: number;
  maintenancePerSchool: number;
  hazardExposurePct: number;
  climateEventsPerYear: number;
  disruptionDaysPerEvent: number;
};

export type SteepResults = ReturnType<typeof calculateSteepScenario>;

const round = (value: number) => Math.round(value);
const nonnegative = (value: number | null) => Math.max(0, value || 0);

export function calculateSteepScenario(baseline: RegionBaseline, controls: SteepControls, year: number) {
  const baseEnrollment = baseline.enrollment.find(item => item.endYear === 2026)?.enrollment || baseline.enrollment.at(-1)?.enrollment || 0;
  const yearsAhead = Math.max(0, year - 2026);
  const projectedLearners = round(baseEnrollment * (1 + controls.enrollmentGrowthPct / 100) ** yearsAhead);
  const schools = nonnegative(baseline.schools.total);
  const teachers = nonnegative(baseline.teachers.total);
  const addedTeachers = round(schools * controls.additionalTeachersPerSchool);
  const scenarioTeachers = teachers + addedTeachers;
  const learnersPerTeacher = scenarioTeachers ? projectedLearners / scenarioTeachers : null;
  const baselineTeacherRatio = teachers && baseline.enrollment.find(item => item.endYear === 2024)
    ? baseline.enrollment.find(item => item.endYear === 2024)!.enrollment / teachers : null;
  const offerings = baseline.technology.internetByStage.reduce((sum, item) => sum + item.offerings, 0);
  const connectedOfferingsObserved = baseline.technology.internetByStage.reduce((sum, item) => sum + item.withInternet, 0);
  const connectedOfferingsScenario = round(offerings * controls.internetCoveragePct / 100);
  const devicesAvailable = nonnegative(baseline.technology.academicDevices);
  const devicesRequired = controls.learnersPerDevice > 0 ? Math.ceil(projectedLearners / controls.learnersPerDevice) : 0;
  const deviceGap = Math.max(0, devicesRequired - devicesAvailable);
  const classrooms = nonnegative(baseline.classrooms.total);
  const schoolBudget = controls.budgetPerSchool * schools;
  const classroomBudget = controls.classroomFundingPerRoom * classrooms;
  const maintenanceBudget = controls.maintenancePerSchool * schools;
  const annualPlanningFunds = schoolBudget + classroomBudget + maintenanceBudget;
  const totalOfferings = baseline.technology.internetByStage.reduce((sum, item) => sum + item.offerings, 0);
  const scenarioExposedOfferings = round(totalOfferings * controls.hazardExposurePct / 100);
  const baselineFloodMarkerPct = totalOfferings ? baseline.environment.floodMarkerSchoolOfferings / totalOfferings * 100 : null;
  const annualDisruptedOfferingDays = scenarioExposedOfferings * controls.climateEventsPerYear * controls.disruptionDaysPerEvent;

  return {
    year,
    schoolYear: `SY ${year - 1}-${String(year).slice(-2)}`,
    baseEnrollment,
    projectedLearners,
    enrollmentChange: projectedLearners - baseEnrollment,
    observedEnrollmentGrowthPct: baseline.enrollment.length > 1
      ? ((baseline.enrollment.at(-1)!.enrollment / baseline.enrollment[0].enrollment) ** (1 / Math.max(1, baseline.enrollment.at(-1)!.endYear - baseline.enrollment[0].endYear)) - 1) * 100
      : null,
    schools,
    teachersObserved: teachers,
    teacherYear: baseline.teachers.year,
    addedTeachers,
    scenarioTeachers,
    baselineTeacherRatio,
    learnersPerTeacher,
    internetOfferings: offerings,
    observedInternetPct: baseline.technology.internetCoveragePct,
    connectedOfferingsObserved,
    connectedOfferingsScenario,
    addedConnectedOfferings: connectedOfferingsScenario - connectedOfferingsObserved,
    internetYear: baseline.technology.year,
    devicesAvailable,
    devicesRequired,
    deviceGap,
    deviceYear: baseline.technology.year,
    schoolBudget,
    classroomBudget,
    maintenanceBudget,
    annualPlanningFunds,
    observedMoee: baseline.economic.latestRegionalSchoolMoee,
    moeeFiscalYear: baseline.economic.fiscalYear,
    exposedOfferings: scenarioExposedOfferings,
    baselineFloodMarkerPct,
    baselineFloodMarkerOfferings: baseline.environment.floodMarkerSchoolOfferings,
    disruptedOfferingDays: annualDisruptedOfferingDays,
    environmentYear: baseline.environment.year,
  };
}
