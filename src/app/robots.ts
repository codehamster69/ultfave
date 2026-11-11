import type { MetadataRoute } from "next";
import { SITE_URL, absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  // Until a real origin is configured, keep the site out of every index.
  if (!SITE_URL || process.env.NEXT_PUBLIC_ALLOW_INDEXING === "false") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/card/"],
        disallow: ["/api/", "/me", "/friends", "/settings", "/welcome"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
