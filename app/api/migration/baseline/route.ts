import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedRegions = new Set([
  "NCR", "CAR", "Region I", "Region II", "Region III", "Region IV-A", "Region IV-B", "Region V",
  "Region VI", "Region VII", "Region VIII", "Region IX", "Region X", "Region XI", "Region XII",
  "Region XIII", "MIMAROPA", "BARMM", "NIR",
]);
const stages = [
  { key: "es", label: "ES" }, { key: "jhs", label: "JHS" }, { key: "shs", label: "SHS" },
] as const;
const numeric = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

function firestore() {
  const name = "atlas-migration-baseline";
  const app = getApps().find(candidate => candidate.name === name) || initializeApp({
    projectId: process.env.DEPED_FIREBASE_PROJECT_ID || "depedprototype",
    credential: applicationDefault(),
  }, name);
  return getFirestore(app, process.env.DEPED_FIREBASE_DATABASE_ID || "depedprot");
}

export async function GET(request: Request) {
  const region = new URL(request.url).searchParams.get("region") || "";
  if (!allowedRegions.has(region)) return NextResponse.json({ error: "Choose a supported domestic region." }, { status: 400 });
  try {
    const db = firestore();
    const [snapshot, kpiSnapshot, budgetSnapshot] = await Promise.all([
      db.collection("regional_profiles").doc(region).get(),
      db.collection("kpi_by_level").where("region", "==", region).limit(100).get(),
      db.collection("mv_mooe_allocation_by_region").where("region", "==", region).limit(20).get(),
    ]);
    if (!snapshot.exists) return NextResponse.json({ error: "No regional profile is available for this selection." }, { status: 404 });
    const p = snapshot.data() || {};
    const schoolYears = [
      { year: "2023-2024", endYear: 2024, enrollment: numeric(p.enrollment_total_2324) },
      { year: "2024-2025", endYear: 2025, enrollment: numeric(p.enrollment_total_2425) },
      { year: "2025-2026", endYear: 2026, enrollment: numeric(p.enrollment_total_2526) },
    ].filter(item => item.enrollment !== null);
    const schools = {
      total: numeric(p.schools_total_2324),
      es: numeric(p.schools_with_es_2324),
      jhs: numeric(p.schools_with_jhs_2324),
      shs: numeric(p.schools_with_shs_2324),
      year: "2023-2024",
    };
    const internetByStage = stages.map(({ key, label }) => ({
      stage: label,
      offerings: numeric(p[`schools_with_${key}_2324`]),
      withInternet: numeric(p[`wash_2324_${key}_has_internet`]),
      instructionalUse: numeric(p[`wash_2324_${key}_internet_purpose_instructional`]),
    })).filter(item => item.offerings !== null && item.withInternet !== null);
    const totalOfferings = internetByStage.reduce((sum, item) => sum + (item.offerings || 0), 0);
    const connectedOfferings = internetByStage.reduce((sum, item) => sum + (item.withInternet || 0), 0);
    const latestMoee = budgetSnapshot.docs.map(doc => doc.data()).filter(item => Number(item.fiscal_year) > 0)
      .sort((a, b) => Number(b.fiscal_year) - Number(a.fiscal_year))[0];
    const historicalRatios = kpiSnapshot.docs.map(doc => doc.data()).filter(item => typeof item.teacher_learner_ratio === "number")
      .sort((a, b) => String(b.sy || "").localeCompare(String(a.sy || "")));
    const floodMarkerSchools = (numeric(p.fac_2324_es_has_flood_marker) || 0) + (numeric(p.fac_2324_hs_has_flood_marker) || 0);
    const coverage = p.data_coverage && typeof p.data_coverage === "object" ? p.data_coverage as Record<string, unknown> : {};
    return NextResponse.json({
      region,
      enrollment: schoolYears,
      schools,
      teachers: { total: numeric(p.teachers_total_2324), year: "2023-2024", historicalRatios: historicalRatios.slice(0, 15).map(item => ({ year: item.sy, stage: item.level_of_education, learnersPerTeacher: item.teacher_learner_ratio })) },
      technology: {
        year: "2023-2024",
        academicDevices: numeric(p.ict_academic_devices_2324),
        totalDevices: numeric(p.ict_devices_total_2324),
        internetByStage,
        internetCoveragePct: totalOfferings ? connectedOfferings / totalOfferings * 100 : null,
        internetCoverageBasis: "School-level offerings across ES, JHS, and SHS; schools offering multiple levels may be counted more than once. Internet access is not a Wi-Fi or service-quality measure.",
      },
      classrooms: { total: numeric(p.classrooms_total_2324), year: "2023-2024" },
      environment: {
        year: "2023-2024",
        floodMarkerCountsByStage: { es: numeric(p.fac_2324_es_has_flood_marker), hs: numeric(p.fac_2324_hs_has_flood_marker) },
        floodMarkerSchoolOfferings: floodMarkerSchools,
        boatAccessCountsByStage: { es: numeric(p.fac_2324_es_accessible_boat), hs: numeric(p.fac_2324_hs_accessible_boat) },
        walkingAccessCountsByStage: { es: numeric(p.fac_2324_es_accessible_walking_hiking), hs: numeric(p.fac_2324_hs_accessible_walking_hiking) },
      },
      economic: { latestRegionalSchoolMoee: numeric(latestMoee?.school_mooe_total_php), fiscalYear: latestMoee?.fiscal_year || null, sourceNote: latestMoee?.note || null },
      dataCoverage: coverage,
      baselineSource: `depedprototype/depedprot/regional_profiles/${region}`,
      limitations: [
        "Firebase infrastructure, staff, technology, and environmental observations are regional aggregates, mostly for SY 2023-2024.",
        "Internet counts represent school-level offerings by education stage, not unique schools or verified Wi-Fi reliability.",
        "Device counts do not establish whether equipment is functional, current, or individually assigned to learners.",
        "Flood-marker and access-mode records are contextual indicators, not a complete hazard or last-mile classification.",
        "Regional MOOE is an operating allocation and should not be interpreted as classroom construction funding.",
      ],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Migration baseline read failed:", error);
    return NextResponse.json({ error: "Could not read regional STEEP baselines. Check Firebase Admin credentials and database access." }, { status: 503 });
  }
}
