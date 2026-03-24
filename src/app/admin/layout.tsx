import type { Metadata } from "next";
import { STATIC_OG, staticOgImage } from "@/lib/seo";

const desc =
  "Upload sermon spreadsheets, manage imports, and keep your church’s message archive searchable for members and visitors.";

export const metadata: Metadata = {
  title: "Admin",
  description: desc,
  alternates: {
    canonical: "/admin",
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Sermon administration · SearchTheWord",
    description: desc,
    url: "/admin",
    images: [staticOgImage(STATIC_OG.admin)],
  },
  twitter: {
    title: "Sermon administration · SearchTheWord",
    description: desc,
    images: [STATIC_OG.admin],
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
