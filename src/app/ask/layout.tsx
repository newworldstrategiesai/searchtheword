import type { Metadata } from "next";
import { STATIC_OG, staticOgImage } from "@/lib/seo";

const desc =
  "Ask questions about faith and where to find teaching in your church’s sermon archive — use alongside Search for scripture and transcripts.";

export const metadata: Metadata = {
  title: "Ask",
  description: desc,
  alternates: {
    canonical: "/ask",
  },
  openGraph: {
    title: "Ask about the teaching · SearchTheWord",
    description: desc,
    url: "/ask",
    images: [staticOgImage(STATIC_OG.ask)],
  },
  twitter: {
    title: "Ask about the teaching · SearchTheWord",
    description: desc,
    images: [STATIC_OG.ask],
  },
};

export default function AskLayout({ children }: { children: React.ReactNode }) {
  return children;
}
