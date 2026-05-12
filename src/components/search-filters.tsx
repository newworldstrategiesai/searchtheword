import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SearchFiltersProps = {
  q: string;
  mode: string;
  preacher: string;
  series: string;
  documentType: string;
  from: string;
  to: string;
};

/** GET form to /search preserving query, mode, and filters. */
export function SearchFilters({
  q,
  mode,
  preacher,
  series,
  documentType,
  from,
  to,
}: SearchFiltersProps) {
  return (
    <form method="get" action="/search" className="space-y-4 rounded-lg border border-border bg-card p-4">
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="mode" value={mode} />
      <p className="text-base font-medium">Refine results</p>
      <div className="space-y-2">
        <Label htmlFor="preacher">Speaker / preacher</Label>
        <Input
          id="preacher"
          name="preacher"
          defaultValue={preacher}
          placeholder="Name contains…"
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="series">Series</Label>
        <Input id="series" name="series" defaultValue={series} placeholder="Series contains…" autoComplete="off" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="document_type">Document type</Label>
        <Input
          id="document_type"
          name="document_type"
          defaultValue={documentType}
          placeholder="e.g. Sermon, Article"
          autoComplete="off"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={to} />
        </div>
      </div>
      <Button type="submit" size="sm" className="w-full">
        Apply filters
      </Button>
    </form>
  );
}
