import { areas, enrollmentData } from "@/lib/enrollment-store";
import { LEVELS, type Level } from "@/lib/enrollment-types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const level = (p.get("level") || "national") as Level;
  const sector = p.get("sector") || "All";
  const year = p.has("year") ? Number(p.get("year")) : undefined;
  if (year !== undefined && (!Number.isInteger(year) || year < 2017 || year > 2025)) return Response.json({ error: "Invalid source year" }, { status: 400 });
  if (!LEVELS.includes(level) || !["All", "Public", "Private", "Sucslucs", "PSO", "Pso"].includes(sector)) return Response.json({ error: "Invalid level or sector" }, { status: 400 });
  try {
    const data = p.get("view") === "areas" ? areas(level, (p.get("q") || "").slice(0, 150), sector) : enrollmentData({ level, key: p.get("key") || "[]", sector },year);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unknown error";
    if (/Invalid area|JSON/.test(message)) return Response.json({ error: "Select a valid area." }, { status: 400 });
    console.error("Enrollment query failed:", message);
    return Response.json({ error: "Enrollment data unavailable. Run the local data import described in README, then retry." }, { status: 503 });
  }
}
