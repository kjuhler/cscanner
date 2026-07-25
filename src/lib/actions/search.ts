"use server";

import { redirect } from "next/navigation";
import { resolveSteamId } from "@/lib/steam";

export type SearchState = {
  error?: string;
};

export async function searchPlayer(
  _prev: SearchState,
  formData: FormData,
): Promise<SearchState> {
  const raw = String(formData.get("query") ?? "").trim();
  if (!raw) {
    return { error: "Enter a Steam ID, profile URL, or vanity name." };
  }

  let steamId: string | null = null;

  try {
    steamId = await resolveSteamId(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lookup failed.";
    if (message.includes("STEAM_API_KEY")) {
      return {
        error:
          "Steam API key is missing. Add STEAM_API_KEY to your .env.local file.",
      };
    }
    return { error: message };
  }

  if (!steamId) {
    return {
      error: "Could not resolve that Steam profile. Check the ID or URL.",
    };
  }

  redirect(`/profiles/${steamId}`);
}
