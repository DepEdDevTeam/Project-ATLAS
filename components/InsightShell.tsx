import type { ReactNode } from "react";
import AtlasNav from "./AtlasNav";

export default function InsightShell({ title, description, children, aside }: { title: string; description: string; children: ReactNode; aside?: ReactNode }) {
  return <main className="insight-shell"><AtlasNav /><header className="insight-heading"><div><h1>{title}</h1><p>{description}</p></div>{aside}</header>{children}</main>;
}
