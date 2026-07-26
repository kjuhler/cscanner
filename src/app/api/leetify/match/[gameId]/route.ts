import { NextResponse } from "next/server";
import {
  getLeetifyMatch,
  isLeetifyGameId,
} from "@/lib/leetify/match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fetch full Leetify lobby stats for a match game ID. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await context.params;
    if (!gameId || !isLeetifyGameId(gameId)) {
      return NextResponse.json(
        { error: "Invalid Leetify game id." },
        { status: 400 },
      );
    }

    const match = await getLeetifyMatch(gameId);
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    return NextResponse.json(match);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load match.";
    console.error("[leetify/match]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
