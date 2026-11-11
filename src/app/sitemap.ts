import type { MetadataRoute } from "next";
import { listArtists } from "@/lib/queries";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }> = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/discover", priority: 0.9, changeFrequency: "daily" },
  { path: "/activity", priority: 0.6, changeFrequency: "daily" },
  { path: "/how-it-works", priority: 0.7, changeFrequency: "monthly" },
  { path: "/login", priority: 0.4, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const artists = await listArtists(500);
    for (const artist of artists) {
      entries.push({
        url: absoluteUrl(`/artist/${encodeURIComponent(artist.id)}`),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  } catch {
    // A database outage must not take the sitemap down; static routes still ship.
  }

  return entries;
}
