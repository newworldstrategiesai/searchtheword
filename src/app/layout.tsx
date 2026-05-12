import type { Metadata } from "next";
import { Cormorant_Garamond, Geist_Mono, Source_Sans_3 } from "next/font/google";
import "../../styles/globals.css";
import { AskAssistantWidget } from "@/components/ask-assistant-widget";
import { Header } from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import { CHURCH_SEO_KEYWORDS, getMetadataBase, STATIC_OG, staticOgImage } from "@/lib/seo";

const fontBody = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const fontHeading = Cormorant_Garamond({
  variable: "--font-heading-stack",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteDescription =
  "Search and explore your church’s sermon archive by scripture, topic, speaker, or keyword — faithful teaching made discoverable for your congregation.";

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "SearchTheWord",
    template: "%s · SearchTheWord",
  },
  description: siteDescription,
  applicationName: "SearchTheWord",
  authors: [{ name: "SearchTheWord" }],
  keywords: [...CHURCH_SEO_KEYWORDS],
  creator: "SearchTheWord",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "SearchTheWord",
    title: "SearchTheWord — Sermon search for your church",
    description: siteDescription,
    images: [staticOgImage(STATIC_OG.home)],
  },
  twitter: {
    card: "summary_large_image",
    title: "SearchTheWord — Sermon search for your church",
    description: siteDescription,
    images: [STATIC_OG.home],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
  category: "religion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${fontBody.variable} ${fontHeading.variable} ${geistMono.variable} flex min-h-full flex-col font-sans antialiased`}
      >
        <ThemeProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border/60 bg-muted/20 py-10 text-center">
            <div className="mx-auto max-w-5xl px-4">
              <p className="font-heading text-base font-semibold tracking-wide text-foreground">
                SearchTheWord
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sermon discovery for your church — search scripture, topics, and transcripts.
              </p>
            </div>
          </footer>
          <AskAssistantWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
