import ScenarioLab from "@/components/scenario-lab/ScenarioLab";
import { Suspense } from "react";
import { ScenarioLabSkeleton } from "@/components/Skeleton";
export default function ScenarioLabPage(){return <Suspense fallback={<ScenarioLabSkeleton/>}><ScenarioLab/></Suspense>}
