import type { Levers, Outcomes } from "./scenario-types";

/** Explain adjacent engine states; room capacity is distinct from enrollment. */
export function explainScenario(to: Outcomes, from: Outcomes, levers: Levers) {
  const added = to.addedRooms - from.addedRooms;
  const restored = to.restoredRooms - from.restoredRooms;
  const upgraded = to.upgradedRooms - from.upgradedRooms;
  const places = (added + restored) * levers.pupilsPerRoom;
  const fundingChange = to.availableBudget - from.availableBudget;
  const enrollmentChange = to.enrollment - from.enrollment;
  const gapChange = to.remainingGap === null || from.remainingGap === null
    ? null : to.remainingGap - from.remainingGap;
  const n = (value: number) => value.toLocaleString("en-PH", { maximumFractionDigits: 2 });
  let reason = places > 0
    ? `Funding delivers ${n(added)} new, expansion or annex rooms and restores ${n(restored)} rooms this year, adding ${n(places)} estimated learner places at ${n(levers.pupilsPerRoom)} learners per room.`
    : to.availableBudget === 0
      ? "No eligible funding this year, so no additional classroom places are created."
      : "Eligible funding creates no additional classroom places this year: requests, budget shares, costs and repair eligibility determine what can be delivered.";
  if (upgraded > 0) reason += ` ${n(upgraded)} resilience upgrades improve existing rooms without adding places.`;
  if (gapChange !== null && gapChange > 0) reason += " Enrollment demand grows faster than usable rooms, so the classroom gap widens.";
  if (gapChange !== null && gapChange < 0) reason += " The classroom gap narrows as usable rooms increase or enrollment demand falls.";
  if (to.availableRooms === null) reason += " Total capacity and the classroom gap remain unknown until an inventory is supplied.";
  return { added, restored, upgraded, places, fundingChange, enrollmentChange, gapChange, reason };
}

