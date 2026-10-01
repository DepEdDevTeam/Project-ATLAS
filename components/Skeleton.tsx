import type { CSSProperties } from "react";

type SkeletonProps = {
  className?: string;
  width?: string;
  height?: string;
};

export function Skeleton({ className = "", width, height }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton ${className}`.trim()}
      style={{ "--skeleton-width": width, "--skeleton-height": height } as CSSProperties}
    />
  );
}

export function ScenarioLabSkeleton() {
  return (
    <div className="skeleton-workspace" aria-busy="true" aria-label="Loading scenario data">
      <p className="sr-only" role="status">Loading enrollment records and scenario workspace…</p>
      <section className="panel skeleton-controls">
        <Skeleton width="44%" height="22px" />
        <Skeleton width="78%" height="10px" />
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="skeleton-control" />)}
        <Skeleton className="skeleton-control" />
      </section>
      <section className="panel skeleton-outlook">
        <div className="skeleton-heading-row"><div><Skeleton width="190px" height="22px" /><Skeleton width="130px" height="10px" /></div><Skeleton width="118px" height="34px" /></div>
        <Skeleton className="skeleton-map" />
        <div className="skeleton-chart-lines"><Skeleton /><Skeleton /><Skeleton /></div>
      </section>
      <aside className="skeleton-impact">
        {[0, 1].map((panel) => <section className="panel skeleton-side-panel" key={panel}><Skeleton width="55%" height="18px" />{[0, 1, 2, 3].map((row) => <div key={row}><Skeleton width="58%" height="10px" /><Skeleton width="25%" height="14px" /></div>)}</section>)}
      </aside>
    </div>
  );
}

export function SourceTableSkeleton() {
  return (
    <div className="source-table-skeleton" aria-busy="true">
      <p className="sr-only" role="status">Loading source data…</p>
      <div className="source-skeleton-head">{[22, 31, 19, 28].map((width, index) => <Skeleton key={index} width={`${width}%`} height="11px" />)}</div>
      {[0, 1, 2, 3, 4, 5].map((row) => <div className="source-skeleton-row" key={row}>{[24, 36, 18, 25].map((width, index) => <Skeleton key={index} width={`${width}%`} height="10px" />)}</div>)}
    </div>
  );
}
