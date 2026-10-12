export function mapNationalProfile(raw: Record<string, unknown>, aggregate: Record<string, unknown> = {}): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const stage of ['es', 'jhs', 'shs']) {
    result[`schools_with_${stage}_2324`] = raw[`sch_2324_offers_${stage}`];
    result[`wash_2324_${stage}_has_internet`] = raw[`wash_2324_${stage}_has_internet`];
    result[`fac_2324_classrooms_instructional_${stage}`] = aggregate[`classrooms_instructional_${stage}_2324`];
  }
  for (const stage of ['es', 'hs']) {
    result[`fac_2324_${stage}_accessible_walking_hiking`] = raw[`fac_2324_${stage}_accessible_walking_hiking`];
    result[`fac_2324_${stage}_has_flood_marker`] = raw[`fac_2324_${stage}_has_flood_marker`];
  }
  const minor = raw.res_buildings_needs_minor_repair;
  const major = raw.res_buildings_needs_major_repair;
  result.fac_2324_buildings_needing_repair = typeof minor === 'number' && typeof major === 'number' && Number.isFinite(minor) && Number.isFinite(major) && minor >= 0 && major >= 0 ? minor + major : null;
  // No total-classroom or equipment-category proxy becomes a usable inventory.
  result.usable_classrooms_total_2324 = raw.usable_classrooms_total_2324;
  result.ict_academic_devices_2324 = raw.ict_academic_devices_2324;
  return result;
}
