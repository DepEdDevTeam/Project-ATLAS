import { Skeleton, SourceTableSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return <main className="about-page"><div className="skeleton-topbar"><span className="skeleton-brand" /></div><div className="about-columns about-loading"><section><Skeleton width="48%" height="46px" /><Skeleton width="68%" height="13px" /><Skeleton className="skeleton-network" /></section><section><Skeleton width="35%" height="30px" /><Skeleton width="72%" height="12px" /><div className="skeleton-tabs"><Skeleton /><Skeleton /><Skeleton /></div><SourceTableSkeleton /></section></div></main>;
}
