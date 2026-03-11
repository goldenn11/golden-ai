import { NextResponse } from "next/server";

const GHL_BASE = "https://services.leadconnectorhq.com";
const LOCATION_ID = "sFHDHA526t38tSU2MZPt";

function ghlHeaders(): Record<string, string> {
  const key = process.env.GHL_API_KEY;
  if (!key) throw new Error("GHL_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    Version: "2021-07-28",
    Accept: "application/json",
  };
}

export async function GET() {
  try {
    const headers = ghlHeaders();

    const [contactsRes, pipelinesRes] = await Promise.all([
      fetch(`${GHL_BASE}/contacts/?locationId=${LOCATION_ID}&limit=100`, { headers }),
      fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${LOCATION_ID}`, { headers }),
    ]);

    if (!contactsRes.ok) {
      const text = await contactsRes.text();
      console.error("GHL contacts error:", contactsRes.status, text);
      return NextResponse.json({ error: "Failed to fetch contacts" }, { status: contactsRes.status });
    }

    if (!pipelinesRes.ok) {
      const text = await pipelinesRes.text();
      console.error("GHL pipelines error:", pipelinesRes.status, text);
      return NextResponse.json({ error: "Failed to fetch pipelines" }, { status: pipelinesRes.status });
    }

    const contactsData = await contactsRes.json();
    const pipelinesData = await pipelinesRes.json();

    // Build a stage lookup from pipeline data
    const stageLookup: Record<string, string> = {};
    const pipelines = pipelinesData.pipelines ?? [];
    for (const pipeline of pipelines) {
      for (const stage of pipeline.stages ?? []) {
        stageLookup[stage.id] = stage.name;
      }
    }

    const contacts = (contactsData.contacts ?? []).map((c: Record<string, unknown>) => ({
      id: c.id,
      name: [c.firstNameLowerCase ?? c.firstName ?? c.name, c.lastNameLowerCase ?? c.lastName].filter(Boolean).join(" ") || c.email || "Unknown",
      company: c.companyName ?? null,
      source: c.source ?? null,
      stage: c.pipelineStageId ? (stageLookup[c.pipelineStageId as string] ?? c.pipelineStageId) : null,
      dateAdded: c.dateAdded ?? c.createdAt ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
    }));

    return NextResponse.json({ contacts, pipelines, stageLookup });
  } catch (err) {
    console.error("GHL pipeline API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
