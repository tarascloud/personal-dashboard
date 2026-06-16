import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SerwistProvider } from "./serwist";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

// DES-20260507-0003: locale-aware metadata. Static metadata.openGraph.locale
// was hardcoded en_US even though next-intl serves uk content based on cookie.
// Switching to generateMetadata + getLocale aligns og:locale with html lang.
const ogLocaleMap: Record<string, string> = {
  uk: 'uk_UA',
  en: 'en_US',
  ru: 'ru_RU',
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const ogLocale = ogLocaleMap[locale] ?? 'en_US';
  // DEV-20260512-0011: title/description must match <html lang>. Previously
  // static English copy was served regardless of locale cookie, so a uk
  // visitor saw lang="uk" but English meta tags — fails SEO locale signals.
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const localizedTitle = tSeo("title");
  const localizedDescription = tSeo("description");
  return {
    title: {
      default: localizedTitle,
      template: "%s | Personal Dashboard",
    },
    description: localizedDescription,
    keywords: [
      "personal dashboard",
      "self-hosted",
      "open source",
      "finance tracker",
      "health dashboard",
      "gym tracker",
      "investment portfolio",
      "tax reporting",
      "privacy-first",
      "PWA",
      "next.js",
    ],
    metadataBase: new URL("https://pd.taras.cloud"),
    // SMM-20260610-0001 (supersedes REV-20260512-015): same-URL hreflang map
    // removed — PD serves all locales (en, uk, es) on one URL via cookie-based
    // negotiation, so per-locale alternates pointing to the same URL are
    // invalid and ignored by Google. Re-add languages{} only if per-locale
    // routes (/en, /uk, /es) ever appear.
    alternates: {
      canonical: "https://pd.taras.cloud",
    },
    openGraph: {
      type: "website",
      url: "https://pd.taras.cloud",
      title: localizedTitle,
      description: localizedDescription,
      siteName: "Personal Dashboard",
      // opengraph-image.tsx auto-generates OG image via Next.js App Router convention
      locale: ogLocale,
    },
    twitter: {
      card: "summary_large_image",
      site: "@taaboroda",
      creator: "@taaboroda",
      title: localizedTitle,
      description: localizedDescription,
      // opengraph-image.tsx auto-generates OG image via Next.js App Router convention
    },
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/PD.png",
      shortcut: "/PD.png",
      apple: "/icons/icon-192x192.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "PD",
    },
    other: {
      "mobile-web-app-capable": "yes",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const cookieStore = await cookies();
  const skin = cookieStore.get("skin")?.value;

  return (
    <html lang={locale} suppressHydrationWarning {...(skin && skin !== "easy" ? { "data-skin": skin } : {})}>
      <head>
        <meta name="theme-color" content="#0a0a0a" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Personal Dashboard",
              applicationCategory: "LifestyleApplication",
              operatingSystem: "Web",
              description:
                "Open-source, self-hosted dashboard for finance, health, gym, investments, and tax reporting.",
              url: "https://pd.taras.cloud",
              author: {
                "@type": "Person",
                name: "Taras Pedchenko",
                url: "https://taras.cloud",
              },
              license: "https://www.gnu.org/licenses/agpl-3.0.html",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              screenshot: "https://pd.taras.cloud/og-image.png",
              softwareVersion: "1.0",
              applicationSubCategory: "Personal Finance, Health Tracking",
            }).replace(/</g, "\\u003c"),
          }}
        />
        {/* REV-20260512-015: WebSite entity exposes sitelink search box and
            canonical site name to Google. Distinct from SoftwareApplication
            above which describes the product itself. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Personal Dashboard",
              url: "https://pd.taras.cloud",
              inLanguage: ["en", "uk", "es"],
              publisher: {
                "@type": "Person",
                name: "Taras Pedchenko",
                url: "https://taras.cloud",
              },
              potentialAction: {
                "@type": "SearchAction",
                target: "https://pd.taras.cloud/search?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }).replace(/</g, "\\u003c"),
          }}
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        {/* Google Analytics — loaded via next/script to avoid unsafe-inline in CSP */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-P8B1BXG40X"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-P8B1BXG40X');`}
        </Script>
      </head>
      <body
        className={`${inter.variable} ${inter.className} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none"
        >
          Skip to content
        </a>
        <SerwistProvider swUrl="/serwist/sw.js">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <NextIntlClientProvider messages={messages}>
              {children}
              <Toaster />
            </NextIntlClientProvider>
          </ThemeProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
