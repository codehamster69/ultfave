/**
 * Next config: static security headers + image allow-list.
 *
 * The Content-Security-Policy itself is emitted by src/middleware.ts (it needs
 * the dev/prod request mode and lives next to the cross-site guard). Everything
 * below applies to every response, including API routes and /api/card images.
 */
const isProduction = process.env.NODE_ENV === "production";

const securityHeaders = [
  // Stop MIME sniffing of JSON/OG-image responses.
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Frame protection for browsers that ignore CSP frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()",
  },
  // Isolate the browsing context group; no popups are used for auth.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // HSTS only makes sense behind TLS; localhost/http deployments must not send it.
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets the E2E/verification build run without clobbering a live `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "mosaic.scdn.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
