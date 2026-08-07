import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolveSteamId } from "@/lib/steam";

type PageProps = {
  params: Promise<{ vanity: string }>;
  searchParams: Promise<{ r?: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { vanity } = await params;
  return {
    title: vanity,
    description: `CS2 stats and cheat risk signals for Steam vanity ${vanity}`,
  };
}

/**
 * Steam-compatible vanity path: /id/{vanity}
 * Resolves to SteamID64 and redirects to /profiles/{steamId}.
 */
export default async function IdVanityPage({ params, searchParams }: PageProps) {
  const { vanity } = await params;
  const resolvedSearchParams = await searchParams;
  const decoded = decodeURIComponent(vanity).trim();
  if (!decoded) notFound();

  let steamId: string | null = null;
  try {
    steamId = await resolveSteamId(decoded);
  } catch {
    notFound();
  }

  if (!steamId) notFound();
  const qs = resolvedSearchParams.r === "1" ? "?r=1" : "";
  redirect(`/profiles/${steamId}${qs}`);
}
