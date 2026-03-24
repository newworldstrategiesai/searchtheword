import type { Metadata } from "next";
import { Cormorant_Garamond, Geist_Mono, Source_Sans_3 } from "next/font/google";
import "../../styles/globals.css";
import { Header } from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";

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

export const metadata: Metadata = {
  title: {
    default: "SearchTheWord",
    template: "%s · SearchTheWord",
  },
  description: "Search sermons by topic, scripture, or natural language.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontBody.variable} ${fontHeading.variable} ${geistMono.variable} flex min-h-full flex-col font-sans antialiased`}
      >
        <ThemeProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border/60 bg-muted/20 py-10 text-center">
            <div className="mx-auto max-w-5xl px-4">
              <p className="font-heading text-sm font-semibold tracking-wide text-foreground">
                SearchTheWord
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sermon discovery for your church — search scripture, topics, and transcripts.
              </p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
