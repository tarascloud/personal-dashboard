import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { withSerwist } from "@serwist/turbopack";

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["pdf-parse"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // 'unsafe-inline' required for Next.js hydration scripts (__NEXT_DATA__, RSC payload).
          // Removing it broke client-side rendering: login buttons dead, dashboards stuck on skeleton.
          // Proper fix = nonce-based CSP via middleware (https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
          // but that needs per-request nonce generation. Tracked as follow-up.
          // 'unsafe-eval' was removed — Recharts ESM build does not require it.
          // 'unsafe-inline' in style-src is still needed for Tailwind/styled-jsx.
          // JSON-LD <script type="application/ld+json"> is not executable — CSP does not apply.
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com; font-src 'self' data:; connect-src 'self' https://generativelanguage.googleapis.com https://api.groq.com https://*.google.com https://*.googleapis.com https://*.google-analytics.com https://*.googletagmanager.com; frame-ancestors 'none';" },
        ],
      },
    ];
  },
};

export default withSerwist(withNextIntl(nextConfig));
