import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

export default function SermonNotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Sermon not found</h1>
      <p className="mt-2 text-muted-foreground">This sermon may have been removed or the link is invalid.</p>
      <Link href="/search" className={cn(buttonVariants(), "mt-6")}>
        Back to search
      </Link>
    </div>
  );
}
