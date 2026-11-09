import { NextResponse } from "next/server";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Keep report logs small; the interesting fields are the blocked directive/uri. */
type CspReport = {
  "csp-report"?: {
    "document-uri"?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "blocked-uri"?: string;
    "script-sample"?: string;
  };
};

/**
 * Collects Content-Security-Policy violation reports while the policy is in
 * Report-Only mode. Unauthenticated by design (browsers send these with no
 * credentials) but rate-limited per IP so it cannot be used to flood logs.
 * Always answers 204 so the browser does not retry.
 */
export async function POST(req: Request) {
  const noContent = new NextResponse(null, { status: 204 });

  try {
    const allowed = await consumeRateLimit(`csp-report:${requestIp(req)}`, 60, 3600);
    if (!allowed) return noContent;
  } catch {
    // Rate-limit backend is best-effort for a telemetry endpoint.
    return noContent;
  }

  let body: CspReport | null = null;
  try {
    body = (await req.json()) as CspReport;
  } catch {
    return noContent;
  }

  const report = body?.["csp-report"];
  if (report) {
    console.warn("csp-violation", {
      directive: report["effective-directive"] ?? report["violated-directive"] ?? "",
      blocked: report["blocked-uri"] ?? "",
      documentUri: report["document-uri"] ?? "",
      sample: (report["script-sample"] ?? "").slice(0, 120),
    });
  }

  return noContent;
}
