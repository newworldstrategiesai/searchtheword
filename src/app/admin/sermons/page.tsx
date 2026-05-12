"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, Plus, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  emptySermonForm,
  recordToSermonForm,
  SermonForm,
  type SermonFormValues,
} from "@/components/admin/sermon-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type ListRow = {
  id: string;
  title: string;
  preacher: string;
  date: string | null;
  series: string | null;
  external_id: string | null;
  updated_at: string;
  document_type: string | null;
};

const PAGE_SIZE = 25;

function formatUpdated(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function AdminSermonsPage() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [formInitial, setFormInitial] = useState<SermonFormValues>(() => emptySermonForm());
  const [sheetLoading, setSheetLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "date">("updated");
  const [docTypeFilter, setDocTypeFilter] = useState("");

  const offset = page * PAGE_SIZE;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [debouncedQ, sortBy, docTypeFilter]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      params.set("sort", sortBy);
      if (debouncedQ) params.set("q", debouncedQ);
      if (docTypeFilter) params.set("document_type", docTypeFilter);

      const res = await fetch(`/api/admin/sermons?${params.toString()}`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as {
        rows?: ListRow[];
        total?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error("Could not load sermons", { description: json.error ?? res.statusText });
        return;
      }
      setRows(json.rows ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error("Network error", { description: "Could not reach the server." });
    } finally {
      setListLoading(false);
    }
  }, [offset, debouncedQ, sortBy, docTypeFilter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (listLoading || rows.length === 0) return;
    const id = window.location.hash.replace(/^#/, "").trim();
    if (!id) return;
    const rowEl = document.getElementById(`sermon-row-${id}`);
    if (rowEl) {
      requestAnimationFrame(() => {
        rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
        rowEl.classList.add("bg-primary/10", "ring-2", "ring-primary/30");
        window.setTimeout(() => {
          rowEl.classList.remove("bg-primary/10", "ring-2", "ring-primary/30");
        }, 2400);
      });
    }
  }, [listLoading, rows]);

  function openCreate() {
    setEditingId("new");
    setFormInitial(emptySermonForm());
    setSheetOpen(true);
  }

  async function openEdit(id: string) {
    setSheetOpen(true);
    setEditingId(id);
    setFormInitial(emptySermonForm());
    setSheetLoading(true);
    try {
      const res = await fetch(`/api/admin/sermons/${id}`, { credentials: "same-origin" });
      const json = (await res.json()) as { sermon?: Record<string, unknown>; error?: string };
      if (!res.ok) {
        toast.error("Could not load sermon", { description: json.error ?? res.statusText });
        setSheetOpen(false);
        return;
      }
      if (json.sermon) {
        setFormInitial(recordToSermonForm(json.sermon));
      }
    } catch {
      toast.error("Network error");
      setSheetOpen(false);
    } finally {
      setSheetLoading(false);
    }
  }

  async function handleSave(values: SermonFormValues) {
    setSaving(true);
    try {
      if (editingId === "new") {
        const res = await fetch("/api/admin/sermons", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const json = (await res.json()) as { id?: string; warnings?: string[]; error?: string };
        if (!res.ok) {
          toast.error("Could not create sermon", { description: json.error ?? res.statusText });
          return;
        }
        if (json.warnings?.length) {
          toast.warning("Sermon created with warnings", { description: json.warnings.join("; ") });
        } else {
          toast.success("Sermon created");
        }
      } else if (editingId) {
        const res = await fetch(`/api/admin/sermons/${editingId}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const json = (await res.json()) as { warnings?: string[]; error?: string };
        if (!res.ok) {
          toast.error("Could not update sermon", { description: json.error ?? res.statusText });
          return;
        }
        if (json.warnings?.length) {
          toast.warning("Sermon updated with warnings", { description: json.warnings.join("; ") });
        } else {
          toast.success("Sermon updated");
        }
      }
      setSheetOpen(false);
      setEditingId(null);
      await loadList();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingId || editingId === "new") return;
    if (!window.confirm(`Delete “${formInitial.title}”? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/sermons/${editingId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error("Could not delete", { description: json.error ?? res.statusText });
        return;
      }
      toast.success("Sermon deleted");
      setSheetOpen(false);
      setEditingId(null);
      await loadList();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showPagination = total > PAGE_SIZE;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-6 sm:space-y-8 sm:px-4 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</p>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">All sermons</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recently updated items appear first (including new PDF imports). Use search or filters to narrow the
            list.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-10")}>
            Upload &amp; tools
          </Link>
          <Button size="sm" onClick={() => openCreate()} className="min-h-10 gap-1.5">
            <Plus className="size-4" aria-hidden />
            Add sermon
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end lg:gap-3">
          <div className="space-y-1.5 lg:col-span-5">
            <Label htmlFor="sermon-search" className="text-xs text-muted-foreground">
              Search title or preacher
            </Label>
            <Input
              id="sermon-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="e.g. Romans, Vaughn…"
              className="min-h-10"
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:col-span-4">
            <div className="space-y-1.5">
              <Label htmlFor="sermon-sort" className="text-xs text-muted-foreground">
                Sort by
              </Label>
              <select
                id="sermon-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value === "date" ? "date" : "updated")}
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs",
                  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                )}
              >
                <option value="updated">Last updated (import / edit)</option>
                <option value="date">Sermon date</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sermon-doctype" className="text-xs text-muted-foreground">
                Type
              </Label>
              <select
                id="sermon-doctype"
                value={docTypeFilter}
                onChange={(e) => setDocTypeFilter(e.target.value)}
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs",
                  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                )}
              >
                <option value="">All types</option>
                <option value="pdf">PDF imports</option>
                <option value="Bible Study">Bible Study</option>
                <option value="Sermon">Sermon</option>
              </select>
            </div>
          </div>
          <div className="flex items-end lg:col-span-3">
            <Button
              type="button"
              variant="secondary"
              className="w-full min-h-10 gap-2 sm:w-auto"
              disabled={listLoading}
              onClick={() => void loadList()}
            >
              <RotateCw className={cn("size-4", listLoading && "animate-spin")} aria-hidden />
              Refresh
            </Button>
          </div>
        </div>

        <div className="border-t border-border pt-3 text-sm text-muted-foreground">
          {listLoading ? "Loading…" : `${total} sermon${total === 1 ? "" : "s"}${debouncedQ ? " (filtered)" : ""}`}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Mobile: cards */}
        <div className="md:hidden">
          {listLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              <p>No sermons match.</p>
              <p className="mt-2">
                Import a PDF from{" "}
                <Link href="/admin" className="font-medium text-primary underline-offset-2 hover:underline">
                  Upload &amp; tools
                </Link>
                , or add a row.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li
                  key={row.id}
                  id={`sermon-row-${row.id}`}
                  className="space-y-2 px-4 py-4 transition-colors duration-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/sermon/${row.id}`}
                      className="min-w-0 flex-1 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {row.title}
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 shrink-0 gap-1 px-2"
                      onClick={() => void openEdit(row.id)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      <span className="sr-only sm:not-sr-only">Edit</span>
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">{row.preacher}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{row.date ? row.date.slice(0, 10) : "No date"}</span>
                    <span aria-hidden>·</span>
                    <span className="truncate" title={row.series ?? undefined}>
                      {row.series ?? "—"}
                    </span>
                    {row.document_type && (
                      <Badge variant="secondary" className="text-[0.65rem] font-normal">
                        {row.document_type}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[0.7rem] text-muted-foreground">Updated {formatUpdated(row.updated_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 dark:bg-muted/10">
                  <th className="px-3 py-2.5 font-semibold">Title</th>
                  <th className="px-3 py-2.5 font-semibold">Preacher</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Type</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Date</th>
                  <th className="px-3 py-2.5 font-semibold">Series</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Updated</th>
                  <th className="min-w-[7rem] px-3 py-2.5 font-mono text-xs font-semibold">External ID</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listLoading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">
                      <Loader2 className="mx-auto size-5 animate-spin" aria-hidden />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">
                      No sermons match. Try clearing search or import from{" "}
                      <Link href="/admin" className="text-primary underline-offset-2 hover:underline">
                        Upload &amp; tools
                      </Link>
                      .
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      id={`sermon-row-${row.id}`}
                      className="transition-colors duration-300 hover:bg-muted/40 dark:hover:bg-muted/15"
                    >
                      <td className="max-w-[200px] px-3 py-2 lg:max-w-[240px]">
                        <Link
                          href={`/sermon/${row.id}`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {row.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{row.preacher}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {row.document_type ? (
                          <Badge variant="outline" className="font-normal">
                            {row.document_type}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {row.date ? row.date.slice(0, 10) : "—"}
                      </td>
                      <td
                        className="max-w-[120px] truncate px-3 py-2 text-muted-foreground lg:max-w-[140px]"
                        title={row.series ?? ""}
                      >
                        {row.series ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground" title={row.updated_at}>
                        {formatUpdated(row.updated_at)}
                      </td>
                      <td
                        className="max-w-[100px] truncate px-3 py-2 font-mono text-[0.65rem] text-muted-foreground lg:max-w-[120px]"
                        title={row.external_id ?? ""}
                      >
                        {row.external_id ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="sm" className="gap-1" onClick={() => void openEdit(row.id)}>
                          <Pencil className="size-3.5" aria-hidden />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showPagination && (
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-10 min-w-[5rem]"
              disabled={page <= 0 || listLoading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-10 min-w-[5rem]"
              disabled={page >= totalPages - 1 || listLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditingId(null);
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full max-w-full flex-col overflow-hidden border-border p-0 sm:max-w-2xl"
          showCloseButton
        >
          <SheetHeader className="shrink-0 border-b border-border px-4 pb-4 pt-6 sm:px-6">
            <SheetTitle>{editingId === "new" ? "New sermon" : "Edit sermon"}</SheetTitle>
            <SheetDescription>
              Required fields: title and preacher. Tags and scripture links are rebuilt after save.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
            {sheetLoading ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="size-8 animate-spin" aria-hidden />
              </div>
            ) : (
              <>
                <SermonForm
                  initial={formInitial}
                  onSubmit={handleSave}
                  submitting={saving}
                  submitLabel={editingId === "new" ? "Create sermon" : "Save changes"}
                />
                {editingId && editingId !== "new" && (
                  <div className="border-t border-border pb-4 pt-4">
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full gap-2 sm:w-auto"
                      disabled={saving}
                      onClick={() => void handleDelete()}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Delete sermon
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
