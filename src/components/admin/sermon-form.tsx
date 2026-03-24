"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type SermonFormValues = {
  title: string;
  preacher: string;
  date: string;
  scripture_ref: string;
  summary: string;
  full_text: string;
  media_url: string;
  external_id: string;
  series: string;
  part_number: string;
  document_type: string;
  primary_scripture_raw: string;
  secondary_scriptures_raw: string;
  google_drive_url: string;
  folder: string;
  core_doctrine: string;
  doctrinal_position: string;
  key_claims: string;
  audience: string;
  metadata_confidence: string;
  ai_training_approved: string;
  topics: string;
  keywords: string;
};

export const emptySermonForm = (): SermonFormValues => ({
  title: "",
  preacher: "",
  date: "",
  scripture_ref: "",
  summary: "",
  full_text: "",
  media_url: "",
  external_id: "",
  series: "",
  part_number: "",
  document_type: "",
  primary_scripture_raw: "",
  secondary_scriptures_raw: "",
  google_drive_url: "",
  folder: "",
  core_doctrine: "",
  doctrinal_position: "",
  key_claims: "",
  audience: "",
  metadata_confidence: "",
  ai_training_approved: "",
  topics: "",
  keywords: "",
});

export function recordToSermonForm(s: Record<string, unknown>): SermonFormValues {
  const str = (k: string) => (s[k] == null || s[k] === "" ? "" : String(s[k]));
  const dateRaw = s.date;
  const date =
    dateRaw == null || dateRaw === ""
      ? ""
      : typeof dateRaw === "string"
        ? dateRaw.slice(0, 10)
        : String(dateRaw).slice(0, 10);
  const pn = s.part_number;
  const partNum =
    pn == null || pn === "" ? "" : typeof pn === "number" ? String(pn) : String(pn);

  return {
    title: str("title"),
    preacher: str("preacher"),
    date,
    scripture_ref: str("scripture_ref"),
    summary: str("summary"),
    full_text: str("full_text"),
    media_url: str("media_url"),
    external_id: str("external_id"),
    series: str("series"),
    part_number: partNum,
    document_type: str("document_type"),
    primary_scripture_raw: str("primary_scripture_raw"),
    secondary_scriptures_raw: str("secondary_scriptures_raw"),
    google_drive_url: str("google_drive_url"),
    folder: str("folder"),
    core_doctrine: str("core_doctrine"),
    doctrinal_position: str("doctrinal_position"),
    key_claims: str("key_claims"),
    audience: str("audience"),
    metadata_confidence: str("metadata_confidence"),
    ai_training_approved: str("ai_training_approved"),
    topics: str("topics"),
    keywords: str("keywords"),
  };
}

const textareaClass = cn(
  "min-h-[100px] w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm text-foreground outline-none transition-colors",
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
);

type Props = {
  initial: SermonFormValues;
  onSubmit: (values: SermonFormValues) => Promise<void>;
  submitting: boolean;
  submitLabel: string;
};

export function SermonForm({ initial, onSubmit, submitting, submitLabel }: Props) {
  const [values, setValues] = useState<SermonFormValues>(initial);

  useEffect(() => {
    setValues(initial);
  }, [initial]);

  function set<K extends keyof SermonFormValues>(key: K, v: SermonFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  return (
    <form
      className="space-y-6 pb-6"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(values);
      }}
    >
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Core</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sf-title">Title *</Label>
            <Input id="sf-title" value={values.title} onChange={(e) => set("title", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-preacher">Preacher *</Label>
            <Input id="sf-preacher" value={values.preacher} onChange={(e) => set("preacher", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-date">Date</Label>
            <Input id="sf-date" type="date" value={values.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-external">External ID</Label>
            <Input id="sf-external" value={values.external_id} onChange={(e) => set("external_id", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-series">Series</Label>
            <Input id="sf-series" value={values.series} onChange={(e) => set("series", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-part">Part number</Label>
            <Input
              id="sf-part"
              inputMode="numeric"
              value={values.part_number}
              onChange={(e) => set("part_number", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sf-doctype">Document type</Label>
            <Input id="sf-doctype" value={values.document_type} onChange={(e) => set("document_type", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scripture</h3>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sf-primary">Primary scripture (raw)</Label>
            <Input
              id="sf-primary"
              value={values.primary_scripture_raw}
              onChange={(e) => set("primary_scripture_raw", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-secondary">Secondary scriptures (raw)</Label>
            <textarea
              id="sf-secondary"
              className={cn(textareaClass, "min-h-[72px]")}
              value={values.secondary_scriptures_raw}
              onChange={(e) => set("secondary_scriptures_raw", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-sref">Normalized scripture ref (optional override)</Label>
            <Input
              id="sf-sref"
              value={values.scripture_ref}
              onChange={(e) => set("scripture_ref", e.target.value)}
              placeholder="Filled from primary if empty"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Content</h3>
        <div className="space-y-1.5">
          <Label htmlFor="sf-summary">Summary</Label>
          <textarea
            id="sf-summary"
            className={textareaClass}
            value={values.summary}
            onChange={(e) => set("summary", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sf-full">Full text</Label>
          <textarea
            id="sf-full"
            className={cn(textareaClass, "min-h-[180px]")}
            value={values.full_text}
            onChange={(e) => set("full_text", e.target.value)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Links &amp; tags</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sf-media">Media URL</Label>
            <Input id="sf-media" value={values.media_url} onChange={(e) => set("media_url", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-gdrive">Source document URL</Label>
            <Input id="sf-gdrive" value={values.google_drive_url} onChange={(e) => set("google_drive_url", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sf-folder">Folder</Label>
            <Input id="sf-folder" value={values.folder} onChange={(e) => set("folder", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sf-topics">Topics (comma-separated)</Label>
            <Input id="sf-topics" value={values.topics} onChange={(e) => set("topics", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sf-keywords">Keywords (comma-separated)</Label>
            <Input id="sf-keywords" value={values.keywords} onChange={(e) => set("keywords", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">FHMI metadata</h3>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sf-core">Core doctrine</Label>
            <Input id="sf-core" value={values.core_doctrine} onChange={(e) => set("core_doctrine", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-pos">Doctrinal position</Label>
            <Input id="sf-pos" value={values.doctrinal_position} onChange={(e) => set("doctrinal_position", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-claims">Key claims</Label>
            <textarea
              id="sf-claims"
              className={textareaClass}
              value={values.key_claims}
              onChange={(e) => set("key_claims", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-audience">Audience</Label>
            <Input id="sf-audience" value={values.audience} onChange={(e) => set("audience", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-mconf">Metadata confidence</Label>
            <Input
              id="sf-mconf"
              value={values.metadata_confidence}
              onChange={(e) => set("metadata_confidence", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sf-ai">AI training approved</Label>
            <Input
              id="sf-ai"
              value={values.ai_training_approved}
              onChange={(e) => set("ai_training_approved", e.target.value)}
            />
          </div>
        </div>
      </section>

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
