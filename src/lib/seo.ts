import type { Metadata } from "next";

/**
 * One source of truth for the public name, copy and canonical origin.
 * NEXT_PUBLIC_APP_URL must be set to the real launch origin; without it we
 * fall back to the local dev origin rather than inventing a domain.
 */
const RAW_APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";

function normalizeOrigin(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export const SITE_NAME = "Ultfave";
export const SITE_TAGLINE = "Everyone has an ult fave. Prove it.";
export const SITE_DESCRIPTION =
  "Fan leaderboards for Spotify listeners. Earn points for listening minutes, distinct tracks and streaks, then climb weekly, monthly and yearly boards for the artists you love.";
export const SITE_LOCALE = "en_US";
export const SITE_URL = normalizeOrigin(RAW_APP_URL);
const FALLBACK_ORIGIN = "http://127.0.0.1:3000";

export function absoluteUrl(path = "/"): string {
  const base = SITE_URL ?? FALLBACK_ORIGIN;
  return new URL(path, `${base}/`).toString();
}

type PageMetaInput = {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article" | "profile";
  noIndex?: boolean;
  images?: string[];
};

export function pageMetadata({
  title,
  description,
  path,
  type = "website",
  noIndex = false,
  images,
}: PageMetaInput): Metadata {
  const url = absoluteUrl(path);
  const imageList = images && images.length > 0 ? images.map((src) => absoluteUrl(src)) : [absoluteUrl("/opengraph-image")];

  return {
    title,
    description,
    alternates: SITE_URL ? { canonical: url } : undefined,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type,
      locale: SITE_LOCALE,
      images: imageList.map((image) => ({ url: image, width: 1200, height: 630, alt: title })),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageList,
    },
    robots: noIndex ? { index: false, follow: false } : undefined,
  };
}

/** Escape `<` so data can never close the JSON-LD script tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${absoluteUrl("/")}#org`,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/brand/app-icon.svg"),
    description: SITE_DESCRIPTION,
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${absoluteUrl("/")}#site`,
    name: SITE_NAME,
    alternateName: "Ult Fave",
    url: absoluteUrl("/"),
    publisher: { "@id": `${absoluteUrl("/")}#org` },
    inLanguage: "en",
  };
}

export function softwareApplicationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "MusicApplication",
    applicationSubCategory: "SocialNetworkingApplication",
    operatingSystem: "Web",
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
    featureList: [
      "Artist fan leaderboards",
      "Weekly, monthly and yearly rankings",
      "Listening streaks",
      "Fan badges",
      "Weekly challenges",
      "Shareable fan cards",
    ],
    publisher: { "@id": `${absoluteUrl("/")}#org` },
  };
}

export type FaqItem = { question: string; answer: string };

export function faqPageLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function breadcrumbLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
