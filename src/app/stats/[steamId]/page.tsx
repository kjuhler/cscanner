import { redirect } from "next/navigation";
import { isSteamId64 } from "@/lib/steam";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ steamId: string }>;
};

/** Legacy /stats/:id → canonical Steam-style /profiles/:id */
export default async function StatsRedirectPage({ params }: PageProps) {
  const { steamId } = await params;
  if (!isSteamId64(steamId)) notFound();
  redirect(`/profiles/${steamId}`);
}
