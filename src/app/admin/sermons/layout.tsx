import type { Metadata } from "next";
import { STATIC_OG, staticOgImage } from "@/lib/seo";

const desc =
  "Master list of every sermon in your library — edit titles, scripture, tags, and metadata for your congregation’s search experience.";

export const metadata: Metadata = {
  title: "All sermons",
  description: desc,
  alternates: {
    canonical: "/admin/sermons",
  },
  openGraph: {
    title: "All sermons — SearchTheWord admin",
    description: desc,
    url: "/admin/sermons",
    images: [staticOgImage(STATIC_OG.adminSermons)],
  },
  twitter: {
    title: "All sermons — SearchTheWord admin",
    description: desc,
    images: [STATIC_OG.adminSermons],
  },
};

export default function AdminSermonsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
