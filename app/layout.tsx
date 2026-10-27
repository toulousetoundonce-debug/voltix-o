import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";
import "./fx.css";
import "./fx-cards.css";
import { SITE } from "@/lib/site";
import GraphicSignature from "@/components/GraphicSignature";

const TITLE = "Voltix Dynamics | الكهرباء الصناعية، المنازل الذكية وأنظمة المراقبة";
const DESCRIPTION =
  "Voltix Dynamics: تركيبات كهربائية صناعية وتجارية، منازل ذكية بتحكم محلي يعمل بدون إنترنت، وأنظمة مراقبة CCTV وأمان شبكي، وفق معايير NF C 15-100 وبدعم طوارئ على مدار الساعة.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: TITLE, template: "%s | Voltix Dynamics" },
  description: DESCRIPTION,
  applicationName: SITE.name,
  keywords: [
    "Voltix Dynamics",
    "كهرباء صناعية",
    "لوحات تحكم كهربائية",
    "Armoire Électrique",
    "منزل ذكي",
    "Home Assistant",
    "تحكم محلي",
    "كاميرات مراقبة",
    "CCTV",
    "NF C 15-100",
    "صيانة كهربائية",
    "طوارئ كهربائية",
  ],
  authors: [{ name: SITE.name }],
  creator: SITE.name,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ar_AR",
    url: "/",
    siteName: SITE.name,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#090D16",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": ["ProfessionalService", "Electrician"],
  "@id": `${SITE.url}/#organization`,
  name: SITE.name,
  url: SITE.url,
  description: DESCRIPTION,
  inLanguage: "ar",
  availableLanguage: "Arabic",
  ...(SITE.phone ? { telephone: SITE.phone } : {}),
  ...(SITE.email ? { email: SITE.email } : {}),
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    opens: "00:00",
    closes: "23:59",
  },
  knowsAbout: [
    "Industrial electrical installation",
    "Electrical control panels",
    "Local-control smart homes",
    "CCTV and network security",
    "NF C 15-100",
  ],
  makesOffer: [
    "المنازل الذكية والأتمتة",
    "الكهرباء الصناعية ولوحات التحكم",
    "الأنظمة الأمنية والشبكات (CCTV)",
    "الصيانة الوقائية والتشخيص المنهجي",
  ].map((name) => ({
    "@type": "Offer",
    itemOffered: { "@type": "Service", name },
  })),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-fx="on" suppressHydrationWarning>
      <head>
        <Script id="voltix-theme-init" strategy="beforeInteractive">
          {`(() => {
            let savedTheme = null;
            try {
              savedTheme = localStorage.getItem("voltix-theme");
            } catch {}
            const theme = savedTheme === "light" || savedTheme === "dark"
              ? savedTheme
              : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
            const root = document.documentElement;
            root.classList.toggle("light", theme === "light");
            root.classList.toggle("dark", theme === "dark");
            root.style.colorScheme = theme;
          })();`}
        </Script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen bg-page-bg font-cairo text-slate-200 antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:right-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-electric-blue focus:px-4 focus:py-2 focus:font-bold focus:text-grid-dark"
        >
          تخطي إلى المحتوى الرئيسي
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        <GraphicSignature />
        {children}
      </body>
    </html>
  );
}
