import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const word = searchParams.get("format") === "docx";
    const root = process.cwd();
    const runs = path.join(root, "data", "migration-runs");
    const folders = (await readdir(runs, { withFileTypes: true })).filter(item => item.isDirectory()).map(item => item.name).sort().reverse();
    let latestReportPath = "";
    let latestRun = "";
    for (const folder of folders) {
      try {
        latestReportPath = path.join(runs, folder, "report.md");
        await readFile(latestReportPath, "utf8");
        latestRun = folder;
        break;
      } catch { /* Continue past incomplete output folders. */ }
    }
    if (!latestReportPath) return NextResponse.json({ error: "The migration report file is not available." }, { status: 404 });
    const filePath = word ? path.join(root, "output", "docx", "ATLAS-multiple-study-migration-report.docx") : latestReportPath;
    const content = await readFile(filePath);
    if (word) {
      const [docxInfo, reportInfo] = await Promise.all([stat(filePath), stat(latestReportPath)]);
      if (docxInfo.mtimeMs < reportInfo.mtimeMs) return NextResponse.json({ error: "The Word copy is older than the latest report. Rebuild the Word document to download a matching copy." }, { status: 409 });
    }
    return new NextResponse(content, { headers: {
      "Content-Type": word ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${word ? "ATLAS-multiple-study-migration-report.docx" : `ATLAS-migration-${latestRun}.md`}"`,
      "Cache-Control": "no-store",
    } });
  } catch {
    return NextResponse.json({ error: "Could not load the migration report." }, { status: 500 });
  }
}
