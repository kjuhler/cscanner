import { NextResponse } from "next/server";
import {
  isSteamGcEnabled,
  isValidShareCodeFormat,
} from "@/lib/demo/shareCode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Direct share-code → GC fetch → analyze (no queue/Redis needed). */
export async function POST(request: Request) {
  try {
    if (!isSteamGcEnabled()) {
      return NextResponse.json(
        {
          error:
            "Share-code demo fetch is not enabled. Set STEAM_GC_ENABLED=true on the web service and STEAM_REFRESH_TOKEN on the analyze worker.",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { shareCode?: string };
    const raw = String(body.shareCode ?? "");
    if (!raw.trim()) {
      return NextResponse.json(
        { error: "Missing shareCode." },
        { status: 400 },
      );
    }
    if (!isValidShareCodeFormat(raw)) {
      return NextResponse.json(
        {
          error:
            "Invalid match sharing code. Expected CSGO-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX.",
        },
        { status: 400 },
      );
    }

    const { analyzeFromShareCode } = await import(
      "@/lib/demo/runAnalyzeShareCodeJob"
    );
    const result = await analyzeFromShareCode({ shareCode: raw });
    return NextResponse.json({ result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to analyze share code.";
    console.error("[upload-demo/from-share-code]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Feature flag for the demo UI. */
export async function GET() {
  return NextResponse.json({
    enabled: isSteamGcEnabled(),
  });
}
