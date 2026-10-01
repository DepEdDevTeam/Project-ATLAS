import DataSourcesTable from "@/components/DataSourcesTable";
import DatasetBuilder from "@/components/DatasetBuilder";
import InsightShell from "@/components/InsightShell";
import SteepIndex from "@/components/SteepIndex";

export default function DataExplorerPage() { return <InsightShell title="Data Explorer" description="Search official and mirrored records, then assemble a compatible analytical view without loading every record at once."><SteepIndex /><DatasetBuilder /><section className="source-library"><DataSourcesTable /></section></InsightShell>; }
