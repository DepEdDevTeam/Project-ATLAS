import DataSourcesTable from "@/components/DataSourcesTable";
import InsightShell from "@/components/InsightShell";

export default function ProjectsBudgetsPage() { return <InsightShell title="Projects & Budgets" description="Trace enacted appropriations, proposed budgets, programs, line items and public-project delivery from BetterGov."><section className="module-note"><strong>How to read public-finance records</strong><p>An appropriation is authority to spend, not proof that money was released or a project was completed. Compare budget, payment and progress only where the source supplies each field.</p></section><section className="source-library budget-library"><DataSourcesTable initialOwner="budget" /></section></InsightShell>; }
