/**
 * Writes PNG previews to public/og/ using the same @vercel/og layout as opengraph-image routes.
 * Run: npm run generate:og
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { churchOgImageResponse } from "../src/lib/og/church-og";

const OUT = join(process.cwd(), "public", "og");

const VARIANTS: Array<{ file: string; props: Parameters<typeof churchOgImageResponse>[0] }> = [
  {
    file: "home.png",
    props: {
      headline: "Search the message",
      subheadline: "Sermon discovery for your church — scripture, topics, and faithful teaching.",
    },
  },
  {
    file: "search.png",
    props: {
      headline: "Search the archive",
      subheadline: "Find sermons by scripture reference, topic, speaker, series, and date.",
    },
  },
  {
    file: "ask.png",
    props: {
      headline: "Ask about the teaching",
      subheadline:
        "Guided help for questions of faith — pair with Search for scripture and transcripts.",
    },
  },
  {
    file: "login.png",
    props: {
      headline: "Welcome back",
      subheadline: "Secure sign-in for church staff and administrators.",
    },
  },
  {
    file: "admin.png",
    props: {
      headline: "Sermon administration",
      subheadline: "Import, curate, and manage your congregation’s searchable sermon library.",
    },
  },
  {
    file: "admin-sermons.png",
    props: {
      headline: "All sermons",
      subheadline: "View, edit, and curate every message in your searchable library.",
    },
  },
  {
    file: "sermon-sample.png",
    props: {
      headline: "The True Revelation of Ezekiel’s Temple",
      subheadline: "Sermon teaching from your church archive",
      foot: "Shane Vaughn · January 1, 2026",
    },
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });

  for (const { file, props } of VARIANTS) {
    const res = churchOgImageResponse(props);
    const buf = Buffer.from(await res.arrayBuffer());
    const dest = join(OUT, file);
    await writeFile(dest, buf);
    console.log("Wrote", dest, `(${(buf.length / 1024).toFixed(1)} KB)`);
  }

  console.log(`\nDone. ${VARIANTS.length} PNGs in public/og/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
